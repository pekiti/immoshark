import { describe, it, expect } from "bun:test";
import { suggestMapping, extractFromFreetext, type LLMCaller } from "../../services/mapping.service.js";

const HEADERS = ["Straße", "Nr.", "PLZ", "Stadt", "Kaufpreis", "Objektart"];
const PREVIEW = [
  ["Hauptstraße", "10", "10115", "Berlin", "250.000", "Wohnung"],
  ["Gartenweg", "5", "80331", "München", "650.000", "Haus"],
];

function mockLLM(response: string): LLMCaller {
  return async () => response;
}

describe("suggestMapping", () => {
  it("returns valid mapping from LLM response", async () => {
    const llmResponse = JSON.stringify({
      "Straße": "strasse",
      "Nr.": "hausnummer",
      "PLZ": "plz",
      "Stadt": "ort",
      "Kaufpreis": "preis",
      "Objektart": "typ",
    });

    const result = await suggestMapping(HEADERS, PREVIEW, mockLLM(llmResponse));
    expect(result).toEqual({
      "Straße": "strasse",
      "Nr.": "hausnummer",
      "PLZ": "plz",
      "Stadt": "ort",
      "Kaufpreis": "preis",
      "Objektart": "typ",
    });
  });

  it("handles null values for unmapped columns", async () => {
    const llmResponse = JSON.stringify({
      "Straße": "strasse",
      "Nr.": null,
      "PLZ": "plz",
      "Stadt": "ort",
      "Kaufpreis": null,
      "Objektart": "typ",
    });

    const result = await suggestMapping(HEADERS, PREVIEW, mockLLM(llmResponse));
    expect(result).not.toBeNull();
    expect(result!["Nr."]).toBeNull();
    expect(result!["Kaufpreis"]).toBeNull();
  });

  it("returns null for invalid JSON response", async () => {
    const result = await suggestMapping(HEADERS, PREVIEW, mockLLM("not json at all"));
    expect(result).toBeNull();
  });

  it("returns null for invalid field names", async () => {
    const llmResponse = JSON.stringify({
      "Straße": "invalid_field_name",
      "Nr.": "hausnummer",
    });

    const result = await suggestMapping(HEADERS, PREVIEW, mockLLM(llmResponse));
    expect(result).toBeNull();
  });

  it("returns null when LLM throws an error", async () => {
    const errorLLM: LLMCaller = async () => {
      throw new Error("API unavailable");
    };

    await expect(suggestMapping(HEADERS, PREVIEW, errorLLM)).rejects.toThrow("API unavailable");
  });
});

describe("extractFromFreetext", () => {
  it("extracts structured data from free texts", async () => {
    const mockLLM: LLMCaller = async () => JSON.stringify([
      {
        strasse: "Hauptstraße",
        hausnummer: "10",
        plz: "10115",
        ort: "Berlin",
        preis: 250000,
        typ: "wohnung",
      },
    ]);

    const result = await extractFromFreetext(
      ["Wohnung in der Hauptstraße 10, 10115 Berlin, 250.000 Euro"],
      mockLLM,
    );

    expect(result).toHaveLength(1);
    expect(result[0].strasse).toBe("Hauptstraße");
    expect(result[0].preis).toBe(250000);
    expect(result[0].typ).toBe("wohnung");
  });

  it("processes multiple texts in batches", async () => {
    let callCount = 0;
    const mockLLM: LLMCaller = async () => {
      callCount++;
      return JSON.stringify([
        { strasse: "Str1", hausnummer: "1", plz: "10115", ort: "Berlin", typ: "wohnung" },
        { strasse: "Str2", hausnummer: "2", plz: "20095", ort: "Hamburg", typ: "haus" },
      ]);
    };

    const texts = ["Text 1", "Text 2", "Text 3", "Text 4"];
    const result = await extractFromFreetext(texts, mockLLM, 2);

    expect(callCount).toBe(2); // 4 texts / batch size 2 = 2 calls
    expect(result).toHaveLength(4);
    expect(result[0].strasse).toBe("Str1");
    expect(result[1].strasse).toBe("Str2");
  });

  it("returns empty objects on LLM error", async () => {
    const errorLLM: LLMCaller = async () => {
      throw new Error("API down");
    };

    const result = await extractFromFreetext(["Some text"], errorLLM);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({});
  });

  it("returns empty objects for invalid JSON response", async () => {
    const mockLLM: LLMCaller = async () => "not valid json";

    const result = await extractFromFreetext(["Some text"], mockLLM);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({});
  });
});
