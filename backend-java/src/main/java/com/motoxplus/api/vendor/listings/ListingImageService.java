package com.motoxplus.api.vendor.listings;

import com.motoxplus.api.common.Cuid;
import com.motoxplus.api.marketplace.audit.AuditLogService;
import com.motoxplus.api.security.AuthenticatedUser;
import com.motoxplus.api.storage.StorageService;
import com.motoxplus.api.vendor.VendorSnapshot;
import com.motoxplus.api.web.ApiException;
import com.motoxplus.api.web.FieldErrorsException;
import java.io.IOException;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.multipart.MultipartFile;

/**
 * Listing photos in the PRIVATE bucket. Upload checks size and the real file type (JPG / PNG / WEBP from the bytes),
 * stores under vendors/{vendorId}/listings/{listingId}/, and records the row. The bytes are served only by this API:
 * to the owner for any of their listings, and to everyone for a live listing of an approved vendor.
 */
@Service
@ConditionalOnProperty(name = "marketplace.enabled", havingValue = "true")
public class ListingImageService {
    private static final Logger log = LoggerFactory.getLogger(ListingImageService.class);

    private final ListingService service;
    private final ListingRepository listings;
    private final ProductProjection projection;
    private final StorageService storage;
    private final AuditLogService audit;
    private final TransactionTemplate tx;

    public ListingImageService(ListingService service, ListingRepository listings, ProductProjection projection, StorageService storage,
                               AuditLogService audit, TransactionTemplate tx) {
        this.service = service;
        this.listings = listings;
        this.projection = projection;
        this.storage = storage;
        this.audit = audit;
        this.tx = tx;
    }

    public Map<String, Object> add(AuthenticatedUser user, String listingId, MultipartFile file, String ip) {
        VendorSnapshot v = service.vendor(user, ListingService.UPDATE);
        Listing l = service.owned(v, listingId);
        if (l.images().size() >= ListingRules.MAX_IMAGES) throw tooMany();
        if (file == null || file.isEmpty()) throw FieldErrorsException.invalid("images", "This file is empty");
        if (file.getSize() > ListingRules.MAX_IMAGE_BYTES) throw FieldErrorsException.invalid("images", "Photo is too large (max 5 MB)");

        byte[] bytes;
        try {
            bytes = file.getBytes();
        } catch (IOException e) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Could not read the uploaded file", "UPLOAD_FAILED", null);
        }
        String mime = ImageTypes.sniff(bytes);
        if (mime == null) throw FieldErrorsException.invalid("images", "Use a JPG, PNG or WEBP photo");
        String ext = ImageTypes.extension(mime);
        String sha256 = sha256(bytes);

