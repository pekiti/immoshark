# ImmoShark — Stakeholder-Dokumentation: Frontend-Entwickler

## Architektur-Überblick

```text
client/
├── index.html                SPA-Einstieg
├── vite.config.ts            Vite + React + Tailwind v4 + API-Proxy
└── src/
    ├── main.tsx              React-Root (Router + Toast-Provider)
    ├── App.tsx               Route-Definitionen
    ├── api/client.ts         Typisierter Fetch-Wrapper für alle API-Aufrufe
    ├── hooks/
    │   ├── useImmobilien.ts  Liste mit Filtern laden + State verwalten
    │   └── useImmobilie.ts   Einzelnes Objekt laden
    ├── pages/
    │   ├── Dashboard.tsx     Statistiken, Schnellsuche, letzte Objekte
    │   ├── ImmobilienList.tsx Liste mit Filter + Sortierung
    │   ├── ImmobilieDetail.tsx Detailansicht
    │   ├── ImmobilieForm.tsx  Anlegen / Bearbeiten
    │   ├── CsvImport.tsx     4-Schritt-Import-Wizard mit KI-Toggle + Profilen
    │   ├── Settings.tsx      Einstellungen (KI-Mapping, Profilverwaltung)
    │   └── NotFound.tsx      404-Seite
    ├── components/
    │   ├── layout/           Sidebar, Header, Layout
    │   ├── immobilien/       Table, FilterBar, StatusBadge
    │   └── ui/               Button, Input, Select, Modal, Pagination,
    │                         Toast, RangeSlider
    └── lib/
        ├── utils.ts          Formatierungs-Helfer
        └── settings.ts       localStorage-Helper + Profil-CRUD (getProfiles, saveProfile, deleteProfile, getDefaultProfile)
```

---

## Tech-Stack

| Schicht | Technologie | Version |
|---|---|---|
| Framework | React | 19.x |
| Build-Tool | Vite | 6.x |
| Styling | Tailwind CSS (Vite-Plugin) | 4.x |
| Routing | React Router DOM | 7.x |
| TypeScript | TypeScript | 5.8 |
| Shared Types | `@immoshark/shared` (Workspace) | — |

---

## Vite-Konfiguration

```typescript
// vite.config.ts — Kernpunkte
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": resolve(__dirname, "src") } },
  server: {
    port: 5173,
    proxy: { "/api": { target: "http://localhost:3002", changeOrigin: true } },
  },
});
```

- **`@`-Alias:** `@/components/...` statt relativer Pfade
- **API-Proxy:** `/api/*` wird an den Express-Server weitergeleitet — kein CORS-Problem im Dev
- **Tailwind v4:** Kein `tailwind.config.ts` nötig — läuft als Vite-Plugin

---

## API-Client (`api/client.ts`)

Zentraler Fetch-Wrapper, der alle Endpunkte typisiert kapselt:

| Methode | Endpunkt | Rückgabe |
|---|---|---|
| `api.list(filter)` | `GET /api/immobilien?...` | `PaginatedResponse<Immobilie>` |
| `api.get(id)` | `GET /api/immobilien/:id` | `ApiResponse<Immobilie & { bilder }>` |
| `api.create(data)` | `POST /api/immobilien` | `ApiResponse<Immobilie>` |
| `api.update(id, data)` | `PUT /api/immobilien/:id` | `ApiResponse<Immobilie>` |
| `api.delete(id)` | `DELETE /api/immobilien/:id` | `void` |
| `api.stats()` | `GET /api/stats` | `ApiResponse<DashboardStats>` |
| `api.uploadCsv(file)` | `POST /api/csv/upload` | Upload-Ergebnis mit `session_id` |
| `api.suggestMapping(sessionId)` | `POST /api/csv/suggest-mapping` | KI-Mapping-Vorschlag (`CsvMappingSuggestion`) |
| `api.importCsv(sessionId, mapping)` | `POST /api/csv/import` | Import-Ergebnis |

---

## Hooks

### `useImmobilien(initialFilter)`

Verwaltet Liste + Filter-State + Pagination:

```typescript
const { data, meta, filter, setFilter, loading, error, reload } = useImmobilien();
```

- `setFilter(partial)` — Merged neue Filterwerte, löst Reload aus
- `meta` — `{ seite, limit, gesamt }` für Pagination
- Filterwerte werden als URL-Querystring synchronisiert

### `useImmobilie(id)`

Einzelnes Objekt laden:

```typescript
const { data, loading, error } = useImmobilie(id);
```

---

## Utility-Funktionen (`lib/utils.ts`)

| Funktion | Input → Output | Beispiel |
|---|---|---|
| `formatPreis(preis)` | `null → "Auf Anfrage"`, `number → "450.000 €"` | `formatPreis(450000)` |
| `formatFlaeche(flaeche)` | `null → "—"`, `number → "85 m²"` | `formatFlaeche(85)` |
| `typLabel(typ)` | `"wohnung" → "Wohnung"` | Lookup-Table, Fallback: Input |
| `statusLabel(status)` | `"verfuegbar" → "Verfügbar"` | Lookup-Table, Fallback: Input |
| `statusColor(status)` | `"verfuegbar" → "bg-green-100 text-green-800"` | Tailwind-Klassen |

