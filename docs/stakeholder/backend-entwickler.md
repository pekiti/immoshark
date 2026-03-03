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
│   └── csv.ts                Upload + Import (Multer + In-Memory-Session)
├── services/
│   ├── immobilien.service.ts Queries: list, get, create, update, delete, stats, recent
│   └── csv.service.ts        Parsing: Delimiter, dt. Zahlen/Datum, Validation, Import
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
| `importCsvData(content, mapping)` | Voll-Import: Mapping → dt. Zahlen/Datum → Zod-Validation → DB |

Interne Hilfsfunktionen (nicht exportiert):
- `detectDelimiter`: Zählt `;` vs `,` in der ersten Zeile
- `parseGermanNumber`: `1.234,56` → `1234.56`
- `parseGermanDate`: `15.01.2026` → `2026-01-15`

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
POST   /api/csv/upload       → multer.single("file") → parseCsvContent → session in Map
POST   /api/csv/import       → session lookup → validate mapping → importCsvData
```

CSV-Sessions werden in einer In-Memory `Map<string, string>` gespeichert und nach 10 Minuten automatisch gelöscht.

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
