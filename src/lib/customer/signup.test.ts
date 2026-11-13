import { describe, it, expect } from "vitest";
import { signupDetailsSchema, fieldErrors, maskEmail, matchIndianState } from "./signup";

const valid = {
  name: "Rahul Kumar",
  phone: "98765 43210",
  email: "Rahul.K@Example.com",
  password: "Tr@ctor-Bolt-42",
  address: "12B, MG Road, Lajpat Nagar",
  city: "New Delhi",
  state: "Delhi",
  pincode: "110024",
};

describe("signupDetailsSchema", () => {
  it("accepts a complete signup and normalises the email", () => {
    const r = signupDetailsSchema.safeParse(valid);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.email).toBe("rahul.k@example.com");
  });

  it("rejects a weak password on the password field, even when other fields are also wrong", () => {
    const r = signupDetailsSchema.safeParse({ ...valid, password: "short", pincode: "12" });
    expect(r.success).toBe(false);
    if (!r.success) {
      const errs = fieldErrors(r.error);
      expect(errs.password).toBeTruthy();
      expect(errs.pincode).toBeTruthy();
    }
  });

  it("rejects a password built from the customer's own name", () => {
    const r = signupDetailsSchema.safeParse({ ...valid, password: "Rahul12345" });
    expect(r.success).toBe(false);
    if (!r.success) expect(fieldErrors(r.error).password).toMatch(/easy to guess/);
  });

  it("rejects the phone-only placeholder email and an unknown state", () => {
    const r = signupDetailsSchema.safeParse({ ...valid, email: "9876543210@phone.motoxplus.invalid", state: "Narnia" });
    expect(r.success).toBe(false);
    if (!r.success) {
      const errs = fieldErrors(r.error);
      expect(errs.email).toBeTruthy();
      expect(errs.state).toBeTruthy();
    }
  });
});

describe("helpers", () => {
  it("masks an email without revealing the local part", () => {
    expect(maskEmail("rahul.k@gmail.com")).toBe("ra•••••@gmail.com");
  });

  it("maps geocoder state spellings onto the form's list", () => {
    expect(matchIndianState("NCT of Delhi")).toBe("Delhi");
    expect(matchIndianState("orissa")).toBe("Odisha");
    expect(matchIndianState("Atlantis")).toBeUndefined();
  });
});
