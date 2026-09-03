import { Low } from "lowdb";
import { JSONFile } from "lowdb/node";
import { mkdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { migratePlainTextPasswords } from "./passwords.js";
import { freshSeed } from "./seed.js";

const here = path.dirname(fileURLToPath(import.meta.url));
export const dbPath = path.resolve(here, "../../data/db.json");

export async function createDb(file = dbPath) {
  await mkdir(path.dirname(file), { recursive: true });
  // Use the JSONFile adapter directly: JSONFilePreset silently swaps in an
  // in-memory adapter when NODE_ENV=test, which hides persistence bugs.
  const existed = await stat(file).then(() => true, () => false);
  const db = new Low(new JSONFile(file), freshSeed());
  await db.read();
  if (!existed || !db.data.users?.length) {
    db.data = freshSeed();
    await db.write();
  } else if (migratePlainTextPasswords(db.data.users)) {
    // Older db.json files stored demo passwords in plain text; rewrite them hashed.
    await db.write();
  }
  return db;
}
