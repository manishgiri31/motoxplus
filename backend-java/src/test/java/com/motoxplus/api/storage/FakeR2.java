package com.motoxplus.api.storage;

import com.sun.net.httpserver.HttpServer;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;

/**
 * In-memory stand-in for an R2/S3 endpoint (path-style "/bucket/key"): PUT stores, GET returns, DELETE removes, so a
 * test can upload a file and read the same bytes back. Never touches a real bucket.
 */
public final class FakeR2 implements AutoCloseable {
    public record Call(String method, String path) {}

    private final HttpServer server;
    public final Map<String, byte[]> objects = new ConcurrentHashMap<>();
    public final List<Call> calls = new CopyOnWriteArrayList<>();

    public FakeR2() throws IOException {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/", ex -> {
            String path = ex.getRequestURI().getPath();
            calls.add(new Call(ex.getRequestMethod(), path));
            byte[] in = ex.getRequestBody().readAllBytes();
            switch (ex.getRequestMethod()) {
                case "PUT" -> {
                    String sha = ex.getRequestHeaders().getFirst("x-amz-content-sha256");
                    String enc = ex.getRequestHeaders().getFirst("Content-Encoding");
                    boolean chunked = (sha != null && sha.startsWith("STREAMING-")) || (enc != null && enc.contains("aws-chunked"));
                    byte[] stored = chunked ? decodeAwsChunked(in) : in;
                    objects.put(path, stored);
                    ex.getResponseHeaders().add("ETag", "\"" + md5(stored) + "\""); // the SDK checks it, as S3/R2 return it
                    ex.sendResponseHeaders(200, -1);
                }
                case "GET" -> {
                    byte[] body = objects.get(path);
                    if (body == null) {
                        byte[] err = "<?xml version=\"1.0\"?><Error><Code>NoSuchKey</Code><Message>missing</Message></Error>"
                                .getBytes(StandardCharsets.UTF_8);
                        ex.getResponseHeaders().add("Content-Type", "application/xml");
                        ex.sendResponseHeaders(404, err.length);
                        ex.getResponseBody().write(err);
                    } else {
                        ex.getResponseHeaders().add("Content-Type", "application/octet-stream");
                        ex.getResponseHeaders().add("ETag", "\"" + md5(body) + "\"");
                        ex.sendResponseHeaders(200, body.length);
                        ex.getResponseBody().write(body);
                    }
                }
                case "DELETE" -> {
                    objects.remove(path);
                    ex.sendResponseHeaders(204, -1);
                }
                default -> ex.sendResponseHeaders(405, -1);
            }
            ex.close();
        });
        server.start();
    }

    public String url() { return "http://127.0.0.1:" + server.getAddress().getPort(); }

    /** "hex-size[;chunk-signature=...]\r\n data \r\n" ... "0...\r\n" (optionally followed by trailers). */
    static byte[] decodeAwsChunked(byte[] in) {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        int i = 0;
        while (i < in.length) {
            int lineEnd = indexOfCrlf(in, i);
            if (lineEnd < 0) break;
            String header = new String(in, i, lineEnd - i, StandardCharsets.US_ASCII);
            int size = Integer.parseInt(header.split(";", 2)[0].trim(), 16);
            i = lineEnd + 2;
            if (size == 0) break;
            out.write(in, i, size);
            i += size + 2; // data + CRLF
        }
        return out.toByteArray();
    }

    private static String md5(byte[] b) {
        try {
            return java.util.HexFormat.of().formatHex(java.security.MessageDigest.getInstance("MD5").digest(b));
        } catch (java.security.NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    private static int indexOfCrlf(byte[] b, int from) {
        for (int i = from; i + 1 < b.length; i++) if (b[i] == '\r' && b[i + 1] == '\n') return i;
        return -1;
    }

    @Override public void close() { server.stop(0); }
}
