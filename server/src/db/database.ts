import { Database } from "bun:sqlite";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { migrate } from "./migrate.js";

const PROJECT_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const DB_PATH = join(PROJECT_ROOT, "data", "immoshark.db");

let db: Database | null = null;

export function getDb(): Database {
  if (!db) {
    db = new Database(DB_PATH, { create: true });
    db.exec("PRAGMA journal_mode = WAL");
    db.exec("PRAGMA foreign_keys = ON");
    migrate(db);
  }
  return db;
}
