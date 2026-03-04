# ImmoShark — Stakeholder-Dokumentation: Backend-Entwickler

## Architektur-Überblick

```text
server/src/
├── index.ts                  Einstiegspunkt: app.listen(PORT)
├── app.ts                    Express-Setup: CORS, JSON, Routing, Error-Handler
├── db/
│   ├── database.ts           SQLite-Singleton: getDb(), setDb()
│   ├── migrate.ts            Schema + FTS5 + Triggers (idempotent)
│   └── seed.ts               6 Beispiel-Immobilien
├── routes/
│   ├── immobilien.ts         CRUD + Stats Endpoints
│   └── csv.ts                Upload + Import + Suggest-Mapping (Multer + In-Memory-Session)
├── services/
│   ├── immobilien.service.ts Queries: list, get, create, update, delete, stats, recent
│   ├── csv.service.ts        Parsing, Import, Telefonnormalisierung, Ortskürzel
│   └── mapping.service.ts    LLM-Spalten-Mapping + Freitext-Extraktion (DI-fähig)
└── middleware/
    ├── validate.ts           Zod-Schema-Validierung (Body/Query)
    └── error.ts              Globaler Error-Handler (500 + Stack-Trace)
```

---

## Tech-Stack

| Schicht | Technologie | Version |
|---|---|---|
| Runtime | Bun | >= 1.1 |
| HTTP-Framework | Express | 5.x |
| Datenbank | SQLite via `bun:sqlite` | Eingebettet |
| Validierung | Zod (via `@immoshark/shared`) | 3.24 |
| CSV-Parsing | `csv-parse` | 5.6 |
| KI-Mapping | `openai` (GPT-5) | 6.x |
| File-Upload | Multer (Memory-Storage) | 1.4.5-lts |
| CORS | `cors` | 2.8 |

---

## Datenbank

### Singleton-Pattern

```typescript
// database.ts — vereinfacht
let db: Database | null = null;

export function setDb(instance: Database) { db = instance; }  // Test-Seam

export function getDb(): Database {
  if (!db) {
    db = new Database(DB_PATH, { create: true });
    db.exec("PRAGMA journal_mode = WAL");
    db.exec("PRAGMA foreign_keys = ON");
    migrate(db);
  }
  return db;
}
```

- **Lazy Init:** DB wird erst beim ersten Zugriff erstellt
- **WAL-Modus:** Write-Ahead Logging für bessere Parallelität
- **Foreign Keys:** Explizit aktiviert (SQLite-Default ist OFF)
- **`setDb()`:** Test-Seam — erlaubt Tests, eine `:memory:`-DB zu injizieren

### Migration

Die Funktion `migrate(db)` in `migrate.ts` ist vollständig idempotent:

1. `CREATE TABLE IF NOT EXISTS` für `immobilien` und `immobilien_bilder`
2. `ALTER TABLE ADD COLUMN` für nachträglich hinzugefügte Felder (`notizen`, `veroeffentlicht`)
3. FTS5 Virtual Table mit Schema-Vergleich: wird automatisch neu aufgebaut, wenn Spalten fehlen
4. Sync-Triggers (`AFTER INSERT/UPDATE/DELETE`) für den FTS-Index

### SQL-Patterns

- **Parametrisierte Queries** überall: `$param`-Syntax von `bun:sqlite`
- **Sortierung per Whitelist:** `SORTABLE_COLUMNS` Set verhindert SQL-Injection bei `ORDER BY`
- **Dynamische Feld-Insertion:** `createImmobilie` baut INSERT aus den Schlüsseln des Input-Objekts
- **FTS5 + LIKE-Fallback:** Volltextsuche über Text-Spalten + `CAST(preis AS TEXT) LIKE` für numerische

---

## Service-Layer

### `immobilien.service.ts`

| Funktion | Signatur | Besonderheit |
|---|---|---|
| `listImmobilien` | `(filter: ImmobilienFilter) → { data, meta }` | Komplexer Query-Builder mit 12 Filter-Optionen |
| `getImmobilie` | `(id: number) → Immobilie & { bilder } \| null` | Joined mit `immobilien_bilder` |
| `createImmobilie` | `(data: ImmobilieCreateDTO) → Immobilie` | Dynamischer INSERT, `RETURNING *` |
| `updateImmobilie` | `(id: number, data: ImmobilieUpdateDTO) → Immobilie \| null` | Dynamischer SET, aktualisiert `aktualisiert_am` |
| `deleteImmobilie` | `(id: number) → boolean` | `DELETE ... RETURNING id` |
| `getStats` | `() → DashboardStats` | Aggregation: COUNT, AVG, GROUP BY |
| `getRecentImmobilien` | `(limit?) → Immobilie[]` | `ORDER BY erstellt_am DESC` |

### `csv.service.ts`

| Funktion | Zweck |
|---|---|
| `parseCsvContent(content)` | Delimiter erkennen, Headers + Preview + total_rows |
| `importCsvData(content, mapping, callLLM?)` | Voll-Import: Mapping + Freitext-Extraktion → Merge → Normalisierung → Zod-Validation → DB. Async, da LLM-Calls bei `__freitext__`-Spalten |
| `normalizeGermanPhone(input)` | Deutsche Telefonnummern in `+49 VORWAHL NUMMER`-Format konvertieren |
| `resolveCityAbbreviation(input)` | Kfz-Kürzel (SB, SLS, HOM, NK, MZG, WND, IGB) zu vollen Stadtnamen auflösen |

Interne Hilfsfunktionen (nicht exportiert):
- `detectDelimiter`: Zählt `;` vs `,` in der ersten Zeile
- `parseGermanNumber`: `1.234,56` → `1234.56`
- `parseGermanDate`: `15.01.2026` → `2026-01-15`

