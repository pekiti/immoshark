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

### Unit-Tests: Settings / Profile-CRUD (`client/src/__tests__/settings.test.ts`)

Profil-Speicherung und -Verwaltung (localStorage-basiert).

| Funktion | Tests | Prüft |
|---|---|---|
| `getProfiles` | 2 | Leere Liste, gespeicherte Profile |
| `saveProfile` | 3 | Neues Profil, Überschreiben by ID, Default-Invariante (nur ein Default gleichzeitig) |
| `getDefaultProfile` | 2 | null wenn kein Default, korrektes Default-Profil |
| `deleteProfile` | 2 | Löschen, nicht-existierendes Profil |

### Unit-Tests: Mapping-Service (`server/src/__tests__/unit/mapping.test.ts`)

LLM-basierter Mapping-Service mit Dependency Injection (Mock-LLM, kein OpenAI-Aufruf).

| Bereich | Tests | Prüft |
|---|---|---|
| `suggestMapping` — Valides Mapping | 1 | LLM-Antwort wird korrekt geparsed und validiert |
| `suggestMapping` — Null-Werte | 1 | Nicht-gemappte Spalten bleiben `null` |
| `suggestMapping` — Ungültiges JSON | 1 | Gibt `null` zurück bei nicht-parsbarer LLM-Antwort |
| `suggestMapping` — Ungültige Felder | 1 | Gibt `null` zurück bei ungültigen Zielfeld-Namen |
| `suggestMapping` — LLM-Fehler | 1 | Wirft bei API-Fehler korrekt weiter |
| `extractFromFreetext` — Extraktion | 1 | Strukturierte Daten aus Fließtext extrahiert |
| `extractFromFreetext` — Batching | 1 | Texte werden in konfigurierbaren Batches verarbeitet |
| `extractFromFreetext` — LLM-Fehler | 1 | Gibt leere Objekte zurück statt abzubrechen |
| `extractFromFreetext` — Ungültiges JSON | 1 | Gibt leere Objekte zurück bei unparsebarer Antwort |

### Unit-Tests: CSV-Parsing (`server/src/__tests__/unit/csv-parsing.test.ts`)

CSV-Import-Pipeline: Parsing, deutsche Formate, Normalisierung, Fehlerfälle.

| Bereich | Tests | Prüft |
|---|---|---|
| `parseCsvContent` | 5 | Semikolon/Komma-Erkennung, leere Datei, nur Header, Preview-Limit |
| Deutsche Zahlen | 2 | `1.234,56` → `1234.56`, einfache Zahlen |
| Deutsche Daten | 2 | `15.01.2026` → `2026-01-15`, ISO-Passthrough |
| Validierungsfehler | 1 | Ungültige Zeilen werden übersprungen + Fehler gemeldet |
| `normalizeGermanPhone` | 7 | 0-Prefix, 0049-Prefix, +49-Format, Mobilnummern, Sonderzeichen, Nicht-deutsch, leer |
| `resolveCityAbbreviation` | 5 | SB→Saarbrücken, SLS→Saarlouis, HOM→Homburg, Case-Insensitiv, unbekannte Kürzel |

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
| Import | 5 | Mapping-Import, `__freitext__`-Mapping, ungültige Session, fehlende Session, ungültiges Mapping |

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

### Import-Profile

1. CSV hochladen → Mapping konfigurieren → "Speichern" klicken
2. "Neues Profil anlegen" wählen → Name eingeben (z.B. "Saarland-Format") → Speichern
3. Toast-Benachrichtigung "Profil gespeichert" prüfen
4. Profil im Dropdown sichtbar → auswählen → Mapping wird übernommen
5. Mapping ändern → "Speichern" → "Bestehendes überschreiben" wählen → Speichern
6. Erneut CSV hochladen → Profil aus Dropdown wählen → nur passende Header werden gemappt, neue Spalten bleiben "Nicht importieren"
7. Profil mit "Als Standard-Profil setzen" speichern → neue CSV hochladen → Standard-Profil wird automatisch angewendet + im Dropdown vorausgewählt
8. In Einstellungen → Profil-Liste prüfen: Name, Erstelldatum, Spaltenanzahl, KI-Status, Standard-Badge
9. "Als Standard" Button klicken → Badge wechselt → anderes Profil als Standard setzen → nur eines kann Standard sein
10. "Löschen" klicken → Bestätigung → Profil verschwindet

### Einstellungen-Seite

1. Unter `Einstellungen` navigieren
2. KI-Toggle prüfen (Default: aktiviert)
3. Toggle umschalten → Seite neu laden → Einstellung muss erhalten bleiben (localStorage)
4. CSV-Import starten → KI-Toggle im Mapping-Schritt sollte dem Settings-Default entsprechen
5. Import-Profile-Abschnitt prüfen: zeigt alle gespeicherten Profile mit Metadaten
6. Wenn keine Profile vorhanden: "Keine Profile vorhanden." angezeigt

### Volltextsuche

1. Auf dem Dashboard im Suchfeld "München" eingeben
2. Ergebnis: nur Objekte mit München in beliebigem Textfeld
3. Numerische Suche testen: "450000" sollte die Münchner Wohnung finden

### Filter-Kombination

1. In der Liste: Typ = Wohnung + Status = Verfügbar + Preis max 400.000
2. Nur passende Objekte sollten angezeigt werden
3. URL sollte alle Filter enthalten (bookmark-fähig)

### Freitext-Extraktion

1. CSV mit einer Fließtext-Spalte vorbereiten (z.B. "Info" mit Text wie "Wohnung in der Hauptstr. 10, 10115 Berlin, 250.000 Euro")
2. CSV hochladen
3. Im Mapping-Schritt die Spalte auf "Freitext-Extraktion (KI)" setzen
4. Vorschau prüfen → Import starten
5. In der Immobilien-Liste prüfen: extrahierte Daten sollten in den richtigen Feldern stehen
6. Test mit gemischtem Mapping: eine Spalte direkt mappen (z.B. "Preis") + Freitext-Spalte → direktes Mapping muss Vorrang haben

### Telefonnormalisierung

1. CSV importieren mit Telefonnummer-Spalte, verschiedene Formate: `0681/12345`, `+49 681 12345`, `0171-1234567`
2. In der Detailansicht prüfen: alle Nummern sollten im Format `+49 VORWAHL NUMMER` stehen

### Ortsnamen-Auflösung

1. CSV importieren mit Ort-Spalte, Kfz-Kürzel verwenden: `SB`, `SLS`, `HOM`
2. In der Detailansicht prüfen: Ortsnamen sollten aufgelöst sein (Saarbrücken, Saarlouis, Homburg)
3. Nicht-Kürzel (z.B. "München") sollten unverändert bleiben

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
| Profil ohne Namen speichern | Speichern-Button deaktiviert |
| Profil laden mit anderer CSV (andere Spalten) | Nur passende Header werden gemappt, neue bleiben `null` |
| Standard-Profil setzen + CSV hochladen | Standard-Profil wird automatisch angewendet, kein autoMap/KI-Call |
| Alle Profile löschen + Einstellungen prüfen | "Keine Profile vorhanden." angezeigt |
| localStorage leeren + Seite neu laden | Profile-Liste leer, kein Fehler |
