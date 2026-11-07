package com.motoxplus.api.storage;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.motoxplus.api.notify.FakeHttp;
import java.net.URI;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class StorageServiceTest {
    private FakeHttp fake;

    @BeforeEach void start() throws Exception { fake = new FakeHttp().respond(200, ""); }

    @AfterEach void stop() { fake.close(); }

    private StorageService storage(String privateBucket) {
        return new StorageService("acct", "AKID", "SECRET", "motoxplus-assets", privateBucket, "https://pub.example.r2.dev/", fake.url());
    }

    @Test
    void privateUploadGoesToThePrivateBucketAndReturnsAMarkerNotAUrl() {
        var stored = storage("motoxplus-kyc").putPrivate("%PDF".getBytes(), "vendors/v1/pan/abc.pdf", "application/pdf");

        assertThat(stored.storedUrl()).isEqualTo("r2-private://vendors/v1/pan/abc.pdf");
        var req = fake.last();
        assertThat(req.method()).isEqualTo("PUT");
        assertThat(req.path()).isEqualTo("/motoxplus-kyc/vendors/v1/pan/abc.pdf");
        assertThat(req.header("Cache-Control")).isEqualTo("private, no-store");
        assertThat(req.header("Authorization")).startsWith("AWS4-HMAC-SHA256");
    }

    @Test
    void privateUploadFailsClosedWithoutAPrivateBucket() {
        assertThatThrownBy(() -> storage("").putPrivate(new byte[] {1}, "k", "application/pdf"))
                .isInstanceOf(StorageService.StorageUnavailableException.class);
        assertThat(fake.requests).isEmpty();
    }

    @Test
    void publicUploadReturnsThePublicUrl() {
        var stored = storage("motoxplus-kyc").putPublic(new byte[] {1, 2}, "products/p1/a.webp", "image/webp");
        assertThat(stored.storedUrl()).isEqualTo("https://pub.example.r2.dev/products/p1/a.webp");
        assertThat(fake.last().path()).isEqualTo("/motoxplus-assets/products/p1/a.webp");
    }

    @Test
    void signedUrlsAreCappedAtFiveMinutesAndRoutedToTheRightBucket() {
        var s = storage("motoxplus-kyc");
        URI priv = URI.create(s.signedUrl("vendors/v1/pan/abc.pdf", "r2-private://vendors/v1/pan/abc.pdf", 3600));
        assertThat(priv.getPath()).isEqualTo("/motoxplus-kyc/vendors/v1/pan/abc.pdf");
        assertThat(priv.getQuery()).contains("X-Amz-Expires=300");

        URI legacy = URI.create(s.signedUrl("dealers/d1/pan.pdf", "https://pub.example.r2.dev/dealers/d1/pan.pdf", 60));
        assertThat(legacy.getPath()).isEqualTo("/motoxplus-assets/dealers/d1/pan.pdf");
        assertThat(legacy.getQuery()).contains("X-Amz-Expires=60");
    }
}
