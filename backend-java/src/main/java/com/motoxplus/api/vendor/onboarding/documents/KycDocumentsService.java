package com.motoxplus.api.vendor.onboarding.documents;

import com.motoxplus.api.common.Cuid;
import com.motoxplus.api.common.Time;
import com.motoxplus.api.marketplace.audit.AuditLogService;
import com.motoxplus.api.security.AuthenticatedUser;
import com.motoxplus.api.storage.StorageService;
import com.motoxplus.api.vendor.VendorContext;
import com.motoxplus.api.vendor.VendorDocuments;
import com.motoxplus.api.vendor.VendorSnapshot;
import com.motoxplus.api.web.ApiException;
import com.motoxplus.api.web.FieldErrorsException;
import java.io.IOException;
import java.sql.Timestamp;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.multipart.MultipartFile;

/**
 * Onboarding step: KYC documents in PRIVATE storage (never a public URL), one current file per type, stored as
 * public."VendorDocument" rows so the existing admin and storage tooling see them. File type is decided by the
 * bytes, not the client's Content-Type or extension.
 */
@Service
@ConditionalOnProperty(name = "marketplace.enabled", havingValue = "true")
public class KycDocumentsService {
    private static final Logger log = LoggerFactory.getLogger(KycDocumentsService.class);

    private final JdbcTemplate jdbc;
    private final TransactionTemplate tx;
    private final VendorContext vendors;
    private final StorageService storage;
    private final AuditLogService audit;

    public KycDocumentsService(JdbcTemplate jdbc, TransactionTemplate tx, VendorContext vendors, StorageService storage,
                               AuditLogService audit) {
        this.jdbc = jdbc;
        this.tx = tx;
        this.vendors = vendors;
        this.storage = storage;
        this.audit = audit;
    }

    /** "application/pdf" | "image/jpeg" | "image/png", or null for anything else. */
    static String sniff(byte[] b) {
        if (b.length >= 5 && b[0] == '%' && b[1] == 'P' && b[2] == 'D' && b[3] == 'F' && b[4] == '-') return "application/pdf";
        if (b.length >= 3 && (b[0] & 0xFF) == 0xFF && (b[1] & 0xFF) == 0xD8 && (b[2] & 0xFF) == 0xFF) return "image/jpeg";
        if (b.length >= 8 && (b[0] & 0xFF) == 0x89 && b[1] == 'P' && b[2] == 'N' && b[3] == 'G'
                && b[4] == 0x0D && b[5] == 0x0A && b[6] == 0x1A && b[7] == 0x0A) return "image/png";
        return null;
    }

    static String safeFileName(String original, String ext) {
        String n = original == null ? "" : original.replaceAll("^.*[\\\\/]", "").replaceAll("[\\p{Cntrl}]", "").trim();
        if (n.isEmpty()) n = "document." + ext;
        return n.length() > 200 ? n.substring(n.length() - 200) : n;
    }

    public void upload(AuthenticatedUser user, String documentType, MultipartFile file, String ip) {
        VendorSnapshot v = vendors.documentsWritable(user);
        String type = documentType == null ? "" : documentType.trim().toUpperCase();
        if (!VendorDocuments.uploadable(type)) throw FieldErrorsException.invalid("documentType", "Unknown document type");
        if (file == null || file.isEmpty()) throw FieldErrorsException.invalid(type, "This file is empty");
        if (file.getSize() > VendorDocuments.MAX_BYTES) throw FieldErrorsException.invalid(type, "File is too large (max 5 MB)");

        byte[] bytes;
        try {
            bytes = file.getBytes();
        } catch (IOException e) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Could not read the uploaded file", "UPLOAD_FAILED", null);
        }
        String mime = sniff(bytes);
        if (mime == null) throw FieldErrorsException.invalid(type, "Unsupported file type. Allowed: PDF, JPG, PNG");
        String ext = switch (mime) {
            case "application/pdf" -> "pdf";
            case "image/png" -> "png";
            default -> "jpg";
        };

        String key = "vendors/" + v.vendorId() + "/kyc/" + type.toLowerCase() + "/" + UUID.randomUUID() + "." + ext;
        StorageService.Stored stored;
        try {
            stored = storage.putPrivate(bytes, key, mime);
        } catch (StorageService.StorageUnavailableException e) {
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "Document upload is not available right now. Please try again later.",
                    "STORAGE_UNAVAILABLE", null);
        }

        List<VendorSnapshot.Document> replaced = v.documents().stream().filter(d -> d.documentType().equals(type)).toList();
        String name = safeFileName(file.getOriginalFilename(), ext);
        try {
            tx.executeWithoutResult(s -> {
                jdbc.update("DELETE FROM public.\"VendorDocument\" WHERE \"vendorId\" = ? AND \"documentType\" = ?::\"VendorDocumentType\"",
                        v.vendorId(), type);
                jdbc.update("""
                        INSERT INTO public."VendorDocument" (id, "vendorId", "documentType", "fileUrl", "fileName", "fileSize", key, "uploadedAt")
                        VALUES (?, ?, ?::"VendorDocumentType", ?, ?, ?, ?, ?)
                        """, Cuid.next(), v.vendorId(), type, stored.storedUrl(), name, (int) stored.size(), key,
                        Timestamp.valueOf(Time.utcNow()));
                audit.record(user, "vendor.document.uploaded", "vendor", v.vendorId(), v.vendorId(), ip,
                        Map.of("documentType", type, "size", stored.size(), "mime", mime, "replaced", replaced.size()));
            });
        } catch (RuntimeException e) {
            storage.delete(key, stored.storedUrl()); // don't leave an orphan behind
            throw e;
        }
        for (var old : replaced) deleteQuietly(old);
    }

    public void remove(AuthenticatedUser user, String documentType, String ip) {
        VendorSnapshot v = vendors.documentsWritable(user);
        String type = documentType == null ? "" : documentType.trim().toUpperCase();
        List<VendorSnapshot.Document> docs = v.documents().stream().filter(d -> d.documentType().equals(type)).toList();
        if (docs.isEmpty()) throw new ApiException(HttpStatus.NOT_FOUND, "Document not found", "NOT_FOUND", null);
        tx.executeWithoutResult(s -> {
            jdbc.update("DELETE FROM public.\"VendorDocument\" WHERE \"vendorId\" = ? AND \"documentType\" = ?::\"VendorDocumentType\"",
                    v.vendorId(), type);
            audit.record(user, "vendor.document.removed", "vendor", v.vendorId(), v.vendorId(), ip, Map.of("documentType", type));
        });
        docs.forEach(this::deleteQuietly);
    }

    /** Short-lived link to one of the signed-in vendor's own documents. */
    public String viewUrl(AuthenticatedUser user, String documentId) {
        VendorSnapshot v = vendors.current(user);
        var doc = v.documents().stream().filter(d -> d.id().equals(documentId)).findFirst()
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Document not found", "NOT_FOUND", null));
        try {
            return storage.signedUrl(doc.key(), doc.fileUrl(), StorageService.MAX_SIGNED_SECONDS);
        } catch (StorageService.StorageUnavailableException e) {
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "Documents can't be opened right now", "STORAGE_UNAVAILABLE", null);
        }
    }

    private void deleteQuietly(VendorSnapshot.Document d) {
        try {
            storage.delete(d.key(), d.fileUrl());
        } catch (RuntimeException e) {
            log.error("[KYC] could not delete replaced document object: {}", e.getMessage());
        }
    }
}