        String imageId = Cuid.next();
        String key = "vendors/" + v.vendorId() + "/listings/" + l.id() + "/" + UUID.randomUUID() + "." + ext;
        StorageService.Stored stored;
        try {
            stored = storage.putPrivate(bytes, key, mime);
        } catch (StorageService.StorageUnavailableException e) {
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "Photo upload is not available right now. Please try again later.",
                    "STORAGE_UNAVAILABLE", null);
        }

        String name = ImageTypes.safeFileName(file.getOriginalFilename(), ext);
        try {
            tx.executeWithoutResult(s -> {
                Listing locked = listings.lock(v.vendorId(), listingId).orElseThrow(ListingService::notFound);
                if (locked.images().size() >= ListingRules.MAX_IMAGES) throw tooMany(); // a parallel upload got there first
                listings.insertImage(imageId, locked.id(), key, stored.storedUrl(), mime, bytes.length, sha256, name, user.userId());
                listings.touch(locked.id(), user.userId());
                if (locked.live()) projection.photos(locked.id(), locked.productId());
                Map<String, Object> details = new LinkedHashMap<>();
                details.put("imageId", imageId);
                details.put("size", bytes.length);
                details.put("mime", mime);
                details.put("sha256", sha256);
                audit.record(user, "vendor.listing.image_added", "listing", locked.id(), v.vendorId(), ip, details);
            });
        } catch (RuntimeException e) {
            deleteQuietly(key, stored.storedUrl()); // never leave an orphan object behind
            throw e;
        }
        return ListingView.detail(service.owned(v, listingId));
    }

    public Map<String, Object> remove(AuthenticatedUser user, String listingId, String imageId, String ip) {
        VendorSnapshot v = service.vendor(user, ListingService.UPDATE);
        Listing.Image removed = tx.execute(s -> {
            Listing l = listings.lock(v.vendorId(), listingId).orElseThrow(ListingService::notFound);
            Listing.Image img = l.images().stream().filter(i -> i.id().equals(imageId)).findFirst().orElseThrow(ListingImageService::imageNotFound);
            if (l.live() && l.images().size() == 1) {
                String msg = "A live listing needs at least one photo. Add another photo first, or unpublish the listing.";
                throw new FieldErrorsException(HttpStatus.CONFLICT, "LAST_PHOTO", msg, Map.of("images", msg));
            }
            listings.deleteImage(l.id(), img.id());
            listings.touch(l.id(), user.userId());
            if (l.live()) projection.photos(l.id(), l.productId());
            audit.record(user, "vendor.listing.image_removed", "listing", l.id(), v.vendorId(), ip, Map.of("imageId", img.id()));
            return img;
        });
        deleteQuietly(removed.objectKey(), removed.storedUrl());
        return ListingView.detail(service.owned(v, listingId));
    }

    /** Makes a photo the primary one (first in the gallery, used in search results and the catalogue grid). */
    public Map<String, Object> makePrimary(AuthenticatedUser user, String listingId, String imageId, String ip) {
        VendorSnapshot v = service.vendor(user, ListingService.UPDATE);
        tx.executeWithoutResult(s -> {
            Listing l = listings.lock(v.vendorId(), listingId).orElseThrow(ListingService::notFound);
            Listing.Image img = l.images().stream().filter(i -> i.id().equals(imageId)).findFirst().orElseThrow(ListingImageService::imageNotFound);
            if (img.sortOrder() == 0) return;
            listings.renumber(l.id(), img.id());
            listings.touch(l.id(), user.userId());
            if (l.live()) projection.photos(l.id(), l.productId());
            audit.record(user, "vendor.listing.image_primary", "listing", l.id(), v.vendorId(), ip, Map.of("imageId", img.id()));
        });
        return ListingView.detail(service.owned(v, listingId));
    }

    /** The owner's view of any photo of their own listings (drafts included). */
    public StorageService.Loaded ownerBytes(AuthenticatedUser user, String listingId, String imageId) {
        VendorSnapshot v = service.vendor(user, ListingService.VIEW);
        Listing.Image img = listings.ownedImage(v.vendorId(), listingId, imageId).orElseThrow(ListingImageService::imageNotFound);
        return load(img);
    }

    /** Anyone's view of a live listing's photo; drafts, unpublished listings and suspended vendors answer 404. */
    public StorageService.Loaded publicBytes(String imageId) {
        Listing.Image img = listings.publicImage(imageId).orElseThrow(ListingImageService::imageNotFound);
        return load(img);
    }

    private StorageService.Loaded load(Listing.Image img) {
        StorageService.Loaded loaded;
        try {
            loaded = storage.read(img.objectKey(), img.storedUrl());
        } catch (StorageService.StorageUnavailableException e) {
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "Photos can't be loaded right now", "STORAGE_UNAVAILABLE", null);
        }
        if (loaded == null) throw imageNotFound();
        // Serve the type recorded at upload (sniffed from the bytes), not whatever the bucket says.
        return new StorageService.Loaded(loaded.bytes(), img.mimeType());
    }

    private static FieldErrorsException tooMany() {
        return FieldErrorsException.invalid("images", "You can add up to " + ListingRules.MAX_IMAGES + " photos");
    }

    private static ApiException imageNotFound() {
        return new ApiException(HttpStatus.NOT_FOUND, "Photo not found", "NOT_FOUND", null);
    }

    private void deleteQuietly(String key, String storedUrl) {
        try {
            storage.delete(key, storedUrl);
        } catch (RuntimeException e) {
            log.error("[Listings] could not delete photo object {}: {}", key, e.getMessage());
        }
    }

    static String sha256(byte[] bytes) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
