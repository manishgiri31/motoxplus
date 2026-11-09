package com.motoxplus.api.web;

import static org.assertj.core.api.Assertions.assertThat;

import com.motoxplus.api.IntegrationTestBase;
import com.motoxplus.api.security.JwtService;
import com.motoxplus.api.security.JwtService.AccessClaims;
import com.motoxplus.api.storage.FakeR2;
import java.io.ByteArrayOutputStream;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Arrays;
import java.util.UUID;
import java.util.concurrent.ThreadLocalRandom;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * Uploads sent the way a browser sends them: a real HTTP/1.1 request to the running server (embedded Tomcat, the real
 * filter chain), multipart/form-data with a Content-Length header, signed in by the mx_access cookie.
 *
 * <p>MockMvc never sets Content-Length on a multipart request, which is how a 16 KB body limit that refused every real
 * KYC document (and would have refused every listing photo) passed the other tests. The last test is the control: the
 * same body to a JSON endpoint is still refused, so the size limit really is reading these requests.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class BrowserUploadIntegrationTest extends IntegrationTestBase {
    static final FakeR2 R2 = startR2();

    private static FakeR2 startR2() {
        try {
            return new FakeR2();
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    @DynamicPropertySource
    static void marketplaceOn(DynamicPropertyRegistry r) {
        r.add("marketplace.enabled", () -> "true");
        r.add("app.db.migrate", () -> "true");
        r.add("app.db.baseline-guard", () -> "false");
        r.add("app.crypto.encryption-key", () -> "00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff");
        r.add("app.r2.account-id", () -> "acct");
        r.add("app.r2.access-key-id", () -> "AKID");
        r.add("app.r2.secret-access-key", () -> "SECRET");
        r.add("app.r2.bucket", () -> "motoxplus-assets");
        r.add("app.r2.private-bucket", () -> "motoxplus-private");
        r.add("app.r2.public-url", () -> "https://pub.example.r2.dev");
        r.add("app.r2.endpoint", () -> R2.url());
    }

    @LocalServerPort int port;
    @Autowired JwtService jwt;
    private final JsonMapper json = JsonMapper.builder().build();
    private final HttpClient http = HttpClient.newBuilder().version(HttpClient.Version.HTTP_1_1)
            .connectTimeout(Duration.ofSeconds(5)).build();

    /** Well over the old 16 KB limit, well under the 5 MB file limit: a typical phone photo or scanned PAN card. */
    static final byte[] JPEG = file(new byte[] {(byte) 0xFF, (byte) 0xD8, (byte) 0xFF, (byte) 0xE0}, 180_000);
    static final byte[] PDF = file("%PDF-1.4\n".getBytes(StandardCharsets.US_ASCII), 120_000);

    private static byte[] file(byte[] head, int size) {
        byte[] b = Arrays.copyOf(head, size);
        for (int i = head.length; i < size; i++) b[i] = (byte) (i % 241);
        return b;
    }

    // ------------------------------------------------------------------ helpers

    /** A signed-in vendor: the session row plus the cookie a browser would send. */
    private String vendorCookie(String status) {
        String n = UUID.randomUUID().toString().replace("-", "").substring(0, 10);
        String uid = "u-up-" + n;
        String email = "upload-" + n + "@example.test";
        jdbc.update("""
                INSERT INTO "User" (id, name, email, password, role, "emailVerified", "mobileVerified", "mobileNumber", "isActive", "updatedAt")
                VALUES (?, 'Asha Rao', ?, 'x', 'VENDOR', now(), true, ?, true, now())""", uid, email, "+9197" + n.hashCode());
        jdbc.update("""
                INSERT INTO "Vendor" (id, "userId", "vendorCode", "companyName", "ownerName", email, phone, city, state, status, "updatedAt")
                VALUES (?, ?, ?, 'Rao Brake Works', 'Asha Rao', ?, '9876543210', 'Pune', 'Maharashtra', ?::"VendorStatus", now())""",
                "v-up-" + n, uid, "VND" + String.format("%08d", ThreadLocalRandom.current().nextInt(100_000_000)), email, status);
        String sid = "s-" + UUID.randomUUID();
        jdbc.update("""
                INSERT INTO "UserSession" (id, "userId", "refreshToken", "expiresAt") VALUES (?, ?, ?, now() + interval '7 days')""",
                sid, uid, "r-" + sid);
        return "mx_access=" + jwt.signAccessToken(new AccessClaims(uid, email, "VENDOR", sid));
    }

    /** The body a browser builds from FormData: text fields, then the file part. */
    private static byte[] multipart(String boundary, String[][] fields, String fileName, String fileType, byte[] content) {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        for (String[] f : fields) {
            out.writeBytes(("--" + boundary + "\r\nContent-Disposition: form-data; name=\"" + f[0] + "\"\r\n\r\n" + f[1] + "\r\n")
                    .getBytes(StandardCharsets.UTF_8));
        }
        out.writeBytes(("--" + boundary + "\r\nContent-Disposition: form-data; name=\"file\"; filename=\"" + fileName
                + "\"\r\nContent-Type: " + fileType + "\r\n\r\n").getBytes(StandardCharsets.UTF_8));
        out.writeBytes(content);
        out.writeBytes(("\r\n--" + boundary + "--\r\n").getBytes(StandardCharsets.UTF_8));
        return out.toByteArray();
    }

    /** HttpClient sends a byte-array body with Content-Length, exactly as a browser does for a FormData upload. */
    private HttpResponse<String> send(String method, String path, String cookie, String contentType, byte[] body) throws Exception {
        HttpRequest req = HttpRequest.newBuilder(URI.create("http://127.0.0.1:" + port + path))
                .timeout(Duration.ofSeconds(30))
                .header("Cookie", cookie)
                .header("Content-Type", contentType)
                .header("Accept", "application/json")
                .method(method, HttpRequest.BodyPublishers.ofByteArray(body))
                .build();
        return http.send(req, HttpResponse.BodyHandlers.ofString());
    }

    private static String boundary() {
        return "----WebKitFormBoundary" + UUID.randomUUID().toString().replace("-", "").substring(0, 16);
    }

    // ------------------------------------------------------------------ tests

    @Test
    void aListingPhotoOver16KbUploadsWhenTheBrowserSendsContentLength() throws Exception {
        String cookie = vendorCookie("APPROVED");
        HttpResponse<String> created = send("POST", "/api/v1/vendors/me/listings", cookie, "application/json",
                "{\"title\":\"Rear brake caliper\"}".getBytes(StandardCharsets.UTF_8));
        assertThat(created.statusCode()).as(created.body()).isEqualTo(201);
        String id = json.readTree(created.body()).get("id").asString();

        String b = boundary();
        byte[] body = multipart(b, new String[0][], "caliper.jpg", "image/jpeg", JPEG);
        assertThat(body.length).isGreaterThan(16 * 1024);

        HttpResponse<String> res = send("POST", "/api/v1/vendors/me/listings/" + id + "/images", cookie,
                "multipart/form-data; boundary=" + b, body);
        assertThat(res.statusCode()).as(res.body()).isEqualTo(200);
        JsonNode images = json.readTree(res.body()).get("images");
        assertThat(images.size()).isEqualTo(1);
        assertThat(images.get(0).get("size").asInt()).isEqualTo(JPEG.length);
        assertThat(R2.objects.values()).anySatisfy(stored -> assertThat(stored).isEqualTo(JPEG));
    }

    @Test
    void aKycDocumentOver16KbUploadsTheSameWay() throws Exception {
        String cookie = vendorCookie("PENDING"); // contact details verified, application still a draft: documents are editable
        String b = boundary();
        byte[] body = multipart(b, new String[][] {{"documentType", "PAN_CARD"}}, "pan.pdf", "application/pdf", PDF);
        assertThat(body.length).isGreaterThan(16 * 1024);

        HttpResponse<String> res = send("POST", "/api/v1/vendors/me/application/documents", cookie, "multipart/form-data; boundary=" + b, body);
        assertThat(res.statusCode()).as(res.body()).isEqualTo(200);
        JsonNode docs = json.readTree(res.body()).get("documents");
        assertThat(docs.size()).isEqualTo(1);
        assertThat(docs.get(0).get("documentType").asString()).isEqualTo("PAN_CARD");
        assertThat(docs.get(0).get("fileSize").asInt()).isEqualTo(PDF.length);
        assertThat(R2.objects.values()).anySatisfy(stored -> assertThat(stored).isEqualTo(PDF));
    }

    @Test
    void theSameSizeIsStillRefusedEverywhereElse() throws Exception {
        String cookie = vendorCookie("APPROVED");
        String b = boundary();
        byte[] body = multipart(b, new String[0][], "caliper.jpg", "image/jpeg", JPEG);

        // Identical photo upload, but to a JSON endpoint: refused on its Content-Length before anything is parsed.
        HttpResponse<String> wrongPath = send("POST", "/api/v1/vendors/me/listings", cookie, "multipart/form-data; boundary=" + b, body);
        assertThat(wrongPath.statusCode()).isEqualTo(413);
        assertThat(wrongPath.body()).contains("PAYLOAD_TOO_LARGE");

        byte[] bigJson = ("{\"title\":\"" + "x".repeat(17 * 1024) + "\"}").getBytes(StandardCharsets.UTF_8);
        HttpResponse<String> json17k = send("PUT", "/api/v1/vendors/me/listings/any-id", cookie, "application/json", bigJson);
        assertThat(json17k.statusCode()).isEqualTo(413);
    }
}
