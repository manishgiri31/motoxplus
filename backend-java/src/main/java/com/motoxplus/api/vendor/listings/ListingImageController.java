package com.motoxplus.api.vendor.listings;

import com.motoxplus.api.ratelimit.RateLimitBudgets;
import com.motoxplus.api.ratelimit.RateLimitEnforcer;
import com.motoxplus.api.security.AuthenticatedUser;
import com.motoxplus.api.storage.StorageService;
import com.motoxplus.api.web.ClientIp;
import jakarta.servlet.http.HttpServletRequest;
import java.time.Duration;
import java.util.Map;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

/**
 * Photos of the signed-in vendor's listings, plus the public photo URL used by the storefront.
 *
 * <pre>
 * POST   /api/v1/vendors/me/listings/{id}/images                    multipart "file" (JPG/PNG/WEBP, max 5 MB) -> listing
 * DELETE /api/v1/vendors/me/listings/{id}/images/{imageId}          -> listing
 * POST   /api/v1/vendors/me/listings/{id}/images/{imageId}/primary  -> listing
 * GET    /api/v1/vendors/me/listings/{id}/images/{imageId}          the photo (owner only, any status)
 * GET    /api/v1/listing-images/{imageId}                           the photo (public, live listings only)
 * </pre>
 */
@RestController
@ConditionalOnProperty(name = "marketplace.enabled", havingValue = "true")
public class ListingImageController {
    private static final String BASE = "/api/v1/vendors/me/listings/{id}/images";

    private final ListingImageService images;
    private final RateLimitEnforcer rateLimit;

    public ListingImageController(ListingImageService images, RateLimitEnforcer rateLimit) {
        this.images = images;
        this.rateLimit = rateLimit;
    }

    @PostMapping(BASE)
    public Map<String, Object> upload(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable String id,
                                      @RequestParam(value = "file", required = false) MultipartFile file, HttpServletRequest req) {
        rateLimit.enforce(req, RateLimitBudgets.LISTING_IMAGE_UPLOAD, user == null ? null : user.userId());
        return images.add(user, id, file, ClientIp.resolve(req));
    }

    @DeleteMapping(BASE + "/{imageId}")
    public Map<String, Object> remove(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable String id, @PathVariable String imageId,
                                      HttpServletRequest req) {
        rateLimit.enforce(req, RateLimitBudgets.LISTING_WRITE, user == null ? null : user.userId());
        return images.remove(user, id, imageId, ClientIp.resolve(req));
    }

    @PostMapping(BASE + "/{imageId}/primary")
    public Map<String, Object> primary(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable String id, @PathVariable String imageId,
                                       HttpServletRequest req) {
        rateLimit.enforce(req, RateLimitBudgets.LISTING_WRITE, user == null ? null : user.userId());
        return images.makePrimary(user, id, imageId, ClientIp.resolve(req));
    }

    @GetMapping(BASE + "/{imageId}")
    public ResponseEntity<byte[]> ownerPhoto(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable String id,
                                             @PathVariable String imageId) {
        return photo(images.ownerBytes(user, id, imageId), CacheControl.maxAge(Duration.ofMinutes(5)).cachePrivate());
    }

    @GetMapping("/api/v1/listing-images/{imageId}")
    public ResponseEntity<byte[]> publicPhoto(@PathVariable String imageId, HttpServletRequest req) {
        rateLimit.enforce(req, RateLimitBudgets.LISTING_IMAGE_PUBLIC, null);
        // Short public cache: an unpublished listing's photos stop being served within minutes.
        return photo(images.publicBytes(imageId), CacheControl.maxAge(Duration.ofMinutes(5)).cachePublic());
    }

    private static ResponseEntity<byte[]> photo(StorageService.Loaded img, CacheControl cache) {
        return ResponseEntity.ok()
                .cacheControl(cache)
                .contentType(MediaType.parseMediaType(img.contentType()))
                .header("Content-Disposition", "inline")
                .header("X-Content-Type-Options", "nosniff")
                .body(img.bytes());
    }
}
