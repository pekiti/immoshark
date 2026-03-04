import { parse } from "csv-parse/sync";
import type { ImmobilieCreateDTO, CsvColumnMapping } from "@immoshark/shared";
import { immobilieCreateSchema } from "@immoshark/shared";
import { createImmobilie } from "./immobilien.service.js";
import { extractFromFreetext, type LLMCaller } from "./mapping.service.js";

function detectDelimiter(content: string): string {
  const firstLine = content.split("\n")[0] || "";
  const semicolons = (firstLine.match(/;/g) || []).length;
  const commas = (firstLine.match(/,/g) || []).length;
  return semicolons > commas ? ";" : ",";
}

function parseGermanNumber(value: string): number | null {
  if (!value || value.trim() === "") return null;
  // German: 1.234,56 → 1234.56
  const cleaned = value.trim().replace(/\./g, "").replace(",", ".");
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

export function parseCsvContent(content: string) {
  const delimiter = detectDelimiter(content);
  const records: string[][] = parse(content, {
    delimiter,
    skip_empty_lines: true,
    relax_column_count: true,
  });

  if (records.length === 0) throw new Error("CSV-Datei ist leer");

  const headers = records[0];
  const dataRows = records.slice(1);
  const preview = dataRows.slice(0, 5);

  return { headers, preview, total_rows: dataRows.length };
}

const NUMERIC_FIELDS = new Set([
  "preis",
  "wohnflaeche",
  "grundstuecksflaeche",
  "zimmeranzahl",
  "energieausweis_verbrauch",
  "baujahr",
]);

const DATE_FIELDS = new Set(["veroeffentlicht"]);

function parseGermanDate(value: string): string | null {
  if (!value || value.trim() === "") return null;
  const trimmed = value.trim();
  // Already ISO: 2026-01-15
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  // German: 15.01.2026
  const match = trimmed.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (match) {
    const [, day, month, year] = match;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }
  return null;
}

export const CITY_ABBREVIATIONS: Record<string, string> = {
  "sb": "Saarbrücken",
  "sls": "Saarlouis",
  "hom": "Homburg",
  "nk": "Neunkirchen",
  "mzg": "Merzig",
  "wnd": "St. Wendel",
  "igb": "St. Ingbert",
};

export function resolveCityAbbreviation(input: string): string {
  const resolved = CITY_ABBREVIATIONS[input.toLowerCase().trim()];
  return resolved ?? input;
}

export function normalizeGermanPhone(input: string): string {
  if (!input) return input;
  let cleaned = input.trim();

  // Remove all separators: /, -, (, ), spaces
  cleaned = cleaned.replace(/[\s/\-()]+/g, "");

  // Handle international prefix variants
  if (cleaned.startsWith("0049")) {
    cleaned = "+" + cleaned.slice(2); // 0049 → +49
  } else if (cleaned.startsWith("+49")) {
    // already international
  } else if (cleaned.startsWith("0")) {
    cleaned = "+49" + cleaned.slice(1); // 0681 → +49681
  } else {
    return input; // not a German number, return as-is
  }

  // Insert spaces: +49 XXXX XXXXXXX
  // After +49, take area code (2-5 digits) then rest
  const digits = cleaned.slice(3); // everything after +49
  if (digits.length <= 3) return "+49 " + digits;

  // Mobile numbers: 15x, 16x, 17x → 3 digit area code
  const mobilePrefix = digits.slice(0, 3);
  if (/^1[5-7]\d$/.test(mobilePrefix)) {
    return `+49 ${digits.slice(0, 3)} ${digits.slice(3)}`;
  }

  // Landline: try common area code lengths (2-5 digits)
  // Major cities have 2-3 digit codes, smaller ones 4-5
  // Heuristic: if starts with known 2/3 digit prefix, use that
  const twoDigitCodes = ["30", "40", "69", "89"]; // Berlin, Hamburg, Frankfurt, München
  const threeDigitCodes = ["681", "211", "221", "341", "351", "361", "371", "381", "391"];
  const prefix2 = digits.slice(0, 2);
  const prefix3 = digits.slice(0, 3);

  if (twoDigitCodes.includes(prefix2)) {
    return `+49 ${digits.slice(0, 2)} ${digits.slice(2)}`;
  }
  if (threeDigitCodes.includes(prefix3)) {
    return `+49 ${digits.slice(0, 3)} ${digits.slice(3)}`;
  }

  // Default: assume 4-digit area code
  if (digits.length > 4) {
    return `+49 ${digits.slice(0, 4)} ${digits.slice(4)}`;
  }
  return `+49 ${digits}`;
}

export async function importCsvData(
  content: string,
  mapping: CsvColumnMapping,
  callLLM?: LLMCaller,
): Promise<{ imported: number; skipped: number; errors: string[] }> {
  const delimiter = detectDelimiter(content);
  const records: string[][] = parse(content, {
    delimiter,
    skip_empty_lines: true,
    relax_column_count: true,
  });

  const headers = records[0];
  const dataRows = records.slice(1);
  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];

  // Identify freitext columns
  const freitextCols: number[] = [];
  for (let col = 0; col < headers.length; col++) {
    if (mapping[headers[col]] === "__freitext__") {
      freitextCols.push(col);
    }
  }

  // Extract structured data from freitext columns via LLM
  let llmResults: Partial<ImmobilieCreateDTO>[] = new Array(dataRows.length).fill({});
  if (freitextCols.length > 0 && callLLM) {
    const texts = dataRows.map((row) =>
      freitextCols.map((col) => row[col] || "").join("\n")
    );
    llmResults = await extractFromFreetext(texts, callLLM);
  }

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];

    // Start with LLM-extracted data as base layer
    const rawObj: Record<string, unknown> = { ...llmResults[i] };

    // Direct column mappings overwrite LLM results
    for (let col = 0; col < headers.length; col++) {
      const csvHeader = headers[col];
      const targetField = mapping[csvHeader];
      if (!targetField || targetField === "__freitext__" || !row[col]) continue;

      const value = row[col].trim();
      if (!value) continue;

      if (NUMERIC_FIELDS.has(targetField)) {
        rawObj[targetField] = parseGermanNumber(value);
      } else if (DATE_FIELDS.has(targetField)) {
        rawObj[targetField] = parseGermanDate(value);
      } else {
        rawObj[targetField] = value;
      }
    }

    // Post-processing: normalize phone and resolve city abbreviations
    if (rawObj.kontakt_telefon && typeof rawObj.kontakt_telefon === "string") {
      rawObj.kontakt_telefon = normalizeGermanPhone(rawObj.kontakt_telefon);
    }
    if (rawObj.ort && typeof rawObj.ort === "string") {
      rawObj.ort = resolveCityAbbreviation(rawObj.ort);
    }

    const result = immobilieCreateSchema.safeParse(rawObj);
    if (result.success) {
      try {
        createImmobilie(result.data as ImmobilieCreateDTO);
        imported++;
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        errors.push(`Zeile ${i + 2}: ${msg}`);
        skipped++;
      }
    } else {
      const msgs = result.error.errors.map((e) => e.message).join(", ");
      errors.push(`Zeile ${i + 2}: ${msgs}`);
      skipped++;
    }
  }

  return { imported, skipped, errors };
}
