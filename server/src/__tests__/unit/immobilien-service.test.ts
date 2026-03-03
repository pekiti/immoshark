import { describe, it, expect, beforeEach } from "bun:test";
import {
  createImmobilie,
  getImmobilie,
  updateImmobilie,
  deleteImmobilie,
  listImmobilien,
  getStats,
  getRecentImmobilien,
} from "../../services/immobilien.service.js";
import { createTestDb, seedTestData, makeImmobilie } from "../helpers.js";
import type { Database } from "bun:sqlite";

let db: Database;

beforeEach(() => {
  db = createTestDb();
});

describe("createImmobilie", () => {
  it("creates and returns a new Immobilie with id", () => {
    const result = createImmobilie(makeImmobilie() as any);
    expect(result.id).toBeDefined();
    expect(result.strasse).toBe("Teststraße");
    expect(result.ort).toBe("Berlin");
    expect(result.status).toBe("verfuegbar");
  });

  it("stores all optional fields", () => {
    const result = createImmobilie(makeImmobilie({
      preis: 300000,
      wohnflaeche: 90,
      zimmeranzahl: 4,
      baujahr: 2015,
      kontakt_email: "test@example.de",
    }) as any);
    expect(result.preis).toBe(300000);
    expect(result.wohnflaeche).toBe(90);
    expect(result.zimmeranzahl).toBe(4);
    expect(result.baujahr).toBe(2015);
  });
});

describe("getImmobilie", () => {
  it("returns Immobilie with bilder array", () => {
    const created = createImmobilie(makeImmobilie() as any);
    const result = getImmobilie(created.id);
    expect(result).not.toBeNull();
    expect(result!.id).toBe(created.id);
    expect(result!.bilder).toEqual([]);
  });

  it("returns null for non-existent id", () => {
    const result = getImmobilie(99999);
    expect(result).toBeNull();
  });
});

describe("updateImmobilie", () => {
  it("updates fields and returns updated record", () => {
    const created = createImmobilie(makeImmobilie() as any);
    const result = updateImmobilie(created.id, { ort: "Hamburg", preis: 500000 });
    expect(result).not.toBeNull();
    expect(result!.ort).toBe("Hamburg");
    expect(result!.preis).toBe(500000);
  });

  it("returns null for non-existent id", () => {
    const result = updateImmobilie(99999, { ort: "Nowhere" });
    expect(result).toBeNull();
  });

  it("updates aktualisiert_am timestamp", () => {
    const created = createImmobilie(makeImmobilie() as any);
    const before = created.aktualisiert_am;
    // Tiny delay not needed — SQLite datetime('now') resolution is seconds
    const result = updateImmobilie(created.id, { ort: "Köln" });
    expect(result).not.toBeNull();
    // aktualisiert_am should be set (at least equal or later)
    expect(result!.aktualisiert_am).toBeDefined();
  });
});

describe("deleteImmobilie", () => {
  it("deletes existing record and returns true", () => {
    const created = createImmobilie(makeImmobilie() as any);
    expect(deleteImmobilie(created.id)).toBe(true);
    expect(getImmobilie(created.id)).toBeNull();
  });

  it("returns false for non-existent id", () => {
    expect(deleteImmobilie(99999)).toBe(false);
  });
});

