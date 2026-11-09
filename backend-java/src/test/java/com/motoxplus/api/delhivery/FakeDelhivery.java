package com.motoxplus.api.delhivery;

import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentLinkedQueue;
import java.util.concurrent.CopyOnWriteArrayList;

/**
 * Local stand-in for track.delhivery.com: pincode serviceability plus a scripted warehouse-create endpoint. Records every
 * call so a test can assert what was (and was not) sent. Never talks to the real Delhivery.
 */
public final class FakeDelhivery implements AutoCloseable {
    /** Test-only values standing in for the portal curl (the real ones are not known yet). */
    public static final String CREATE_PATH = "/test-only/warehouse/create/";
    public static final String EXISTS_ERROR = "TEST-ONLY: warehouse name already exists";
    public static final int NAME_MAX = 30;
    public static final String TOKEN = "test-token-0123456789abcdef";

    public record Call(String method, String path, String query, String authorization, String body) {}
    public record Reply(int status, String body) {}

    private final HttpServer server;
    public final List<Call> calls = new CopyOnWriteArrayList<>();
    /** PIN -> postal_code JSON object, or "" for "not served at all". PINs not listed are served with pickup. */
    public final Map<String, String> pins = new ConcurrentHashMap<>();
    /** Answers for successive create calls; when empty, the call succeeds and echoes the name. */
    public final ConcurrentLinkedQueue<Reply> createReplies = new ConcurrentLinkedQueue<>();

    public FakeDelhivery() throws IOException {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/", ex -> {
            String body = new String(ex.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
            String path = ex.getRequestURI().getPath();
            String query = ex.getRequestURI().getQuery();
            calls.add(new Call(ex.getRequestMethod(), path, query, ex.getRequestHeaders().getFirst("Authorization"), body));
            Reply reply;
            if ("GET".equals(ex.getRequestMethod()) && path.equals("/c/api/pin-codes/json/")) {
                String pin = query == null ? "" : query.replace("filter_codes=", "");
                String postal = pins.containsKey(pin) ? pins.get(pin) : postal(pin, "Y");
                reply = new Reply(200, postal == null || postal.isEmpty()
                        ? "{\"delivery_codes\":[]}"
                        : "{\"delivery_codes\":[{\"postal_code\":" + postal + "}]}");
            } else if ("POST".equals(ex.getRequestMethod()) && path.equals(CREATE_PATH)) {
                Reply next = createReplies.poll();
                reply = next != null ? next : new Reply(200, "{\"success\":true,\"name\":" + nameFrom(body) + "}");
            } else {
                reply = new Reply(404, "{\"error\":\"not found\"}");
            }
            byte[] out = reply.body().getBytes(StandardCharsets.UTF_8);
            ex.getResponseHeaders().add("Content-Type", "application/json");
            ex.sendResponseHeaders(reply.status(), out.length);
            ex.getResponseBody().write(out);
            ex.close();
        });
        server.start();
    }

    /** Same shape as the live capture in delhivery-reference.md ("1. Pincode serviceability"). */
    public static String postal(String pin, String pickup) {
        return """
                {"remarks":"","pin":%s,"country_code":"IN","state_code":"DL","cod":"Y","pre_paid":"Y","pickup":"%s","cash":"Y",
                 "repl":"Y","district":"New Delhi","is_oda":"N","sort_code":"DEL/OKH"}""".formatted(pin.isEmpty() ? "0" : pin, pickup);
    }

    private static String nameFrom(String body) {
        int i = body.indexOf("\"name\":\"");
        if (i < 0) return "null";
        int end = body.indexOf('"', i + 8);
        return "\"" + body.substring(i + 8, end) + "\"";
    }

    public List<Call> creates() {
        return calls.stream().filter(c -> c.path().equals(CREATE_PATH)).toList();
    }

    public void reset() {
        calls.clear();
        pins.clear();
        createReplies.clear();
    }

    public String url() {
        return "http://127.0.0.1:" + server.getAddress().getPort();
    }

    public DelhiveryWarehouseSpec spec() {
        return new DelhiveryWarehouseSpec(CREATE_PATH, EXISTS_ERROR, NAME_MAX);
    }

    @Override
    public void close() {
        server.stop(0);
    }
}
