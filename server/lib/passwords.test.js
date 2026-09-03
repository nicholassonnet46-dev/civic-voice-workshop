import { describe, expect, it } from "vitest";
import { hashPassword, migratePlainTextPasswords, verifyPassword } from "./passwords.js";

describe("passwords", () => {
  it("hashes with a per-user salt and verifies the original", () => {
    const first = hashPassword("admin123");
    const second = hashPassword("admin123");
    expect(first.passwordSalt).not.toBe(second.passwordSalt);
    expect(first.passwordHash).not.toBe(second.passwordHash);
    expect(first.passwordHash).not.toContain("admin123");
    expect(verifyPassword("admin123", first)).toBe(true);
    expect(verifyPassword("admin124", first)).toBe(false);
    expect(verifyPassword(undefined, first)).toBe(false);
    expect(verifyPassword("admin123", { passwordHash: "zz", passwordSalt: first.passwordSalt })).toBe(false);
  });

  it("migrates legacy plain-text records in place", () => {
    const users = [
      { nric: "S0000001A", password: "citizen123", role: "citizen" },
      { nric: "S0000002B", ...hashPassword("admin123"), role: "admin" },
    ];
    expect(migratePlainTextPasswords(users)).toBe(true);
    expect(users[0]).not.toHaveProperty("password");
    expect(verifyPassword("citizen123", users[0])).toBe(true);
    expect(migratePlainTextPasswords(users)).toBe(false);
  });
});