**Merge-Logik bei Freitext-Extraktion:** LLM-extrahierte Felder bilden die Basis, direkte Spalten-Mappings überschreiben. So kann der User z.B. eine Preis-Spalte direkt mappen UND weitere Infos per Freitext extrahieren.

### `mapping.service.ts`

| Export | Zweck |
|---|---|
| `suggestMapping(headers, preview, callLLM?)` | LLM-basierte Spalten-Zuordnung — sendet CSV-Headers + Beispieldaten an GPT-5, validiert Antwort gegen `csvColumnMappingSchema` |
| `extractFromFreetext(texts, callLLM?, batchSize?)` | Extrahiert strukturierte Immobiliendaten aus Fließtexten. Verarbeitet in Batches (Default: 5 pro LLM-Call). Gibt `Partial<ImmobilieCreateDTO>[]` zurück |
| `createOpenAICaller()` | Erzeugt den Default-`LLMCaller` mit OpenAI SDK |
| `LLMCaller` (Type) | `(systemPrompt, userPrompt) => Promise<string>` — injizierbarer Typ für Tests |

**Architektur-Entscheidung:** Der `LLMCaller`-Typ entkoppelt den Service vom OpenAI-SDK. Tests injizieren einen einfachen Mock-Callback, der ein JSON-String zurückgibt — kein SDK-Mocking nötig.

---

## Routing

### `immobilien.ts`

```
GET    /api/immobilien       → validate(filterSchema, "query") → listImmobilien
GET    /api/immobilien/:id   → parseInt check → getImmobilie
POST   /api/immobilien       → validate(createSchema) → createImmobilie
PUT    /api/immobilien/:id   → validate(updateSchema) → updateImmobilie
DELETE /api/immobilien/:id   → parseInt check → deleteImmobilie
GET    /api/stats            → getStats
```

### `csv.ts`

```
POST   /api/csv/upload           → multer.single("file") → parseCsvContent → session in Map
POST   /api/csv/suggest-mapping  → session lookup → suggestMapping (GPT-5) → validiertes Mapping
POST   /api/csv/import           → session lookup → validate mapping → importCsvData (async)
```

CSV-Sessions werden in einer In-Memory `Map<string, string>` gespeichert und nach 10 Minuten automatisch gelöscht. Der `suggest-mapping`-Endpoint liest die Session, extrahiert Headers + Preview und übergibt sie dem Mapping-Service. Bei LLM-Fehler: HTTP 502 mit Code `LLM_ERROR`.

**Freitext-Import:** Wenn das Mapping `__freitext__`-Spalten enthält, instanziiert der Import-Handler einen `LLMCaller` und übergibt ihn an `importCsvData()`. Ohne `__freitext__`-Spalten bleibt der Import synchron und ohne LLM-Aufruf.

---

## Middleware

### `validate.ts`

```typescript
validate(schema: ZodSchema, source: "body" | "query" = "body")
```

- `body`: Parsed Body wird in `req.body` überschrieben
- `query`: Parsed Query wird in `res.locals.query` gespeichert (Express 5 Query ist readonly)
- Bei Fehler: `400 { error: { message, code: "VALIDATION_ERROR" } }`

### `error.ts`

Globaler Error-Handler (`app.use(errorHandler)`):
- Loggt Stack-Trace auf `stderr`
- Antwortet mit `500 { error: { message, code: "SERVER_ERROR" } }`

---

## Shared-Paket (`@immoshark/shared`)

Wird von Server und Client importiert:

| Export | Zweck |
|---|---|
| `types.ts` | Interfaces, Enums, DTOs (`Immobilie`, `ImmobilieCreateDTO`, `ImmobilienFilter`, ...) |
| `validation.ts` | Zod-Schemas (`immobilieCreateSchema`, `immobilienFilterSchema`, `csvColumnMappingSchema`) |

### Wichtige Validierungsregeln

| Feld | Regel |
|---|---|
| `plz` | `/^\d{5}$/` |
| `baujahr` | 1800 – aktuelles Jahr + 5 |
| `kontakt_email` | Zod `.email()` |
| `notizen` | max 500 Zeichen |
| `veroeffentlicht` | `/^\d{4}-\d{2}-\d{2}$/` (ISO-Format) |
| `status` | Default `"verfuegbar"` |
| `preis` | `.positive().nullable().optional()` |

---

## Tests schreiben

### Setup

```typescript
import { createTestDb, makeImmobilie, seedTestData } from "../helpers.js";

let db: Database;
beforeEach(() => { db = createTestDb(); });  // Frische In-Memory-DB pro Test
```

### Service-Test

```typescript
it("creates Immobilie", () => {
  const result = createImmobilie(makeImmobilie({ preis: 300000 }) as any);
  expect(result.id).toBeDefined();
  expect(result.preis).toBe(300000);
});
```

### Integration-Test

```typescript
const { baseUrl, close } = createTestServer();
const res = await fetch(`${baseUrl}/api/immobilien`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(makeImmobilie()),
});
expect(res.status).toBe(201);
```

---

## Konventionen

| Aspekt | Konvention |
|---|---|
| Dateinamen | `kebab-case.ts` |
| DB-Spalten | `snake_case` |
| TypeScript | `camelCase` für Variablen, `PascalCase` für Types/Interfaces |
| Response-Format | `{ data: T }` oder `{ data: T[], meta: { seite, limit, gesamt } }` |
| Error-Format | `{ error: { message: string, code: string } }` |
| HTTP-Status | 200 (OK), 201 (Created), 204 (No Content), 400 (Validation), 404 (Not Found), 500 (Server Error) |
| Imports | `.js`-Extension in Imports (ESM-Konvention mit Bun) |
