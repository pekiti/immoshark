# ImmoShark — Stakeholder-Dokumentation: Tester / QA

## Testinfrastruktur

| Eigenschaft | Wert |
|---|---|
| Test-Runner | `bun test` (Built-in, zero-config) |
| Test-Dateien | `*.test.ts` — werden automatisch erkannt |
| DB-Isolation | `:memory:` SQLite pro Test-Suite (keine Testdaten auf Disk) |
| HTTP-Tests | `app.listen(0)` auf zufälligem Port + `fetch()` |
| Dependencies | Keine zusätzlichen — alles mit Bun-Bordmitteln |

---

## Tests ausführen

```bash
# Alle Tests
bun test

# Mit Timeout (für langsame Maschinen)
bun test --timeout 15000

# Nur Unit-Tests
bun test:unit

# Nur Integration-Tests
bun test:integration

# Nur Smoke-Tests
bun test:smoke
```

---

## Test-Suiten im Überblick

### Smoke-Tests (`server/src/__tests__/smoke/smoke.test.ts`)

Grundlegende Funktionsfähigkeit — laufen zuerst, schlagen bei fundamentalen Problemen sofort an.

| Test | Prüft |
|---|---|
| Migration auf leerer DB | Schema-Erstellung funktioniert |
| Migration idempotent | Zweimaliges Ausführen ohne Fehler |
| FTS-Triggers existieren | Volltext-Sync-Triggers vorhanden |
| Health-Endpoint | `/api/health` antwortet mit `{ status: "ok" }` |

### Unit-Tests: Validation (`shared/src/__tests__/validation.test.ts`)

Zod-Schema-Validierung — die erste Verteidigungslinie gegen ungültige Daten.

| Bereich | Tests | Prüft |
|---|---|---|
| `immobilieCreateSchema` | 15 | Pflichtfelder, PLZ-Regex, E-Mail, Baujahr-Range, Notizen-Limit, Datumformat, Status-Default |
| `immobilieUpdateSchema` | 3 | Partielle Updates, leere Objekte, Constraint-Weiterleitung |
| `immobilienFilterSchema` | 4 | Defaults, String→Number-Coercion, ungültige Sortierung |
| `csvColumnMappingSchema` | 3 | Valide Mappings, Null-Werte, ungültige Felder |

### Unit-Tests: Client-Utilities (`client/src/__tests__/utils.test.ts`)

Formatierungs- und Label-Funktionen für die UI.

| Funktion | Tests | Prüft |
|---|---|---|
| `formatPreis` | 3 | null → "Auf Anfrage", Währungsformat, Null-Preis |
| `formatFlaeche` | 3 | null → "—", m²-Format, Null-Fläche |
| `typLabel` | 5 | Alle 4 Typen + Fallback |
| `statusLabel` | 4 | Alle 3 Status + Fallback |
| `statusColor` | 4 | CSS-Klassen pro Status + Fallback |

### Unit-Tests: Mapping-Service (`server/src/__tests__/unit/mapping.test.ts`)

LLM-basierter Mapping-Service mit Dependency Injection (Mock-LLM, kein OpenAI-Aufruf).

| Bereich | Tests | Prüft |
|---|---|---|
| Valides Mapping | 1 | LLM-Antwort wird korrekt geparsed und validiert |
| Null-Werte | 1 | Nicht-gemappte Spalten bleiben `null` |
| Ungültiges JSON | 1 | Gibt `null` zurück bei nicht-parsbarer LLM-Antwort |
| Ungültige Felder | 1 | Gibt `null` zurück bei ungültigen Zielfeld-Namen |
| LLM-Fehler | 1 | Wirft bei API-Fehler korrekt weiter |

### Unit-Tests: CSV-Parsing (`server/src/__tests__/unit/csv-parsing.test.ts`)

CSV-Import-Pipeline: Parsing, deutsche Formate, Fehlerfälle.

| Bereich | Tests | Prüft |
|---|---|---|
| `parseCsvContent` | 5 | Semikolon/Komma-Erkennung, leere Datei, nur Header, Preview-Limit |
| Deutsche Zahlen | 2 | `1.234,56` → `1234.56`, einfache Zahlen |
| Deutsche Daten | 2 | `15.01.2026` → `2026-01-15`, ISO-Passthrough |
| Validierungsfehler | 1 | Ungültige Zeilen werden übersprungen + Fehler gemeldet |

### Unit-Tests: Immobilien-Service (`server/src/__tests__/unit/immobilien-service.test.ts`)

Alle 7 Service-Funktionen gegen In-Memory-DB.

