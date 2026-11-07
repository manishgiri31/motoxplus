package com.motoxplus.api.notify.otp;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.net.http.HttpTimeoutException;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * OTP over the WhatsApp Cloud API using the approved Authentication template with a Copy Code button
 * (port of src/lib/sms/providers/whatsapp.ts: same payload, same error classification, same redaction).
 */
public class WhatsAppOtpSender implements OtpSender {
    private static final Logger log = LoggerFactory.getLogger(WhatsAppOtpSender.class);

    private final String accessToken;
    private final String phoneNumberId;
    private final String templateName;
    private final String templateLanguage;
    private final String graphBaseUrl;
    private final JsonMapper json;
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();

    public WhatsAppOtpSender(String accessToken, String phoneNumberId, String templateName, String templateLanguage,
                             String graphBaseUrl, JsonMapper json) {
        this.accessToken = blankToEmpty(accessToken);
        this.phoneNumberId = blankToEmpty(phoneNumberId);
        this.templateName = templateName == null || templateName.isBlank() ? "login_otp" : templateName.trim();
        this.templateLanguage = templateLanguage == null || templateLanguage.isBlank() ? "en" : templateLanguage.trim();
        this.graphBaseUrl = graphBaseUrl.replaceAll("/+$", "");
        this.json = json;
    }

    @Override public String name() { return "whatsapp"; }

    @Override public boolean isConfigured() {
        return !OtpSenders.isPlaceholder(accessToken) && !OtpSenders.isPlaceholder(phoneNumberId);
    }

    @Override
    public Result send(String e164Mobile, String code) {
        if (!isConfigured()) return Result.failed("WhatsApp credentials not configured");
        if (e164Mobile == null || !e164Mobile.startsWith("+") || e164Mobile.length() < 8) {
            return Result.failed("Recipient number must be in E.164 format");
        }

        Map<String, Object> body = Map.of(
                "messaging_product", "whatsapp",
                "recipient_type", "individual",
                "to", e164Mobile.substring(1),
                "type", "template",
                "template", Map.of(
                        "name", templateName,
                        "language", Map.of("code", templateLanguage),
                        "components", List.of(
                                Map.of("type", "body", "parameters", List.of(Map.of("type", "text", "text", code))),
                                Map.of("type", "button", "sub_type", "url", "index", "0",
                                        "parameters", List.of(Map.of("type", "text", "text", code))))));

        HttpRequest req = HttpRequest.newBuilder(URI.create(graphBaseUrl + "/" + phoneNumberId + "/messages"))
                .timeout(Duration.ofSeconds(10))
                .header("Authorization", "Bearer " + accessToken)
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(json.writeValueAsString(body)))
                .build();
        try {
            HttpResponse<String> res = http.send(req, HttpResponse.BodyHandlers.ofString());
            JsonNode data = parse(res.body());
            JsonNode first = data == null ? null : data.path("messages").path(0);
            if (res.statusCode() / 100 == 2 && first != null && first.hasNonNull("id")) {
                log.info("[WhatsApp] Send accepted messageId={}", first.get("id").asString());
                return Result.ok(first.get("id").asString());
            }
            JsonNode err = data == null ? null : data.path("error");
            Integer errCode = err != null && err.hasNonNull("code") ? err.get("code").asInt() : null;
            Integer subcode = err != null && err.hasNonNull("error_subcode") ? err.get("error_subcode").asInt() : null;
            String raw = err != null && err.hasNonNull("message") ? err.get("message").asString() : "";
            log.error("[WhatsApp] Send failed status={} code={} subcode={} message={}", res.statusCode(), errCode, subcode,
                    raw.replace(code, "[redacted]").replace(accessToken, "[redacted]"));
            return Result.failed(classify(res.statusCode(), errCode, subcode));
        } catch (HttpTimeoutException e) {
            log.error("[WhatsApp] Request timed out");
            return Result.failed("WhatsApp API request timed out");
        } catch (IOException e) {
            log.error("[WhatsApp] Request failed: {}", e.getClass().getSimpleName());
            return Result.failed("WhatsApp API request failed");
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return Result.failed("WhatsApp API request failed");
        }
    }

    static String classify(int status, Integer code, Integer subcode) {
        int c = code == null ? -1 : code;
        int s = subcode == null ? -1 : subcode;
        if (status == 401 || c == 190) return "WhatsApp access token invalid or expired";
        if (c == 100 && s == 33) return "WhatsApp phone number ID invalid";
        if (c == 132000 || c == 132001) return "WhatsApp template not found or not approved";
        if (c == 132005 || c == 132012) return "WhatsApp template parameter mismatch";
        if (status == 429 || c == 4 || c == 80007) return "WhatsApp API rate limit exceeded";
        if (c == 131026) return "Recipient not reachable on WhatsApp";
        if (c == 131047) return "Recipient has not opted in to WhatsApp messages";
        if (c == 131009) return "Recipient phone number invalid";
        return "WhatsApp API request failed";
    }

    private JsonNode parse(String body) {
        try {
            return body == null || body.isBlank() ? null : json.readTree(body);
        } catch (RuntimeException e) {
            return null;
        }
    }

    private static String blankToEmpty(String v) { return v == null ? "" : v.trim(); }
}
