import type { CsvColumnMapping, ImmobilieCreateDTO } from "@immoshark/shared";
import { csvColumnMappingSchema } from "@immoshark/shared";

/** Callable that sends a prompt to an LLM and returns the raw text response. */
export type LLMCaller = (systemPrompt: string, userPrompt: string) => Promise<string>;

const TARGET_FIELDS = `
- strasse (string, Straße)
- hausnummer (string, Hausnummer)
- plz (string, 5-stellige Postleitzahl)
- ort (string, Stadt/Ort)
- preis (number, Kaufpreis in Euro)
- wohnflaeche (number, Wohnfläche in m²)
- grundstuecksflaeche (number, Grundstücksfläche in m²)
- zimmeranzahl (number, Anzahl der Zimmer)
- typ (string, einer von: wohnung, haus, grundstueck, gewerbe)
- baujahr (number, Baujahr)
- beschreibung (string, Freitext-Beschreibung)
- provision (string, Provision/Maklergebühr)
- energieausweis_klasse (string, einer von: A+, A, B, C, D, E, F, G, H)
- energieausweis_verbrauch (number, Energieverbrauch in kWh/m²a)
- kontakt_name (string, Ansprechpartner)
- kontakt_telefon (string, Telefonnummer)
- kontakt_email (string, E-Mail-Adresse)
- expose_nummer (string, Exposé-Nummer/Referenznummer)
- notizen (string, interne Notizen)
- veroeffentlicht (string, Datum im Format JJJJ-MM-TT)
- status (string, einer von: verfuegbar, reserviert, verkauft)
`.trim();

const SYSTEM_PROMPT = `Du bist ein Daten-Mapping-Assistent für eine Immobilienverwaltung.
Deine Aufgabe: CSV-Spaltenüberschriften den Zielfeldern einer Datenbank zuordnen.

Die Zielfelder sind:
${TARGET_FIELDS}

Antworte ausschließlich mit einem JSON-Objekt. Die Keys sind die CSV-Spaltenüberschriften (exakt wie angegeben).
Die Values sind entweder ein Zielfeld-Name (string) oder null (wenn keine Zuordnung passt).

Regeln:
- Jedes Zielfeld darf höchstens einmal zugeordnet werden.
- Ordne nur zu, wenn du dir sicher bist. Im Zweifel: null.
- Beachte deutsche und englische Spaltennamen, Abkürzungen, sowie Sonderzeichen (ä→ae, ß→ss etc.).
- Antworte NUR mit dem JSON-Objekt, kein weiterer Text.`;

function buildUserPrompt(headers: string[], preview: string[][]): string {
  const table = [headers, ...preview]
    .map((row) => row.join(" | "))
    .join("\n");
  return `CSV-Spalten und Beispieldaten:\n\n${table}`;
}

/** Creates a default LLMCaller using the OpenAI SDK. */
export function createOpenAICaller(): LLMCaller {
  // Lazy import so tests don't need the openai package
  const OpenAI = require("openai").default;
  const client = new OpenAI();
  return async (systemPrompt: string, userPrompt: string) => {
    const response = await client.chat.completions.create({
      model: "gpt-5",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });
    return response.choices[0].message.content ?? "";
  };
}

/**
 * Suggests a CSV column mapping using an LLM.
 * Returns null if the LLM response fails validation.
 */
export async function suggestMapping(
  headers: string[],
  preview: string[][],
  callLLM: LLMCaller = createOpenAICaller(),
): Promise<CsvColumnMapping | null> {
  const userPrompt = buildUserPrompt(headers, preview);
  const raw = await callLLM(SYSTEM_PROMPT, userPrompt);

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  const result = csvColumnMappingSchema.safeParse(parsed);
  if (!result.success) return null;

  return result.data;
}

const EXTRACTION_SYSTEM_PROMPT = `Du bist ein Daten-Extraktions-Assistent für eine Immobilienverwaltung.
Deine Aufgabe: Aus Fließtexten strukturierte Immobiliendaten extrahieren.

Die Zielfelder sind:
${TARGET_FIELDS}

Du erhältst ein JSON-Array mit Fließtexten. Für jeden Text extrahierst du so viele Felder wie möglich.
Antworte mit einem JSON-Array gleicher Länge. Jedes Element ist ein Objekt mit den erkannten Feldern.
Felder die nicht erkannt werden, weglassen (nicht null setzen).

Regeln:
- Preise in Euro als Zahl (z.B. 250000, nicht "250.000 €")
- Flächen in m² als Zahl
- PLZ als 5-stelliger String
- Typ muss einer von: wohnung, haus, grundstueck, gewerbe sein
- Status muss einer von: verfuegbar, reserviert, verkauft sein
- Datum im Format JJJJ-MM-TT
- Antworte NUR mit dem JSON-Array, kein weiterer Text.`;

/**
 * Extracts structured immobilie data from free-text strings using an LLM.
 * Processes texts in batches to optimize cost/latency.
 * Returns one partial DTO per input text. On LLM error, returns empty objects.
 */
export async function extractFromFreetext(
  texts: string[],
  callLLM: LLMCaller = createOpenAICaller(),
  batchSize: number = 5,
): Promise<Partial<ImmobilieCreateDTO>[]> {
  const results: Partial<ImmobilieCreateDTO>[] = new Array(texts.length).fill({});

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const userPrompt = JSON.stringify(batch);

    try {
      const raw = await callLLM(EXTRACTION_SYSTEM_PROMPT, userPrompt);
      const parsed = JSON.parse(raw);

      if (Array.isArray(parsed)) {
        for (let j = 0; j < batch.length; j++) {
          if (parsed[j] && typeof parsed[j] === "object") {
            results[i + j] = parsed[j];
          }
        }
      }
    } catch {
      // On error, leave empty objects for this batch
    }
  }

  return results;
}
