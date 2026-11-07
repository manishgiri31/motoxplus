package com.motoxplus.api.common;

import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.HexFormat;
import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Field-level encryption, byte-compatible with src/lib/crypto/encryption.ts: AES-256-GCM, 12-byte IV, 16-byte tag,
 * stored as {@code base64(iv) "." base64(tag) "." base64(ciphertext)}. ENCRYPTION_KEY is 64 hex chars or base64 of
 * 32 bytes, exactly as Node reads it. Without a key, encryption fails closed instead of storing plaintext.
 */
@Component
public class FieldCrypto {
    private static final int IV_BYTES = 12;
    private static final int TAG_BITS = 128;
    private static final SecureRandom RANDOM = new SecureRandom();

    public static class CryptoUnavailableException extends RuntimeException {
        public CryptoUnavailableException(String message) { super(message); }
    }

    private final byte[] key;

    public FieldCrypto(@Value("${app.crypto.encryption-key:}") String raw) {
        this.key = decodeKey(raw);
    }

    static byte[] decodeKey(String raw) {
        if (raw == null || raw.isBlank()) return null;
        String v = raw.trim();
        byte[] k;
        try {
            k = v.length() == 64 ? HexFormat.of().parseHex(v) : Base64.getDecoder().decode(v);
        } catch (IllegalArgumentException e) {
            return null;
        }
        return k.length == 32 ? k : null;
    }

    public boolean isConfigured() { return key != null; }

    public String encrypt(String plain) {
        if (key == null) throw new CryptoUnavailableException("ENCRYPTION_KEY is not set or is not 32 bytes");
        try {
            byte[] iv = new byte[IV_BYTES];
            RANDOM.nextBytes(iv);
            Cipher c = Cipher.getInstance("AES/GCM/NoPadding");
            c.init(Cipher.ENCRYPT_MODE, new SecretKeySpec(key, "AES"), new GCMParameterSpec(TAG_BITS, iv));
            byte[] out = c.doFinal(plain.getBytes(StandardCharsets.UTF_8)); // ciphertext || tag
            int tagLen = TAG_BITS / 8;
            ByteBuffer buf = ByteBuffer.wrap(out);
            byte[] cipherText = new byte[out.length - tagLen];
            byte[] tag = new byte[tagLen];
            buf.get(cipherText).get(tag);
            Base64.Encoder b64 = Base64.getEncoder();
            return b64.encodeToString(iv) + "." + b64.encodeToString(tag) + "." + b64.encodeToString(cipherText);
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("encryption failed", e);
        }
    }

    /** Null when the payload is malformed, was encrypted with another key, or was tampered with. */
    public String decrypt(String payload) {
        if (key == null) throw new CryptoUnavailableException("ENCRYPTION_KEY is not set or is not 32 bytes");
        if (payload == null) return null;
        String[] parts = payload.split("\\.");
        if (parts.length != 3) return null;
        try {
            Base64.Decoder b64 = Base64.getDecoder();
            byte[] iv = b64.decode(parts[0]);
            byte[] tag = b64.decode(parts[1]);
            byte[] cipherText = b64.decode(parts[2]);
            byte[] joined = ByteBuffer.allocate(cipherText.length + tag.length).put(cipherText).put(tag).array();
            Cipher c = Cipher.getInstance("AES/GCM/NoPadding");
            c.init(Cipher.DECRYPT_MODE, new SecretKeySpec(key, "AES"), new GCMParameterSpec(TAG_BITS, iv));
            return new String(c.doFinal(joined), StandardCharsets.UTF_8);
        } catch (IllegalArgumentException | GeneralSecurityException e) {
            return null;
        }
    }
}
