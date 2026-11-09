package com.motoxplus.api.gst;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Locale;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * GSTIN lookup through Cashfree's Secure ID "Verify GSTIN" API ({@code POST {base}/gstin}), which queries the
 * GSTN taxpayer register. Credentials are the Verification-suite client id/secret, which are separate from
 * payment-gateway keys.
 *
 * Fails safe: anything other than a clear answer from the registry is {@link GstinLookup.Outcome#UNAVAILABLE},
 * so a provider outage can never mark a GSTIN valid, and can never reject a genuine dealer either.
 */
public class CashfreeGstinLookup implements GstinLookup {
    private static final Logger log = LoggerFactory.getLogger(CashfreeGstinLookup.class);

    private final String clientId;
    private final String clientSecret;
    private final String baseUrl;
    private final JsonMapper json;
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();

    public CashfreeGstinLookup(String clientId, String clientSecret, String baseUrl, JsonMapper json) {
        this.clientId = clientId == null ? "" : clientId.trim();
        this.clientSecret = clientSecret == null ? "" : clientSecret.trim();
        this.baseUrl = baseUrl.replaceAll("/+$", "");
        this.json = json;
    }

    @Override public String name() { return "cashfree"; }

    @Override public boolean isConfigured() {
        return !clientId.isEmpty() && !clientSecret.isEmpty();
    }

    @Override
    public Result lookup(String gstin) {
        if (!isConfigured()) return Result.unavailable();
        HttpRequest req = HttpRequest.newBuilder(URI.create(baseUrl + "/gstin"))
                .timeout(Duration.ofSeconds(10))
                .header("x-client-id", clientId)
                .header("x-client-secret", clientSecret)
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(json.writeValueAsString(Map.of("GSTIN", gstin))))
                .build();
        try {
            HttpResponse<String> res = http.send(req, HttpResponse.BodyHandlers.ofString());
            if (res.statusCode() != 200) {
                // 4xx here is a request/auth/quota problem on our side (the GSTIN was pre-validated), 5xx is theirs.
                log.warn("[GSTIN] {} lookup HTTP {}", name(), res.statusCode());
                return Result.unavailable();
            }
            return parse(json.readTree(res.body()));
        } catch (IOException | RuntimeException e) {
            log.warn("[GSTIN] {} lookup failed: {}", name(), e.getClass().getSimpleName());
            return Result.unavailable();
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return Result.unavailable();
        }
    }

    static Result parse(JsonNode data) {
        if (data == null || !data.has("valid")) return Result.unavailable();
        if (!data.path("valid").asBoolean(false)) return Result.notFound();
        String status = text(data, "gst_in_status");
        if (status == null) return Result.unavailable();
        Outcome outcome = "active".equals(status.toLowerCase(Locale.ROOT)) ? Outcome.ACTIVE : Outcome.INACTIVE;
        return new Result(outcome, text(data, "legal_name_of_business"), text(data, "trade_name_of_business"), status,
                text(data, "principal_place_address"));
    }

    private static String text(JsonNode data, String field) {
        JsonNode n = data.get(field);
        if (n == null || n.isNull()) return null;
        String s = n.asString().trim();
        return s.isEmpty() ? null : s;
    }
}
