import { describe, it, expect } from "bun:test";
import {
  immobilieCreateSchema,
  immobilieUpdateSchema,
  immobilienFilterSchema,
  csvColumnMappingSchema,
} from "../validation.js";

const validPayload = {
  strasse: "Teststraße",
  hausnummer: "1",
  plz: "10115",
  ort: "Berlin",
  typ: "wohnung" as const,
};

describe("immobilieCreateSchema", () => {
  it("accepts minimal valid payload", () => {
    const result = immobilieCreateSchema.safeParse(validPayload);
    expect(result.success).toBe(true);
  });

  it("accepts full payload with all optional fields", () => {
    const result = immobilieCreateSchema.safeParse({
      ...validPayload,
      preis: 250000,
      wohnflaeche: 75,
      grundstuecksflaeche: 200,
      zimmeranzahl: 3,
      baujahr: 2010,
      beschreibung: "Schöne Wohnung",
      provision: "3%",
      energieausweis_klasse: "B",
      energieausweis_verbrauch: 120,
      kontakt_name: "Max",
      kontakt_telefon: "+49123456",
      kontakt_email: "max@test.de",
      expose_nummer: "EXP-001",
      notizen: "Notiz",
      veroeffentlicht: "2026-01-15",
      status: "reserviert",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing strasse", () => {
    const { strasse, ...rest } = validPayload;
    const result = immobilieCreateSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects empty strasse", () => {
    const result = immobilieCreateSchema.safeParse({ ...validPayload, strasse: "" });
    expect(result.success).toBe(false);
  });

  it("rejects invalid PLZ (too short)", () => {
    const result = immobilieCreateSchema.safeParse({ ...validPayload, plz: "123" });
    expect(result.success).toBe(false);
  });

  it("rejects invalid PLZ (letters)", () => {
    const result = immobilieCreateSchema.safeParse({ ...validPayload, plz: "ABCDE" });
    expect(result.success).toBe(false);
  });

  it("rejects invalid email", () => {
    const result = immobilieCreateSchema.safeParse({ ...validPayload, kontakt_email: "not-an-email" });
    expect(result.success).toBe(false);
  });

  it("rejects baujahr before 1800", () => {
    const result = immobilieCreateSchema.safeParse({ ...validPayload, baujahr: 1799 });
    expect(result.success).toBe(false);
  });

  it("rejects baujahr too far in future", () => {
    const result = immobilieCreateSchema.safeParse({ ...validPayload, baujahr: 2040 });
    expect(result.success).toBe(false);
  });

  it("rejects notizen over 500 chars", () => {
    const result = immobilieCreateSchema.safeParse({ ...validPayload, notizen: "x".repeat(501) });
    expect(result.success).toBe(false);
  });

  it("accepts notizen at exactly 500 chars", () => {
    const result = immobilieCreateSchema.safeParse({ ...validPayload, notizen: "x".repeat(500) });
    expect(result.success).toBe(true);
  });

  it("rejects invalid veroeffentlicht format", () => {
    const result = immobilieCreateSchema.safeParse({ ...validPayload, veroeffentlicht: "15.01.2026" });
    expect(result.success).toBe(false);
  });

  it("accepts valid veroeffentlicht format JJJJ-MM-TT", () => {
    const result = immobilieCreateSchema.safeParse({ ...validPayload, veroeffentlicht: "2026-01-15" });
    expect(result.success).toBe(true);
  });

  it("rejects negative preis", () => {
    const result = immobilieCreateSchema.safeParse({ ...validPayload, preis: -100 });
    expect(result.success).toBe(false);
  });

  it("rejects invalid typ", () => {
    const result = immobilieCreateSchema.safeParse({ ...validPayload, typ: "villa" });
    expect(result.success).toBe(false);
  });

  it("defaults status to verfuegbar", () => {
    const result = immobilieCreateSchema.safeParse(validPayload);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe("verfuegbar");
    }
  });
});

describe("immobilieUpdateSchema", () => {
  it("accepts partial update (only ort)", () => {
    const result = immobilieUpdateSchema.safeParse({ ort: "Hamburg" });
    expect(result.success).toBe(true);
  });

  it("accepts empty object (no fields)", () => {
    const result = immobilieUpdateSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("still validates field constraints", () => {
    const result = immobilieUpdateSchema.safeParse({ plz: "ABC" });
    expect(result.success).toBe(false);
  });
});

describe("immobilienFilterSchema", () => {
  it("accepts empty filter with defaults", () => {
    const result = immobilienFilterSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.seite).toBe(1);
      expect(result.data.limit).toBe(20);
      expect(result.data.sort_order).toBe("asc");
    }
  });

  it("coerces string numbers to numbers", () => {
    const result = immobilienFilterSchema.safeParse({ preis_min: "100000", seite: "2" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.preis_min).toBe(100000);
      expect(result.data.seite).toBe(2);
    }
  });

  it("rejects invalid sort_by column", () => {
    const result = immobilienFilterSchema.safeParse({ sort_by: "hacked" });
    expect(result.success).toBe(false);
  });

  it("accepts valid filter combination", () => {
    const result = immobilienFilterSchema.safeParse({
      typ: "wohnung",
      status: "verfuegbar",
      ort: "Berlin",
      preis_min: "100000",
      preis_max: "500000",
      sort_by: "preis",
      sort_order: "desc",
    });
    expect(result.success).toBe(true);
  });
});

describe("csvColumnMappingSchema", () => {
  it("accepts valid column mapping", () => {
    const result = csvColumnMappingSchema.safeParse({
      "Straße": "strasse",
      "Nr.": "hausnummer",
      "PLZ": "plz",
      "Stadt": "ort",
      "Objektart": "typ",
    });
    expect(result.success).toBe(true);
  });

  it("accepts null values (unmapped columns)", () => {
    const result = csvColumnMappingSchema.safeParse({
      "Straße": "strasse",
      "Ignoriert": null,
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid target field", () => {
    const result = csvColumnMappingSchema.safeParse({
      "Straße": "nonexistent_field",
    });
    expect(result.success).toBe(false);
  });
});
