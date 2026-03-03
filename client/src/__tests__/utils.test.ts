import { describe, it, expect } from "bun:test";
import { formatPreis, formatFlaeche, typLabel, statusLabel, statusColor } from "../lib/utils.js";

describe("formatPreis", () => {
  it("returns 'Auf Anfrage' for null", () => {
    expect(formatPreis(null)).toBe("Auf Anfrage");
  });

  it("formats 450000 as German currency", () => {
    const result = formatPreis(450000);
    expect(result).toContain("450.000");
    expect(result).toContain("€");
  });

  it("formats 0 as currency", () => {
    const result = formatPreis(0);
    expect(result).toContain("0");
    expect(result).toContain("€");
  });
});

describe("formatFlaeche", () => {
  it("returns '—' for null", () => {
    expect(formatFlaeche(null)).toBe("—");
  });

  it("formats 85 as '85 m²'", () => {
    expect(formatFlaeche(85)).toBe("85 m²");
  });

  it("formats 0 as '0 m²'", () => {
    expect(formatFlaeche(0)).toBe("0 m²");
  });
});

describe("typLabel", () => {
  it("maps 'wohnung' to 'Wohnung'", () => {
    expect(typLabel("wohnung")).toBe("Wohnung");
  });

  it("maps 'haus' to 'Haus'", () => {
    expect(typLabel("haus")).toBe("Haus");
  });

  it("maps 'grundstueck' to 'Grundstück'", () => {
    expect(typLabel("grundstueck")).toBe("Grundstück");
  });

  it("maps 'gewerbe' to 'Gewerbe'", () => {
    expect(typLabel("gewerbe")).toBe("Gewerbe");
  });

  it("returns unknown typ as-is (fallback)", () => {
    expect(typLabel("unknown")).toBe("unknown");
  });
});

describe("statusLabel", () => {
  it("maps 'verfuegbar' to 'Verfügbar'", () => {
    expect(statusLabel("verfuegbar")).toBe("Verfügbar");
  });

  it("maps 'reserviert' to 'Reserviert'", () => {
    expect(statusLabel("reserviert")).toBe("Reserviert");
  });

  it("maps 'verkauft' to 'Verkauft'", () => {
    expect(statusLabel("verkauft")).toBe("Verkauft");
  });

  it("returns unknown status as-is (fallback)", () => {
    expect(statusLabel("sonstig")).toBe("sonstig");
  });
});

describe("statusColor", () => {
  it("returns green classes for 'verfuegbar'", () => {
    expect(statusColor("verfuegbar")).toBe("bg-green-100 text-green-800");
  });

  it("returns yellow classes for 'reserviert'", () => {
    expect(statusColor("reserviert")).toBe("bg-yellow-100 text-yellow-800");
  });

  it("returns red classes for 'verkauft'", () => {
    expect(statusColor("verkauft")).toBe("bg-red-100 text-red-800");
  });

  it("returns gray fallback for unknown status", () => {
    expect(statusColor("sonstig")).toBe("bg-gray-100 text-gray-800");
  });
});
