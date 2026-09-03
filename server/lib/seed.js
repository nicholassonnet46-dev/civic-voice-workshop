import { hashPassword } from "./passwords.js";

// Workshop demo credentials (see README): S0000001A / citizen123 and
// S0000002B / admin123. Only the scrypt hash and salt are persisted.
export const seedData = {
  users: [
    { nric: "S0000001A", ...hashPassword("citizen123"), name: "Aisha Rahman", role: "citizen" },
    { nric: "S0000002B", ...hashPassword("admin123"), name: "Daniel Tan", role: "admin" },
  ],
  feedback: [
    {
      id: "fb-seed-1",
      nric: "S0000001A",
      name: "Aisha Rahman",
      message: "The new sheltered walkway near the library is helpful, but the lights turn off too early.",
      category: "General",
      status: "New",
      createdAt: "2026-08-29T09:14:00.000Z",
    },
  ],
};

export function freshSeed() {
  return structuredClone(seedData);
}
