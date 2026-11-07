package com.motoxplus.api.notify;

import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CopyOnWriteArrayList;

/** Tiny local HTTP server for provider tests: records every request and answers with a canned response. */
public final class FakeHttp implements AutoCloseable {
    public record Request(String method, String path, String query, Map<String, List<String>> headers, byte[] body) {
        public String bodyText() { return new String(body, StandardCharsets.UTF_8); }
        public String header(String name) {
            return headers.entrySet().stream().filter(e -> e.getKey().equalsIgnoreCase(name))
                    .map(e -> e.getValue().get(0)).findFirst().orElse(null);
        }
    }

    private final HttpServer server;
    public final List<Request> requests = new CopyOnWriteArrayList<>();
    private volatile int status = 200;
    private volatile String body = "{}";

    public FakeHttp() throws IOException {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/", ex -> {
            byte[] in = ex.getRequestBody().readAllBytes();
            requests.add(new Request(ex.getRequestMethod(), ex.getRequestURI().getPath(), ex.getRequestURI().getRawQuery(),
                    Map.copyOf(ex.getRequestHeaders()), in));
            byte[] out = body.getBytes(StandardCharsets.UTF_8);
            ex.getResponseHeaders().add("Content-Type", "application/json");
            ex.sendResponseHeaders(status, out.length == 0 ? -1 : out.length);
            if (out.length > 0) ex.getResponseBody().write(out);
            ex.close();
        });
        server.start();
    }

    public FakeHttp respond(int status, String body) {
        this.status = status;
        this.body = body;
        return this;
    }

    public String url() { return "http://127.0.0.1:" + server.getAddress().getPort(); }

    public Request last() { return requests.get(requests.size() - 1); }

    @Override public void close() { server.stop(0); }
}