Alle Funktionen haben vollständige Unit-Tests in `client/src/__tests__/utils.test.ts`.

---

## Shared Types (`@immoshark/shared`)

Das `shared`-Paket liefert Types und Validierung für Frontend und Backend:

### Zentrale Types

| Type | Zweck |
|---|---|
| `Immobilie` | Vollständiges Objekt (alle 24 Felder) |
| `ImmobilieCreateDTO` | Payload für POST (Pflichtfelder + optionale) |
| `ImmobilieUpdateDTO` | Payload für PUT (alles optional) |
| `ImmobilienFilter` | Query-Parameter für Liste |
| `PaginatedResponse<T>` | `{ data: T[], meta: { seite, limit, gesamt } }` |
| `ApiResponse<T>` | `{ data: T }` |
| `ApiError` | `{ error: { message, code } }` |
| `DashboardStats` | Stats-Payload (gesamt, verfuegbar, ..., nach_typ) |
| `CsvUploadResult` | Upload-Response (headers, preview, session_id) |
| `CsvColumnMappingValue` | `keyof ImmobilieCreateDTO \| "__freitext__" \| null` |
| `CsvColumnMapping` | `Record<string, CsvColumnMappingValue>` |
| `CsvImportProfile` | `{ id, name, mapping, aiEnabled, isDefault, createdAt, updatedAt }` — Gespeichertes Import-Profil |
| `CsvMappingSuggestion` | `{ mapping: CsvColumnMapping, source: "llm" \| "dictionary" }` |

### Enums

| Enum | Werte |
|---|---|
| `ImmobilienTyp` | `wohnung`, `haus`, `grundstueck`, `gewerbe` |
| `ImmobilienStatus` | `verfuegbar`, `reserviert`, `verkauft` |
| `EnergieausweisKlasse` | `A+`, `A`, `B` … `H` |

---

## Seiten-Übersicht

| Route | Komponente | Funktion |
|---|---|---|
| `/` | `Dashboard` | Statistiken, Schnellsuche, letzte Objekte |
| `/immobilien` | `ImmobilienList` | Filterbare/sortierbare Tabelle mit Pagination |
| `/immobilien/:id` | `ImmobilieDetail` | Detailansicht mit allen Feldern + Bilder |
| `/immobilien/neu` | `ImmobilieForm` | Formular zum Anlegen |
| `/immobilien/:id/bearbeiten` | `ImmobilieForm` | Formular zum Bearbeiten |
| `/csv-import` | `CsvImport` | 4-Schritt-Import-Wizard mit KI-Toggle + Profilauswahl/-speicherung |
| `/einstellungen` | `Settings` | Einstellungen (KI-Mapping Default, Import-Profile verwalten) |
| `*` | `NotFound` | 404-Seite |

---

## UI-Komponenten

### Layout

- **`Layout`** — Wrapper mit Sidebar + Header + Content-Bereich
- **`Sidebar`** — Navigation zu allen Hauptbereichen
- **`Header`** — Seitentitel + Versionsanzeige

### Immobilien-spezifisch

- **`FilterBar`** — Schieberegler (Preis, Fläche, Zimmer), Selects (Typ, Status, Ort), Datepicker
- **`ImmobilienTable`** — Sortierbare Tabelle mit 8 Spalten
- **`StatusBadge`** — Farbcodierter Status-Chip

### Generische UI

- **`Button`** — Primary/Secondary/Danger-Varianten
- **`Input`**, **`Select`** — Formular-Elemente
- **`Modal`** — Overlay-Dialog (z.B. Lösch-Bestätigung)
- **`Pagination`** — Seiten-Navigation
- **`Toast`** — Erfolgs-/Fehlermeldungen
- **`RangeSlider`** — Dual-Slider mit Direkteingabe

---

## Konventionen

| Aspekt | Konvention |
|---|---|
| Komponentendateien | `PascalCase.tsx` |
| Hooks | `useXxx.ts` in `hooks/` |
| Utility-Funktionen | `camelCase` in `lib/utils.ts` |
| Styling | Tailwind-Utility-Klassen direkt im JSX |
| State | Lokaler React-State + URL-Querystring, kein globaler Store |
| Imports | `@/`-Alias für `src/` |
| API-Aufrufe | Nur über `api/client.ts`, nie direkt `fetch()` |

---

## Entwicklung

```bash
# Frontend starten (mit API-Proxy)
bun run dev:client

# Nur Frontend-Tests
bun test client/

# Production-Build
bun run build    # → client/dist/
```

### Neue Komponente erstellen

1. Datei in `components/` oder `pages/` anlegen
2. Types aus `@immoshark/shared` importieren
3. API-Aufrufe über `api/client.ts`
4. Tailwind-Klassen für Styling
5. Route in `App.tsx` registrieren (falls Page)

### Neue API-Methode konsumieren

1. Endpunkt in `api/client.ts` hinzufügen
2. Response-Type in `@immoshark/shared/types.ts` definieren
3. Optional: Hook in `hooks/` erstellen