| Funktion | Tests | Prüft |
|---|---|---|
| `createImmobilie` | 2 | Erstellung mit ID, optionale Felder |
| `getImmobilie` | 2 | Existierender + nicht-existierender Datensatz |
| `updateImmobilie` | 3 | Update, nicht-existent, Timestamp-Aktualisierung |
| `deleteImmobilie` | 2 | Löschen + nicht-existent |
| `listImmobilien` | 10 | Pagination, alle Filter (typ, status, ort, preis, fläche, zimmer, datum), Sortierung, Gruppierung |
| `getStats` | 3 | Status-Zähler, Durchschnittspreis, Typ-Gruppierung |
| `getRecentImmobilien` | 2 | Limit-Parameter, Default-Limit |

### Integration-Tests: API (`server/src/__tests__/integration/api.test.ts`)

Voller HTTP-Stack: Express + Middleware + Service + DB.

| Bereich | Tests | Prüft |
|---|---|---|
| Health | 1 | `/api/health` → 200 |
| CRUD | 7 | POST 201, GET 200, PUT 200, DELETE 204, 404, 400 Validation |
| Filter | 4 | Typ-Filter, Kombination, FTS-Suche, Datumsfilter |
| Stats | 1 | Dashboard-Daten korrekt |

### Integration-Tests: CSV (`server/src/__tests__/integration/csv.test.ts`)

Upload → Import Flow über HTTP inkl. Fehlerfälle.

| Bereich | Tests | Prüft |
|---|---|---|
| Upload | 2 | Headers + Preview + session_id, fehlendes File → 400 |
| Suggest-Mapping | 1 | Ungültige Session → 400 |
| Import | 4 | Mapping-Import, ungültige Session, fehlende Session, ungültiges Mapping |

---

## Testdaten

### Seed-Daten (`bun run seed`)

6 Basis-Immobilien in verschiedenen Städten, Typen und Status. Nützlich für manuelle Tests.

### Test-Helfer (`server/src/__tests__/helpers.ts`)

| Funktion | Zweck |
|---|---|
| `createTestDb()` | In-Memory-DB + Migration + Injection via `setDb()` |
| `makeImmobilie(overrides)` | Minimal-valider Immobilien-Payload, Felder überschreibbar |
| `seedTestData(db)` | 3 Testdatensätze (Berlin/München/Hamburg) direkt in DB |
| `createTestServer()` | Express auf Port 0 + `baseUrl` + `close()` |

---

## Manuelle Testszenarien

Ergänzend zu den automatisierten Tests — für explorative QA:

### CSV-Import-Flow

1. `data/beispiel-immobilien.csv` oder eigene CSV vorbereiten
2. Unter `CSV Import` hochladen
3. Spalten-Mapping prüfen (Dictionary-Auto-Erkennung sollte sofort greifen)
4. Wenn KI-Toggle aktiviert: "KI analysiert Spalten..." Spinner prüfen → Mapping wird nach kurzer Ladezeit aktualisiert
5. KI-Toggle aus-/einschalten → Mapping-Wechsel zwischen Dictionary und KI testen
6. Vorschau kontrollieren (5 Zeilen)
7. Importieren → Meldung mit importiert/übersprungen/Fehler prüfen
8. In der Immobilien-Liste die importierten Datensätze verifizieren

### Einstellungen-Seite

1. Unter `Einstellungen` navigieren
2. KI-Toggle prüfen (Default: aktiviert)
3. Toggle umschalten → Seite neu laden → Einstellung muss erhalten bleiben (localStorage)
4. CSV-Import starten → KI-Toggle im Mapping-Schritt sollte dem Settings-Default entsprechen

### Volltextsuche

1. Auf dem Dashboard im Suchfeld "München" eingeben
2. Ergebnis: nur Objekte mit München in beliebigem Textfeld
3. Numerische Suche testen: "450000" sollte die Münchner Wohnung finden

### Filter-Kombination

1. In der Liste: Typ = Wohnung + Status = Verfügbar + Preis max 400.000
2. Nur passende Objekte sollten angezeigt werden
3. URL sollte alle Filter enthalten (bookmark-fähig)

### Edge Cases

| Szenario | Erwartung |
|---|---|
| Leere CSV-Datei hochladen | Fehlermeldung |
| PLZ mit 4 Zeichen eingeben | Validierungsfehler im Formular |
| Notizen mit 501 Zeichen | Validierungsfehler |
| Objekt löschen, dann per ID aufrufen | 404 |
| Gleiche Exposé-Nummer doppelt anlegen | Unique-Constraint-Fehler |
| CSV mit KI-Toggle importieren (ohne API Key) | Fallback auf Dictionary-Mapping, kein Fehler sichtbar |
| KI-Toggle in Settings ändern + neuen Import starten | Import übernimmt neuen Default |
