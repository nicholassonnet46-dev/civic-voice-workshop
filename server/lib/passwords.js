import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const KEY_LENGTH = 64;

export function hashPassword(password, salt = randomBytes(16).toString("hex")) {
  const passwordHash = scryptSync(String(password), salt, KEY_LENGTH).toString("hex");
  return { passwordHash, passwordSalt: salt };
}

export function verifyPassword(password, user) {
  if (typeof password !== "string" || !user?.passwordHash || !user?.passwordSalt) return false;
  const expected = Buffer.from(user.passwordHash, "hex");
  if (expected.length !== KEY_LENGTH) return false;
  const actual = scryptSync(password, user.passwordSalt, KEY_LENGTH);
  return timingSafeEqual(expected, actual);
}

// Converts any user record that still carries a plain-text `password` into the
// hashed form. Returns true when at least one record changed.
export function migratePlainTextPasswords(users) {
  let changed = false;
  for (const user of users) {
    if (typeof user.password !== "string") continue;
    Object.assign(user, hashPassword(user.password));
    delete user.password;
    changed = true;
  }
  return changed;
}
