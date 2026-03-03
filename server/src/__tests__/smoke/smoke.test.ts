import { describe, it, expect, beforeAll } from "bun:test";
import { Database } from "bun:sqlite";
import { migrate } from "../../db/migrate.js";
import { createTestDb, createTestServer } from "../helpers.js";

describe("Smoke Tests", () => {
  it("migrate() runs on empty :memory: DB without errors", () => {
    const db = new Database(":memory:");
    expect(() => migrate(db)).not.toThrow();
    db.close();
  });

  it("migrate() is idempotent (running twice doesn't throw)", () => {
    const db = new Database(":memory:");
    migrate(db);
    expect(() => migrate(db)).not.toThrow();
    db.close();
  });

  it("FTS triggers exist after migration", () => {
    const db = new Database(":memory:");
    migrate(db);

    const triggers = db
      .query("SELECT name FROM sqlite_master WHERE type='trigger' ORDER BY name")
      .all() as { name: string }[];
    const names = triggers.map((t) => t.name);

    expect(names).toContain("immobilien_ai");
    expect(names).toContain("immobilien_ad");
    expect(names).toContain("immobilien_au");
    db.close();
  });

  it("Health endpoint responds with { status: 'ok' }", async () => {
    createTestDb();
    const { baseUrl, close } = createTestServer();

    try {
      const res = await fetch(`${baseUrl}/api/health`);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual({ status: "ok" });
    } finally {
      await close();
    }
  });
});