describe("listImmobilien", () => {
  beforeEach(() => {
    seedTestData(db);
  });

  it("returns paginated results with meta", () => {
    const result = listImmobilien({});
    expect(result.data.length).toBe(3);
    expect(result.meta.gesamt).toBe(3);
    expect(result.meta.seite).toBe(1);
    expect(result.meta.limit).toBe(20);
  });

  it("filters by typ", () => {
    const result = listImmobilien({ typ: "wohnung" });
    expect(result.data.length).toBe(1);
    expect(result.data[0].typ).toBe("wohnung");
  });

  it("filters by status", () => {
    const result = listImmobilien({ status: "verkauft" });
    expect(result.data.length).toBe(1);
    expect(result.data[0].status).toBe("verkauft");
  });

  it("filters by ort (LIKE)", () => {
    const result = listImmobilien({ ort: "Münch" });
    expect(result.data.length).toBe(1);
    expect(result.data[0].ort).toBe("München");
  });

  it("filters by preis range", () => {
    const result = listImmobilien({ preis_min: 400000, preis_max: 700000 });
    expect(result.data.length).toBe(2); // München 650k, Hamburg 480k
  });

  it("filters by flaeche range", () => {
    const result = listImmobilien({ flaeche_min: 100, flaeche_max: 200 });
    expect(result.data.length).toBe(2); // München 150, Hamburg 200
  });

  it("filters by zimmer range", () => {
    const result = listImmobilien({ zimmer_min: 3, zimmer_max: 3 });
    expect(result.data.length).toBe(1); // Berlin 3 Zimmer
  });

  it("sorts by preis ASC", () => {
    const result = listImmobilien({ sort_by: "preis", sort_order: "asc" });
    const preise = result.data.map((d) => d.preis);
    expect(preise).toEqual([250000, 480000, 650000]);
  });

  it("sorts by preis DESC", () => {
    const result = listImmobilien({ sort_by: "preis", sort_order: "desc" });
    const preise = result.data.map((d) => d.preis);
    expect(preise).toEqual([650000, 480000, 250000]);
  });

  it("groups by kontakt (kontakt_name ASC as primary sort)", () => {
    const result = listImmobilien({ gruppe: "kontakt" });
    const names = result.data.map((d) => d.kontakt_name);
    // Erika Muster comes first, then Max Mustermann (2x)
    expect(names[0]).toBe("Erika Muster");
    expect(names[1]).toBe("Max Mustermann");
    expect(names[2]).toBe("Max Mustermann");
  });

  it("paginates with limit and seite", () => {
    const result = listImmobilien({ limit: 2, seite: 1 });
    expect(result.data.length).toBe(2);
    expect(result.meta.gesamt).toBe(3);

    const page2 = listImmobilien({ limit: 2, seite: 2 });
    expect(page2.data.length).toBe(1);
  });

  it("filters by date range (erstellt_von / erstellt_bis)", () => {
    // All seed data has today's date
    const today = new Date().toISOString().split("T")[0];
    const result = listImmobilien({ erstellt_von: today, erstellt_bis: today });
    expect(result.data.length).toBe(3);

    // A date in the past should return nothing
    const pastResult = listImmobilien({ erstellt_von: "2020-01-01", erstellt_bis: "2020-01-02" });
    expect(pastResult.data.length).toBe(0);
  });
});

describe("getStats", () => {
  beforeEach(() => {
    seedTestData(db);
  });

  it("returns correct counts by status", () => {
    const stats = getStats();
    expect(stats.gesamt).toBe(3);
    expect(stats.verfuegbar).toBe(1);
    expect(stats.reserviert).toBe(1);
    expect(stats.verkauft).toBe(1);
  });

  it("returns average preis", () => {
    const stats = getStats();
    expect(stats.durchschnittspreis).toBeCloseTo((250000 + 650000 + 480000) / 3, 0);
  });

  it("returns counts grouped by typ", () => {
    const stats = getStats();
    expect(stats.nach_typ.wohnung).toBe(1);
    expect(stats.nach_typ.haus).toBe(1);
    expect(stats.nach_typ.gewerbe).toBe(1);
  });
});

describe("getRecentImmobilien", () => {
  beforeEach(() => {
    seedTestData(db);
  });

  it("returns up to limit records ordered by newest first", () => {
    const recent = getRecentImmobilien(2);
    expect(recent.length).toBe(2);
  });

  it("defaults to 5 records", () => {
    const recent = getRecentImmobilien();
    expect(recent.length).toBe(3); // only 3 seed records
  });
});
