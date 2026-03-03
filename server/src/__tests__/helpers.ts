import { Database } from "bun:sqlite";
import { migrate } from "../db/migrate.js";
import { setDb } from "../db/database.js";
import { app } from "../app.js";
import type { Server } from "http";

/** Creates an in-memory SQLite DB, runs migrations, and injects it via setDb(). */
export function createTestDb(): Database {
  const db = new Database(":memory:");
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA foreign_keys = ON");
  migrate(db);
  setDb(db);
  return db;
}

/** Minimal valid Immobilie payload — override any field as needed. */
export function makeImmobilie(overrides: Record<string, unknown> = {}) {
  return {
    strasse: "Teststraße",
    hausnummer: "1",
    plz: "10115",
    ort: "Berlin",
    typ: "wohnung",
    ...overrides,
  };
}

/** Inserts seed data: 3 properties with different types/statuses. */
export function seedTestData(db: Database) {
  const insert = db.prepare(`
    INSERT INTO immobilien (strasse, hausnummer, plz, ort, typ, status, preis, wohnflaeche, zimmeranzahl, kontakt_name, kontakt_email, baujahr)
    VALUES ($strasse, $hausnummer, $plz, $ort, $typ, $status, $preis, $wohnflaeche, $zimmeranzahl, $kontakt_name, $kontakt_email, $baujahr)
  `);

  insert.run({
    $strasse: "Hauptstraße", $hausnummer: "10", $plz: "10115", $ort: "Berlin",
    $typ: "wohnung", $status: "verfuegbar", $preis: 250000, $wohnflaeche: 75,
    $zimmeranzahl: 3, $kontakt_name: "Max Mustermann", $kontakt_email: "max@test.de", $baujahr: 2010,
  });
  insert.run({
    $strasse: "Gartenweg", $hausnummer: "5", $plz: "80331", $ort: "München",
    $typ: "haus", $status: "reserviert", $preis: 650000, $wohnflaeche: 150,
    $zimmeranzahl: 5, $kontakt_name: "Erika Muster", $kontakt_email: "erika@test.de", $baujahr: 1995,
  });
  insert.run({
    $strasse: "Industriestr.", $hausnummer: "42", $plz: "20095", $ort: "Hamburg",
    $typ: "gewerbe", $status: "verkauft", $preis: 480000, $wohnflaeche: 200,
    $zimmeranzahl: 0, $kontakt_name: "Max Mustermann", $kontakt_email: "max@test.de", $baujahr: 2020,
  });
}

/** Starts the Express app on a random port. Returns { server, baseUrl, close }. */
export function createTestServer(): { server: Server; baseUrl: string; close: () => Promise<void> } {
  const server = app.listen(0);
  const addr = server.address();
  const port = typeof addr === "object" && addr ? addr.port : 0;
  const baseUrl = `http://localhost:${port}`;

  const close = () => new Promise<void>((resolve) => server.close(() => resolve()));

  return { server, baseUrl, close };
}
