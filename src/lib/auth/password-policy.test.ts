import { describe, it, expect } from "vitest";
import { evaluatePassword, validateNewPassword, PASSWORD_MAX_BYTES } from "./password-policy";
import { safeRedirectPath, safeCallbackTarget, landingPathForRole } from "./safe-redirect";

describe("validateNewPassword", () => {
  it("accepts a password meeting every rule", () => {
    expect(validateNewPassword("Tr@ctor-Bolt-42")).toBeNull();
  });

  it.each([
    ["too short", "Ab1"],
    ["no uppercase", "lowercase123"],
    ["no lowercase", "UPPERCASE123"],
    ["no digit", "NoDigitsHere"],
  ])("rejects %s", (_name, pw) => {
    expect(validateNewPassword(pw)).toMatch(/at least 8 characters/);
  });

  it("rejects empty and non-string input", () => {
    expect(validateNewPassword("")).toBe("Password is required");
    expect(validateNewPassword(undefined)).toBe("Password is required");
    expect(validateNewPassword(12345678)).toBe("Password is required");
  });

  it("rejects anything bcrypt would silently truncate", () => {
    expect(validateNewPassword("Aa1" + "x".repeat(PASSWORD_MAX_BYTES))).toMatch(/at most/);
    // 40 multi-byte chars = 83 bytes — over the cap even though length < 72
    expect(validateNewPassword("Aa1" + "é".repeat(40))).toMatch(/at most/);
  });

  it("rejects common and brand-derived passwords", () => {
    expect(validateNewPassword("Password123")).toMatch(/too easy/);
    expect(validateNewPassword("Motoxplus@2026")).toMatch(/too easy/);
  });

  it("rejects passwords built from the account's own email or name", () => {
    expect(validateNewPassword("Rahulsharma99", { email: "rahulsharma@shop.in" })).toMatch(/too easy/);
    expect(validateNewPassword("Suresh#2024x", { name: "Suresh Kumar" })).toMatch(/too easy/);
    expect(validateNewPassword("Tr@ctor-Bolt-42", { email: "rahul@shop.in", name: "Rahul K" })).toBeNull();
  });
});

describe("evaluatePassword", () => {
  it("scores progressively", () => {
    expect(evaluatePassword("").score).toBe(0);
    expect(evaluatePassword("abc").score).toBe(1);
    expect(evaluatePassword("Abcdefg1").score).toBe(2);
    expect(evaluatePassword("Abcdefghij12").score).toBe(3);
    expect(evaluatePassword("Abcdefghij12!").label).toBe("Strong");
  });

  it("never rates a guessable password above Weak", () => {
    expect(evaluatePassword("Password123").label).toBe("Weak");
  });
});

describe("safeRedirectPath", () => {
  const FB = "/dealer/dashboard";

  it("passes through in-app paths, queries and hashes", () => {
    expect(safeRedirectPath("/dealer/orders?page=2#top", FB)).toBe("/dealer/orders?page=2#top");
    expect(safeRedirectPath("/products/mudguard", FB)).toBe("/products/mudguard");
  });

  it.each([
    "https://evil.example",
    "http://evil.example/x",
    "//evil.example",
    "/\\evil.example",
    "/\t/evil.example",
    "javascript:alert(1)",
    "evil.example",
    "",
  ])("falls back for %j", (bad) => {
    expect(safeRedirectPath(bad, FB)).toBe(FB);
  });

  it("falls back for null/undefined and for auth-page loops", () => {
    expect(safeRedirectPath(null, FB)).toBe(FB);
    expect(safeRedirectPath(undefined, FB)).toBe(FB);
    expect(safeRedirectPath("/login?callbackUrl=/x", FB)).toBe(FB);
    expect(safeRedirectPath("/register", FB)).toBe(FB);
  });
});

describe("safeCallbackTarget", () => {
  const FB = "/account";

  it("keeps the deep link from NextAuth's absolute callbackUrl but drops the host", () => {
    expect(safeCallbackTarget("https://motoxplus.com/dealer/orders?page=2", FB)).toBe("/dealer/orders?page=2");
    expect(safeCallbackTarget("http://localhost:3000/dealer/dashboard", FB)).toBe("/dealer/dashboard");
  });

  it("never yields an off-site or script target", () => {
    // Host is discarded, so a bare foreign origin degrades to our own "/" — never to their site.
    expect(safeCallbackTarget("https://evil.example", FB)).toBe("/");
    expect(safeCallbackTarget("javascript:alert(1)", FB)).toBe(FB);
    expect(safeCallbackTarget("//evil.example/x", FB)).toBe(FB);
    expect(safeCallbackTarget("https://evil.example//evil2.example", FB)).toBe(FB);
    expect(safeCallbackTarget("data:text/html,<script>", FB)).toBe(FB);
  });
});

describe("landingPathForRole", () => {
  it("maps each role to its portal", () => {
    expect(landingPathForRole("DEALER")).toBe("/dealer/dashboard");
    expect(landingPathForRole("VENDOR")).toBe("/vendor/dashboard");
    expect(landingPathForRole("STAFF")).toBe("/admin/dashboard");
    expect(landingPathForRole("CUSTOMER")).toBe("/account");
    expect(landingPathForRole(undefined)).toBe("/");
  });
});
