package com.motoxplus.api.storage;

import java.net.URI;
import java.time.Duration;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.http.urlconnection.UrlConnectionHttpClient;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.S3Configuration;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.NoSuchKeyException;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.GetObjectPresignRequest;

/**
 * Cloudflare R2 storage (port of src/lib/storage: r2.ts, upload.ts, signed.ts, delete.ts, private.ts).
 *
 * Two buckets. PUBLIC (R2_BUCKET_NAME, served from R2_PUBLIC_URL) for product images. PRIVATE
 * (R2_PRIVATE_BUCKET_NAME, public access off) for KYC documents: rows store {@value #PRIVATE_PREFIX}{key}, never a
 * URL, and the only way to read one is a presigned link of at most {@value #MAX_SIGNED_SECONDS} seconds.
 *
 * Unlike Node there is no fallback to the public bucket for private documents: Java code that stores KYC fails
 * closed when the private bucket is not configured.
 */
@Service
public class StorageService {
    private static final Logger log = LoggerFactory.getLogger(StorageService.class);

    public static final String PRIVATE_PREFIX = "r2-private://";
    public static final int MAX_SIGNED_SECONDS = 300;

    public record Stored(String key, String storedUrl, long size) {}

    public static class StorageUnavailableException extends RuntimeException {
        public StorageUnavailableException(String message) { super(message); }
    }

    private final String publicBucket;
    private final String privateBucket;
    private final String publicUrl;
    private final S3Client s3;
    private final S3Presigner presigner;

    public StorageService(
            @Value("${app.r2.account-id:}") String accountId,
            @Value("${app.r2.access-key-id:}") String accessKeyId,
            @Value("${app.r2.secret-access-key:}") String secretAccessKey,
            @Value("${app.r2.bucket:}") String publicBucket,
            @Value("${app.r2.private-bucket:}") String privateBucket,
            @Value("${app.r2.public-url:}") String publicUrl,
            @Value("${app.r2.endpoint:}") String endpointOverride) {
        this.publicBucket = clean(publicBucket);
        this.privateBucket = clean(privateBucket);
        this.publicUrl = clean(publicUrl).replaceAll("/+$", "");

        String endpoint = !clean(endpointOverride).isEmpty()
                ? clean(endpointOverride)
                : clean(accountId).isEmpty() ? "" : "https://" + clean(accountId) + ".r2.cloudflarestorage.com";
        if (endpoint.isEmpty() || clean(accessKeyId).isEmpty() || clean(secretAccessKey).isEmpty()) {
            log.warn("[Storage] R2 credentials not set; uploads will fail until R2_ACCOUNT_ID/R2_ACCESS_KEY_ID/R2_SECRET_ACCESS_KEY are configured");
            this.s3 = null;
            this.presigner = null;
            return;
        }
        var creds = StaticCredentialsProvider.create(AwsBasicCredentials.create(clean(accessKeyId), clean(secretAccessKey)));
        // Path-style keeps bucket names out of the host, which R2 supports and which makes the endpoint testable.
        var s3Config = S3Configuration.builder().pathStyleAccessEnabled(true).build();
        this.s3 = S3Client.builder()
                .endpointOverride(URI.create(endpoint))
                .region(Region.of("auto"))
                .credentialsProvider(creds)
                .serviceConfiguration(s3Config)
                .httpClient(UrlConnectionHttpClient.builder().connectionTimeout(Duration.ofSeconds(5)).socketTimeout(Duration.ofSeconds(30)).build())
                .build();
        this.presigner = S3Presigner.builder()
                .endpointOverride(URI.create(endpoint))
                .region(Region.of("auto"))
                .credentialsProvider(creds)
                .serviceConfiguration(s3Config)
                .build();
    }

    public boolean isPrivateConfigured() {
        return s3 != null && !privateBucket.isEmpty();
    }

    /** Product images and other public assets. Returns the public URL. */
    public Stored putPublic(byte[] bytes, String key, String contentType) {
        if (s3 == null || publicBucket.isEmpty() || publicUrl.isEmpty()) throw new StorageUnavailableException("Public storage is not configured");
        put(publicBucket, key, bytes, contentType, "public, max-age=31536000, immutable");
        return new Stored(key, publicUrl + "/" + key, bytes.length);
    }

    /** KYC and other private documents. Fails closed if the private bucket is missing. */
    public Stored putPrivate(byte[] bytes, String key, String contentType) {
        if (!isPrivateConfigured()) throw new StorageUnavailableException("Private document storage is not configured");
        put(privateBucket, key, bytes, contentType, "private, no-store");
        return new Stored(key, PRIVATE_PREFIX + key, bytes.length);
    }

    /** Short-lived link for a stored document; routes legacy public-bucket rows to the public bucket. */
    public String signedUrl(String key, String storedUrl, int seconds) {
        if (presigner == null) throw new StorageUnavailableException("Storage is not configured");
        int ttl = Math.max(1, Math.min(seconds, MAX_SIGNED_SECONDS));
        var get = GetObjectRequest.builder().bucket(bucketFor(storedUrl)).key(key).build();
        return presigner.presignGetObject(GetObjectPresignRequest.builder()
                .signatureDuration(Duration.ofSeconds(ttl))
                .getObjectRequest(get)
                .build()).url().toString();
    }

    public void delete(String key, String storedUrl) {
        if (s3 == null || key == null || key.isEmpty()) return;
        try {
            s3.deleteObject(DeleteObjectRequest.builder().bucket(bucketFor(storedUrl)).key(key).build());
        } catch (NoSuchKeyException ignored) {
            // already gone
        }
    }

    String bucketFor(String storedUrl) {
        if (storedUrl != null && storedUrl.startsWith(PRIVATE_PREFIX)) {
            if (privateBucket.isEmpty()) throw new StorageUnavailableException("Document is in the private bucket but R2_PRIVATE_BUCKET_NAME is not set");
            return privateBucket;
        }
        return publicBucket;
    }

    private void put(String bucket, String key, byte[] bytes, String contentType, String cacheControl) {
        s3.putObject(PutObjectRequest.builder().bucket(bucket).key(key).contentType(contentType).cacheControl(cacheControl).build(),
                RequestBody.fromBytes(bytes));
    }

    private static String clean(String v) {
        if (v == null) return "";
        String t = v.trim();
        return t.startsWith("your_") || t.startsWith("your-") ? "" : t;
    }
}
