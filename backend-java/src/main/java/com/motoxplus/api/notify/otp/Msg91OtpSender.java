package com.motoxplus.api.notify.otp;

import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/** OTP over MSG91's v5 OTP API (port of src/lib/sms/providers/msg91.ts sendOTP). */
public class Msg91OtpSender implements OtpSender {
    private static final Logger log = LoggerFactory.getLogger(Msg91OtpSender.class);

    private final String authKey;
    private final String templateId;
    private final String baseUrl;
    private final JsonMapper json;
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();

    public Msg91OtpSender(String authKey, String templateId, String baseUrl, JsonMapper json) {
        this.authKey = authKey == null ? "" : authKey.trim();
        this.templateId = templateId == null ? "" : templateId.trim();
        this.baseUrl = baseUrl.replaceAll("/+$", "");
        this.json = json;
    }

    @Override public String name() { return "msg91"; }

    @Override public boolean isConfigured() {
        return !OtpSenders.isPlaceholder(authKey) && !OtpSenders.isPlaceholder(templateId);
    }

    @Override
    public Result send(String e164Mobile, String code) {
        if (!isConfigured()) return Result.failed("MSG91 not configured");
        // MSG91 takes the number without "+" (country code included).
        String mobile = e164Mobile.startsWith("+") ? e164Mobile.substring(1) : e164Mobile;
        String url = baseUrl + "/api/v5/otp?template_id=" + enc(templateId) + "&mobile=" + enc(mobile) + "&otp=" + enc(code);
        HttpRequest req = HttpRequest.newBuilder(URI.create(url))
                .timeout(Duration.ofSeconds(10))
                // Key in a header, not the query string, so it never lands in proxy/access logs.
                .header("authkey", authKey)
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.noBody())
                .build();
        try {
            HttpResponse<String> res = http.send(req, HttpResponse.BodyHandlers.ofString());
            JsonNode data = res.body() == null || res.body().isBlank() ? null : json.readTree(res.body());
            if (data != null && "success".equals(data.path("type").asString())) {
                return Result.ok(data.path("request_id").asString());
            }
            String message = data != null && data.hasNonNull("message") ? data.get("message").asString() : "MSG91 OTP send failed";
            log.error("[MSG91] Send failed status={} message={}", res.statusCode(), message.replace(code, "[redacted]"));
            return Result.failed("MSG91 OTP send failed");
        } catch (IOException | RuntimeException e) {
            log.error("[MSG91] Request failed: {}", e.getClass().getSimpleName());
            return Result.failed("MSG91 OTP send failed");
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return Result.failed("MSG91 OTP send failed");
        }
    }

    private static String enc(String v) { return URLEncoder.encode(v, StandardCharsets.UTF_8); }
}
