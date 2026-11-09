package com.motoxplus.api.gst;

import com.motoxplus.api.web.ApiException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RestController;

/**
 * Server-to-server GSTIN check used by the Next.js dealer registration routes (src/lib/gst/verify-gstin.ts)
 * until those routes are ported here. Not a public endpoint: Nginx sends /api/* (other than the Java
 * locations it lists) to Node, Java listens on 127.0.0.1 only, and every call must carry INTERNAL_API_TOKEN.
 */
@RestController
public class InternalGstinController {

    public record VerifyRequest(String gstin) {}

    private final GstinVerificationService service;
    private final byte[] token;

    public InternalGstinController(GstinVerificationService service, @Value("${app.internal.token:}") String token) {
        this.service = service;
        this.token = token == null ? new byte[0] : token.trim().getBytes(StandardCharsets.UTF_8);
    }

    @PostMapping("/api/internal/gstin/verify")
    public Map<String, Object> verify(@RequestHeader(value = "X-Internal-Token", required = false) String presented,
                                      @RequestBody(required = false) VerifyRequest body) {
        if (token.length < 32 || presented == null
                || !MessageDigest.isEqual(token, presented.trim().getBytes(StandardCharsets.UTF_8))) {
            throw new ApiException(HttpStatus.NOT_FOUND, "Not found");
        }
        if (body == null || body.gstin() == null || body.gstin().isBlank()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "GSTIN is required");
        }
        GstinVerificationService.Verification v = service.verify(body.gstin());
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("gstin", v.gstin());
        out.put("status", v.status().name());
        out.put("legalName", v.legalName());
        out.put("tradeName", v.tradeName());
        out.put("registrationStatus", v.registrationStatus());
        out.put("principalAddress", v.principalAddress());
        return out;
    }
}
