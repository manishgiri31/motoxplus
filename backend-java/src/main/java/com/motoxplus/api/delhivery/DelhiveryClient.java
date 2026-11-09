package com.motoxplus.api.delhivery;

import java.io.IOException;
import java.net.ConnectException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpConnectTimeoutException;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * Delhivery B2C (track.delhivery.com) calls the Java API needs: pincode serviceability (read, live-verified, see
 * delhivery-reference.md "1. Pincode serviceability") and warehouse creation (write).
 *
 * <p>Secrets: the token and base URL come only from the environment ({@code DELHIVERY_TOKEN},
 * {@code DELHIVERY_BASE_URL}). The token is never logged and is scrubbed from every message this class returns.
 *
 * <p>Writes: {@link #createWarehouse} sends nothing unless {@code DELHIVERY_ALLOW_WRITES=true} AND the endpoint spec
 * has been filled in from the portal curl ({@link DelhiveryWarehouseSpec#complete()}). Reads are always allowed.
 */
public class DelhiveryClient {
    private static final Logger log = LoggerFactory.getLogger(DelhiveryClient.class);
    private static final int MAX_MESSAGE = 300;

    private final String baseUrl;
    private final String token;
    private final boolean allowWrites;
    private final DelhiveryWarehouseSpec spec;
    private final JsonMapper json;
    private final HttpClient http;

    public DelhiveryClient(String baseUrl, String token, boolean allowWrites, DelhiveryWarehouseSpec spec, JsonMapper json) {
        this.baseUrl = baseUrl == null ? "" : baseUrl.trim().replaceAll("/+$", "");
        this.token = token == null ? "" : token.trim();
        this.allowWrites = allowWrites;
        this.spec = spec == null ? DelhiveryWarehouseSpec.UNCONFIGURED : spec;
        this.json = json;
        this.http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();
    }

    public boolean hasToken() { return !token.isEmpty() && !baseUrl.isEmpty(); }
    public boolean writesAllowed() { return allowWrites; }
    public DelhiveryWarehouseSpec spec() { return spec; }

    /** For logs: "****" plus the last 4 characters, never more. */
    public static String mask(String secret) {
        if (secret == null || secret.isBlank()) return "(unset)";
        String s = secret.trim();
        return s.length() <= 8 ? "****" : "****" + s.substring(s.length() - 4);
    }

    // ------------------------------------------------------------------ serviceability (read)

    /** One pincode's capabilities. {@code pickup} is what a warehouse needs: Delhivery collects from this PIN. */
    public record PinCapability(String pin, boolean pickup, boolean prepaid, boolean cod, String district, String stateCode) {}

    /** The call itself failed (no token, network, non-200). Distinct from "not serviceable", which is an empty result. */
    public static class UnavailableException extends RuntimeException {
        public UnavailableException(String message) { super(message); }
    }

    /**
     * GET /c/api/pin-codes/json/?filter_codes=PIN. Empty when Delhivery does not serve the PIN at all (it answers 200
     * with an empty delivery_codes array, not an error).
     */
    public Optional<PinCapability> pinCapability(String pin) {
        if (!hasToken()) throw new UnavailableException("DELHIVERY_TOKEN / DELHIVERY_BASE_URL not set");
        HttpRequest req = HttpRequest.newBuilder(URI.create(baseUrl + "/c/api/pin-codes/json/?filter_codes="
                        + URLEncoder.encode(pin, StandardCharsets.UTF_8)))
                .timeout(Duration.ofSeconds(10))
                .header("Authorization", "Token " + token)
                .header("Accept", "application/json")
                .GET().build();
        HttpResponse<String> res;
        try {
            res = http.send(req, HttpResponse.BodyHandlers.ofString());
        } catch (IOException e) {
            log.warn("[Delhivery] pincode check failed: {}", e.getClass().getSimpleName());
            throw new UnavailableException("Delhivery could not be reached");
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new UnavailableException("interrupted");
        }
        if (res.statusCode() != 200) {
            log.warn("[Delhivery] pincode check HTTP {}", res.statusCode());
            throw new UnavailableException("Delhivery answered HTTP " + res.statusCode());
        }
        JsonNode entry;
        try {
            entry = json.readTree(res.body()).path("delivery_codes").path(0).path("postal_code");
        } catch (RuntimeException e) {
            throw new UnavailableException("Delhivery's pincode answer could not be read");
        }
        if (entry.isMissingNode() || entry.isNull()) return Optional.empty();
        return Optional.of(new PinCapability(pin, yes(entry, "pickup"), yes(entry, "pre_paid"), yes(entry, "cod"),
                entry.path("district").asString(""), entry.path("state_code").asString("")));
    }

    private static boolean yes(JsonNode n, String field) {
        return "Y".equals(n.path(field).asString(""));
    }

    // ------------------------------------------------------------------ warehouse (write)

    public record WarehouseRequest(String name, String address, String pin, String city, String state, String phone,
                                   String email, String returnAddress, String returnPin, String returnCity,
                                   String returnState, String gstin) {}

    public enum Outcome {
        /** Delhivery created it. */
        CREATED,
        /** Delhivery answered with the exact "already exists" error: an earlier attempt of ours created it. */
        ALREADY_EXISTS,
        /** Delhivery refused the request (4xx): nothing was created, the details may be corrected. */
        REJECTED,
        /** Nothing was sent (writes off, endpoint not configured, no token) or it never reached Delhivery. */
        NOT_SENT,
        /** It may or may not exist now (timeout, 5xx, unreadable 2xx). Retry with the SAME name only. */
        UNCERTAIN;

        public boolean active() { return this == CREATED || this == ALREADY_EXISTS; }
    }

    /** {@code name} is the warehouse name to use from now on; {@code message} is safe to store and show (no token). */
    public record CreateResult(Outcome outcome, String name, String message, Integer httpStatus) {}

    public CreateResult createWarehouse(WarehouseRequest r) {
        if (!hasToken()) return notSent(r, "DELHIVERY_TOKEN / DELHIVERY_BASE_URL not set");
        if (!allowWrites) return notSent(r, "Delhivery writes are switched off (DELHIVERY_ALLOW_WRITES is not true)");
        if (!spec.complete()) return notSent(r, "Delhivery warehouse API not configured yet (missing: " + spec.missing() + ")");
        if (r.name().length() > spec.nameMaxLength()) {
            return notSent(r, "Warehouse name is longer than Delhivery's limit of " + spec.nameMaxLength());
        }

        HttpRequest req = HttpRequest.newBuilder(URI.create(baseUrl + spec.createPath()))
                .timeout(Duration.ofSeconds(20))
                .header("Authorization", "Token " + token)
                .header("Accept", "application/json")
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(json.writeValueAsString(warehousePayload(r))))
                .build();
        HttpResponse<String> res;
        try {
            res = http.send(req, HttpResponse.BodyHandlers.ofString());
        } catch (ConnectException | HttpConnectTimeoutException e) {
            log.warn("[Delhivery] warehouse {} not sent: {}", r.name(), e.getClass().getSimpleName());
            return notSent(r, "Delhivery could not be reached");
        } catch (IOException e) {
            // The request may have arrived and been processed before the connection broke.
            log.warn("[Delhivery] warehouse {} outcome unknown: {}", r.name(), e.getClass().getSimpleName());
            return new CreateResult(Outcome.UNCERTAIN, r.name(), "No answer from Delhivery (" + e.getClass().getSimpleName() + ")", null);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return new CreateResult(Outcome.UNCERTAIN, r.name(), "Interrupted while waiting for Delhivery", null);
        }
        CreateResult result = interpret(r.name(), res.statusCode(), res.body());
        log.info("[Delhivery] warehouse {} -> {} (HTTP {})", r.name(), result.outcome(), res.statusCode());
        return result;
    }

    /**
     * Reads Delhivery's answer. The "already exists" case is recognised ONLY by the exact error text from the portal
     * ({@link DelhiveryWarehouseSpec#existsError()}), never by a loose pattern, so an unrelated refusal can never mark a
     * warehouse ACTIVE.
     */
    CreateResult interpret(String requestedName, int status, String body) {
        String text = body == null ? "" : body;
        String message = clip(scrub(text));
        if (text.contains(spec.existsError())) {
            return new CreateResult(Outcome.ALREADY_EXISTS, requestedName, message, status);
        }
        if (status == 401 || status == 403 || status == 429) {
            return new CreateResult(Outcome.NOT_SENT, requestedName, "Delhivery refused the call (HTTP " + status + ")", status);
        }
        if (status >= 400 && status < 500) return new CreateResult(Outcome.REJECTED, requestedName, message, status);
        if (status < 200 || status >= 300) return new CreateResult(Outcome.UNCERTAIN, requestedName, "Delhivery error HTTP " + status, status);

        JsonNode root;
        try {
            root = json.readTree(text);
        } catch (RuntimeException e) {
            return new CreateResult(Outcome.UNCERTAIN, requestedName, "Unreadable answer from Delhivery: " + message, status);
        }
        JsonNode success = root.path("success");
        if (success.isBoolean() && !success.asBoolean()) {
            return new CreateResult(Outcome.REJECTED, requestedName, message, status);
        }
        if (!success.isBoolean() || !success.asBoolean()) {
            // 2xx without an explicit success flag: we cannot tell, so the name is kept and only a retry is allowed.
            return new CreateResult(Outcome.UNCERTAIN, requestedName, "Delhivery's answer did not confirm the warehouse: " + message, status);
        }
        String name = firstText(root, "name", "data.name");
        return new CreateResult(Outcome.CREATED, name == null ? requestedName : name, "Created", status);
    }

    /**
     * Request body for the create call.
     *
     * <p><b>UNVERIFIED — TODO_FROM_PORTAL_CURL.</b> These keys must be checked one by one against the body of the
     * portal's "Create & Update Warehouse" curl before {@code app.delhivery.warehouse.create-path} is set. Until that
     * path is set this body is never sent.
     */
    static Map<String, Object> warehousePayload(WarehouseRequest r) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("name", r.name());
        m.put("phone", r.phone());
        m.put("email", r.email());
        m.put("address", r.address());
        m.put("city", r.city());
        m.put("pin", r.pin());
        m.put("country", "India");
        m.put("return_address", r.returnAddress());
        m.put("return_pin", r.returnPin());
        m.put("return_city", r.returnCity());
        m.put("return_state", r.returnState());
        m.put("return_country", "India");
        return m;
    }

    private CreateResult notSent(WarehouseRequest r, String why) {
        return new CreateResult(Outcome.NOT_SENT, r.name(), why, null);
    }

    /** Removes the token from anything that might be stored or shown. */
    String scrub(String s) {
        return token.isEmpty() || s == null ? s : s.replace(token, mask(token));
    }

    private static String clip(String s) {
        String one = s == null ? "" : s.strip().replaceAll("\\s+", " ");
        return one.length() <= MAX_MESSAGE ? one : one.substring(0, MAX_MESSAGE) + "…";
    }

    private static String firstText(JsonNode root, String... paths) {
        for (String p : paths) {
            JsonNode n = root;
            for (String part : p.split("\\.")) n = n.path(part);
            if (n.isString() && !n.asString().isBlank()) return n.asString().trim();
        }
        return null;
    }
}
