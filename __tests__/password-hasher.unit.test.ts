import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/auth/password";

describe("Password_Hasher", () => {
  it("hashPassword returns a bcrypt hash (starts with $2)", async () => {
    const hash = await hashPassword("testpassword");
    expect(hash).toMatch(/^\$2[aby]\$/);
  });

  it("hash is not equal to the plaintext", async () => {
    const plaintext = "mySecret123";
    const hash = await hashPassword(plaintext);
    expect(hash).not.toBe(plaintext);
  });

  it("verifyPassword returns true for correct password", async () => {
    const plaintext = "correctPassword";
    const hash = await hashPassword(plaintext);
    const result = await verifyPassword(plaintext, hash);
    expect(result).toBe(true);
  });

  it("verifyPassword returns false for wrong password", async () => {
    const hash = await hashPassword("rightPassword");
    const result = await verifyPassword("wrongPassword", hash);
    expect(result).toBe(false);
  });

  it("uses cost factor 12 (encoded in hash)", async () => {
    const hash = await hashPassword("test");
    // bcrypt hash format: $2a$12$... where 12 is the cost factor
    expect(hash).toMatch(/^\$2[aby]\$12\$/);
  });
});
