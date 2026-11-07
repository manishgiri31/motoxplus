package com.motoxplus.api.notify.email;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * Transactional email through Resend's REST API (port of src/lib/email/index.ts sendEmail).
 *
 * Same contract as Node: when RESEND_API_KEY or EMAIL_FROM is missing the send is skipped (logged, not thrown),
 * so local development works without credentials; a Resend error is thrown so callers can decide.
 */
@Service
public class EmailService {
    private static final Logger log = LoggerFactory.getLogger(EmailService.class);
    static final String FROM_NAME = "MOTOXPLUS India";

    public record Result(String id, boolean skipped) {}

    public static class EmailException extends RuntimeException {
        public EmailException(String message) { super(message); }
        public EmailException(String message, Throwable cause) { super(message, cause); }
    }

    private final String apiKey;
    private final String from;
    private final String baseUrl;
    private final JsonMapper json;
    private final HttpClient http;

    public EmailService(
            @Value("${app.email.resend-api-key:}") String apiKey,
            @Value("${app.email.from:}") String from,
            @Value("${app.email.resend-base-url:https://api.resend.com}") String baseUrl,
            JsonMapper json) {
        this.apiKey = apiKey == null ? "" : apiKey.trim();
        this.from = from == null ? "" : from.trim();
        this.baseUrl = baseUrl.replaceAll("/+$", "");
        this.json = json;
        this.http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();
    }

    public boolean isConfigured() {
        return !apiKey.isEmpty() && !from.isEmpty();
    }

    public Result send(String to, String subject, String html) {
        return send(to, subject, html, null);
    }

    /** @param idempotencyKey optional; Resend drops a repeat send with the same key for 24 h. */
    public Result send(String to, String subject, String html, String idempotencyKey) {
        if (!isConfigured()) {
            log.warn("[Email] RESEND_API_KEY/EMAIL_FROM not set - skipping email '{}'", subject);
            return new Result("skipped", true);
        }

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("from", FROM_NAME + " <" + from + ">");
        body.put("to", to);
        body.put("subject", subject);
        body.put("html", html);

        HttpRequest.Builder req = HttpRequest.newBuilder(URI.create(baseUrl + "/emails"))
                .timeout(Duration.ofSeconds(15))
                .header("Authorization", "Bearer " + apiKey)
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(json.writeValueAsString(body)));
        if (idempotencyKey != null && !idempotencyKey.isBlank()) req.header("Idempotency-Key", idempotencyKey);

        HttpResponse<String> res;
        try {
            res = http.send(req.build(), HttpResponse.BodyHandlers.ofString());
        } catch (IOException e) {
            throw new EmailException("Failed to send email", e);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new EmailException("Email send interrupted", e);
        }

        JsonNode node = parse(res.body());
        if (res.statusCode() / 100 != 2) {
            String message = node != null && node.hasNonNull("message") ? node.get("message").asString() : "Resend API error";
            // Recipient address is personal data: log status + Resend's message only.
            log.error("[Email] Resend rejected '{}': HTTP {} {}", subject, res.statusCode(), message);
            throw new EmailException(message);
        }
        String id = node != null && node.hasNonNull("id") ? node.get("id").asString() : "";
        log.info("[Email] Sent '{}' id={}", subject, id);
        return new Result(id, false);
    }

    private JsonNode parse(String body) {
        try {
            return body == null || body.isBlank() ? null : json.readTree(body);
        } catch (RuntimeException e) {
            return null;
        }
    }
}
