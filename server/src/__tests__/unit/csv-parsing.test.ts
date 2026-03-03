import { describe, it, expect, beforeEach } from "bun:test";
import { parseCsvContent, importCsvData } from "../../services/csv.service.js";
import { createTestDb } from "../helpers.js";
import type { Database } from "bun:sqlite";

describe("parseCsvContent", () => {
  it("parses semicolon-delimited CSV", () => {
    const csv = "Name;Alter;Stadt\nMax;30;Berlin\nErika;25;München";
    const result = parseCsvContent(csv);

    expect(result.headers).toEqual(["Name", "Alter", "Stadt"]);
    expect(result.preview).toHaveLength(2);
    expect(result.total_rows).toBe(2);
  });

  it("parses comma-delimited CSV", () => {
    const csv = "Name,Age,City\nJohn,30,NYC\nJane,25,LA";
    const result = parseCsvContent(csv);

    expect(result.headers).toEqual(["Name", "Age", "City"]);
    expect(result.total_rows).toBe(2);
  });

  it("throws on empty CSV", () => {
    expect(() => parseCsvContent("")).toThrow("CSV-Datei ist leer");
  });

  it("returns only header for header-only CSV", () => {
    const csv = "Name;Alter;Stadt\n";
    const result = parseCsvContent(csv);

    expect(result.headers).toEqual(["Name", "Alter", "Stadt"]);
    expect(result.preview).toHaveLength(0);
    expect(result.total_rows).toBe(0);
  });

  it("limits preview to 5 rows", () => {
    const rows = Array.from({ length: 10 }, (_, i) => `Row${i};${i};City${i}`);
    const csv = "A;B;C\n" + rows.join("\n");
    const result = parseCsvContent(csv);

    expect(result.preview).toHaveLength(5);
    expect(result.total_rows).toBe(10);
  });
});

describe("importCsvData — German numbers", () => {
  let db: Database;

  beforeEach(() => {
    db = createTestDb();
  });

  it("parses German number '1.234,56' → 1234.56 for preis", () => {
    const csv = "Strasse;Nr;PLZ;Ort;Typ;Preis\nTeststr.;1;10115;Berlin;wohnung;1.234,56";
    const mapping = {
      Strasse: "strasse" as const,
      Nr: "hausnummer" as const,
      PLZ: "plz" as const,
      Ort: "ort" as const,
      Typ: "typ" as const,
      Preis: "preis" as const,
    };

    const result = importCsvData(csv, mapping);
    expect(result.imported).toBe(1);

    const row = db.query("SELECT preis FROM immobilien WHERE strasse = 'Teststr.'").get() as { preis: number };
    expect(row.preis).toBeCloseTo(1234.56, 2);
  });

  it("parses simple number '250000' for preis", () => {
    const csv = "Strasse;Nr;PLZ;Ort;Typ;Preis\nMusterstr.;5;10115;Berlin;wohnung;250000";
    const mapping = {
      Strasse: "strasse" as const,
      Nr: "hausnummer" as const,
      PLZ: "plz" as const,
      Ort: "ort" as const,
      Typ: "typ" as const,
      Preis: "preis" as const,
    };

    const result = importCsvData(csv, mapping);
    expect(result.imported).toBe(1);

    const row = db.query("SELECT preis FROM immobilien WHERE strasse = 'Musterstr.'").get() as { preis: number };
    expect(row.preis).toBe(250000);
  });
});

describe("importCsvData — German dates", () => {
  let db: Database;

  beforeEach(() => {
    db = createTestDb();
  });

  it("parses German date '15.01.2026' → '2026-01-15'", () => {
    const csv = "Strasse;Nr;PLZ;Ort;Typ;Datum\nDatestr.;1;10115;Berlin;wohnung;15.01.2026";
    const mapping = {
      Strasse: "strasse" as const,
      Nr: "hausnummer" as const,
      PLZ: "plz" as const,
      Ort: "ort" as const,
      Typ: "typ" as const,
      Datum: "veroeffentlicht" as const,
    };

    const result = importCsvData(csv, mapping);
    expect(result.imported).toBe(1);

    const row = db.query("SELECT veroeffentlicht FROM immobilien WHERE strasse = 'Datestr.'").get() as { veroeffentlicht: string };
    expect(row.veroeffentlicht).toBe("2026-01-15");
  });

  it("passes through ISO date '2026-01-15' unchanged", () => {
    const csv = "Strasse;Nr;PLZ;Ort;Typ;Datum\nISOstr.;2;10115;Berlin;haus;2026-01-15";
    const mapping = {
      Strasse: "strasse" as const,
      Nr: "hausnummer" as const,
      PLZ: "plz" as const,
      Ort: "ort" as const,
      Typ: "typ" as const,
      Datum: "veroeffentlicht" as const,
    };

    const result = importCsvData(csv, mapping);
    expect(result.imported).toBe(1);

    const row = db.query("SELECT veroeffentlicht FROM immobilien WHERE strasse = 'ISOstr.'").get() as { veroeffentlicht: string };
    expect(row.veroeffentlicht).toBe("2026-01-15");
  });
});

describe("importCsvData — validation errors", () => {
  beforeEach(() => {
    createTestDb();
  });

  it("skips rows with invalid data and reports errors", () => {
    const csv = "Strasse;Nr;PLZ;Ort;Typ\nGut;1;10115;Berlin;wohnung\n;;ABC;;\n";
    const mapping = {
      Strasse: "strasse" as const,
      Nr: "hausnummer" as const,
      PLZ: "plz" as const,
      Ort: "ort" as const,
      Typ: "typ" as const,
    };

    const result = importCsvData(csv, mapping);
    expect(result.imported).toBe(1);
    expect(result.skipped).toBe(1);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});
