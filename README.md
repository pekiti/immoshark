# ImmoShark

[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Bun](https://img.shields.io/badge/Bun-1.3-F9F1E1?logo=bun&logoColor=black)](https://bun.sh/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Express](https://img.shields.io/badge/Express-5-000000?logo=express&logoColor=white)](https://expressjs.com/)
[![SQLite](https://img.shields.io/badge/SQLite-WAL+FTS5-003B57?logo=sqlite&logoColor=white)](https://www.sqlite.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Lokale Webanwendung zur Verwaltung von Immobiliendaten. Importiere Objekte per CSV, durchsuche den Bestand mit Volltextsuche und pflege alle Daten per CRUD-Oberfläche — alles läuft lokal, ohne Cloud-Abhängigkeiten.

---

## Zweck

ImmoShark richtet sich an Immobilienmakler, die eine schlanke, lokale Lösung zum Verwalten ihres Bestands brauchen:

- **CSV-Import** — Bestehende Daten aus Tabellenkalkulationen übernehmen (deutsche Formate: `;`-Trennzeichen, Dezimalkomma)
- **Volltextsuche** — Über Adressen, Beschreibungen und Kontaktdaten suchen (FTS5 mit Unicode-Support für Umlaute)
- **CRUD-Verwaltung** — Immobilien anlegen, bearbeiten, löschen mit Validierung
- **Dashboard** — Bestand auf einen Blick: Statistiken, Schnellsuche, letzte Objekte
- **Filterbare Liste** — Nach Typ, Status, Ort, Preis, Fläche und Zimmerzahl filtern

---

## Architektur

ImmoShark ist ein **Bun-Monorepo** mit drei Paketen:

```
immoshark/
├── shared/          @immoshark/shared — Types, Enums, Zod-Validierung
├── server/          @immoshark/server — Express 5 REST-API
├── client/          @immoshark/client — React 19 SPA
└── data/            SQLite-Datenbank + Beispiel-CSV
```

### Datenfluss

```
Browser (React SPA)
    │
    │  fetch /api/*
    ▼
Vite Dev Proxy (:5173 → :3002)
    │
    ▼
Express API (:3002)
    │  Zod-Validierung
    │  Service Layer (raw SQL)
    ▼
SQLite (WAL-Modus, FTS5)
    └── data/immoshark.db
```

### Tech-Stack

| Schicht | Technologie | Warum |
|---------|-------------|-------|
| Runtime | **Bun** | Native SQLite-Bindings, TypeScript ohne Compile-Step, schneller Paketmanager |
| API | **Express 5** | Bewährt, großes Ökosystem, einfaches Routing |
| Datenbank | **SQLite** (WAL + FTS5) | Zero-Config, eingebettet, Volltextsuche ohne externen Service |
| Validierung | **Zod** | Shared zwischen Client und Server, Runtime-Validierung mit Typ-Inferenz |
| Frontend | **React 19** + **Vite** | Schnelles HMR, modernes JSX-Transform |
| Styling | **Tailwind CSS 4** | Utility-First, kein separates Config-File nötig (v4 Vite Plugin) |

### Designentscheidungen

- **Kein ORM** — Raw SQL via `bun:sqlite` ist schneller und expliziter. Das Mapping zwischen camelCase (TypeScript) und snake_case (SQL) findet im Service-Layer statt.
- **FTS5 mit `unicode61` Tokenizer** — Deutsche Umlaute (ä, ö, ü, ß) werden korrekt tokenisiert. Sync-Triggers halten den FTS-Index automatisch aktuell.
- **URL-basierte Filter** — Alle Filterparameter liegen in der URL. Das macht Filter bookmarkbar und braucht keinen globalen State-Manager.
- **Bilder als separate Tabelle** — Statt JSON-Array in der Immobilien-Tabelle. Ermöglicht Sortierung und zukünftige Erweiterungen.

---

## Voraussetzungen

| Tool | Version | Zweck | Installation |
|------|---------|-------|-------------|
| **Git** | >= 2.x | Versionskontrolle | [git-scm.com](https://git-scm.com/) oder `brew install git` |
| **Bun** | >= 1.1 | Runtime, Paketmanager, SQLite | [bun.sh/install](https://bun.sh/) |

Bun ersetzt Node.js, npm und einen separaten TypeScript-Compiler. Es bringt native SQLite-Bindings mit — dadurch entfällt eine separate SQLite-Installation.

> **Hinweis:** Vite und TypeScript werden als Projekt-Abhängigkeiten installiert (nicht global nötig). Docker wird für die Entwicklung nicht benötigt.

### Plattform-spezifisch

**macOS:**
```bash
# Xcode Command Line Tools (für Git)
xcode-select --install

# Bun
curl -fsSL https://bun.sh/install | bash
```

**Linux (Ubuntu/Debian):**
```bash
sudo apt update && sudo apt install -y git curl unzip
curl -fsSL https://bun.sh/install | bash
```

**Windows (WSL2):**
```bash
# In WSL2-Terminal:
curl -fsSL https://bun.sh/install | bash
```

---

## Installation & Start

```bash
# 1. Repository klonen
git clone https://github.com/pekiti/immoshark.git
cd immoshark

# 2. Abhängigkeiten installieren
bun install

# 3. Testdaten laden (6 Beispiel-Immobilien)
bun run seed

# 4. Entwicklungsserver starten
bun run dev
```

Das startet zwei Prozesse:
- **API-Server** auf `http://localhost:3002` (Express + SQLite)
- **Frontend** auf `http://localhost:5173` (Vite mit API-Proxy)

Öffne `http://localhost:5173` im Browser.

### Einzelne Dienste starten

```bash
bun run dev:server    # Nur API (Port 3002, mit --watch)
bun run dev:client    # Nur Frontend (Port 5173)
```

### Production-Build

```bash
bun run build         # Baut das Frontend nach client/dist/
```

---

## Daten-Schema

### `immobilien` — Haupttabelle

Alle Immobilienobjekte mit Adresse, Kennzahlen, Energieausweis und Kontaktdaten.

| Spalte | Typ | Pflicht | Beschreibung |
|--------|-----|---------|--------------|
| `id` | INTEGER | PK | Auto-Increment Primärschlüssel |
| `strasse` | TEXT | ja | Straßenname |
| `hausnummer` | TEXT | ja | Hausnummer (inkl. Zusatz wie "12a") |
| `plz` | TEXT | ja | 5-stellige Postleitzahl |
| `ort` | TEXT | ja | Stadt / Gemeinde |
| `preis` | REAL | — | Kaufpreis in Euro. `NULL` = "Preis auf Anfrage" |
| `wohnflaeche` | REAL | — | Wohnfläche in m² |
| `grundstuecksflaeche` | REAL | — | Grundstücksfläche in m² |
| `zimmeranzahl` | REAL | — | Anzahl Zimmer (REAL für Werte wie 2.5) |
| `typ` | TEXT | ja | Objekttyp: `wohnung`, `haus`, `grundstueck`, `gewerbe` |
| `baujahr` | INTEGER | — | Baujahr (1800–aktuell+5) |
| `beschreibung` | TEXT | — | Freitext-Beschreibung des Objekts |
| `provision` | TEXT | — | Provisionsinformation (z.B. "3,57% inkl. MwSt.") |
| `energieausweis_klasse` | TEXT | — | Energieeffizienzklasse: `A+`, `A`, `B`, `C`, `D`, `E`, `F`, `G`, `H` |
| `energieausweis_verbrauch` | REAL | — | Energieverbrauch in kWh/m²a |
| `kontakt_name` | TEXT | — | Ansprechpartner |
| `kontakt_telefon` | TEXT | — | Telefonnummer |
| `kontakt_email` | TEXT | — | E-Mail-Adresse |
| `expose_nummer` | TEXT | — | Eindeutige Exposé-Nummer (`UNIQUE`) |
| `status` | TEXT | ja | Objektstatus: `verfuegbar`, `reserviert`, `verkauft` |
| `erstellt_am` | TEXT | auto | ISO-Timestamp, gesetzt bei INSERT |
| `aktualisiert_am` | TEXT | auto | ISO-Timestamp, aktualisiert bei UPDATE |

**Indizes:** `ort`, `plz`, `typ`, `status`, `preis`

### `immobilien_bilder` — Bildreferenzen

| Spalte | Typ | Pflicht | Beschreibung |
|--------|-----|---------|--------------|
| `id` | INTEGER | PK | Auto-Increment |
| `immobilie_id` | INTEGER | FK | Referenz auf `immobilien.id` (`ON DELETE CASCADE`) |
| `url` | TEXT | ja | Bild-URL oder Dateipfad |
| `beschreibung` | TEXT | — | Alt-Text / Bildbeschreibung |
| `reihenfolge` | INTEGER | ja | Sortierungsreihenfolge (Default: 0) |

### `immobilien_fts` — Volltextsuche (FTS5)

Virtueller FTS5-Index über ausgewählte Spalten der `immobilien`-Tabelle. Wird automatisch durch Triggers synchronisiert (INSERT, UPDATE, DELETE).

**Indizierte Felder:** `strasse`, `hausnummer`, `plz`, `ort`, `beschreibung`, `kontakt_name`, `expose_nummer`

**Tokenizer:** `unicode61` — unterstützt deutsche Umlaute und diakritische Zeichen.

### ER-Diagramm

```
┌──────────────────────┐        ┌─────────────────────┐
│     immobilien       │        │  immobilien_bilder   │
├──────────────────────┤        ├─────────────────────┤
│ id             PK    │──1:N──▶│ id             PK   │
│ strasse              │        │ immobilie_id   FK   │
│ hausnummer           │        │ url                 │
│ plz                  │        │ beschreibung        │
│ ort                  │        │ reihenfolge         │
│ preis                │        └─────────────────────┘
│ wohnflaeche          │
│ grundstuecksflaeche  │        ┌─────────────────────┐
│ zimmeranzahl         │        │   immobilien_fts    │
│ typ                  │        │ (FTS5 Virtual Table)│
│ baujahr              │        ├─────────────────────┤
│ beschreibung         │──sync─▶│ strasse             │
│ provision            │  via   │ hausnummer          │
│ energieausweis_*     │triggers│ plz                 │
│ kontakt_*            │        │ ort                 │
│ expose_nummer  UQ    │        │ beschreibung        │
│ status               │        │ kontakt_name        │
│ erstellt_am          │        │ expose_nummer       │
│ aktualisiert_am      │        └─────────────────────┘
└──────────────────────┘
```

---

## API-Endpunkte

| Methode | Pfad | Beschreibung |
|---------|------|--------------|
| `GET` | `/api/health` | Health-Check |
| `GET` | `/api/immobilien` | Liste (paginiert, filterbar, FTS-Suche via `?suche=`) |
| `GET` | `/api/immobilien/:id` | Detailansicht inkl. Bilder |
| `POST` | `/api/immobilien` | Neues Objekt anlegen |
| `PUT` | `/api/immobilien/:id` | Objekt aktualisieren |
| `DELETE` | `/api/immobilien/:id` | Objekt löschen |
| `GET` | `/api/stats` | Dashboard-Statistiken |
| `POST` | `/api/csv/upload` | CSV hochladen (gibt Headers + Vorschau zurück) |
| `POST` | `/api/csv/import` | CSV importieren mit Spalten-Mapping |

**Filter-Parameter** für `GET /api/immobilien`:

| Parameter | Typ | Beispiel | Beschreibung |
|-----------|-----|----------|-------------|
| `suche` | string | `?suche=München` | FTS5-Volltextsuche (Prefix-Matching) |
| `typ` | enum | `?typ=wohnung` | Objekttyp filtern |
| `status` | enum | `?status=verfuegbar` | Status filtern |
| `ort` | string | `?ort=Berlin` | Ort (Teilstring-Suche) |
| `preis_min` | number | `?preis_min=200000` | Mindestpreis |
| `preis_max` | number | `?preis_max=500000` | Höchstpreis |
| `flaeche_min` | number | `?flaeche_min=60` | Mindest-Wohnfläche (m²) |
| `flaeche_max` | number | `?flaeche_max=120` | Höchst-Wohnfläche (m²) |
| `zimmer_min` | number | `?zimmer_min=2` | Mindest-Zimmeranzahl |
| `zimmer_max` | number | `?zimmer_max=4` | Höchst-Zimmeranzahl |
| `seite` | number | `?seite=2` | Seitennummer (Default: 1) |
| `limit` | number | `?limit=10` | Ergebnisse pro Seite (Default: 20, Max: 100) |

**Response-Format:**

Erfolg (Einzel):
```json
{ "data": { "id": 1, "strasse": "Musterstraße", "..." : "..." } }
```

Erfolg (Liste mit Pagination):
```json
{ "data": [...], "meta": { "seite": 1, "limit": 20, "gesamt": 42 } }
```

Fehler:
```json
{ "error": { "message": "Beschreibung", "code": "VALIDATION_ERROR" } }
```

---

## Projektstruktur

```
immoshark/
├── package.json                  Workspace-Root, Scripts
├── tsconfig.base.json            Gemeinsame TypeScript-Konfiguration
├── shared/src/
│   ├── types.ts                  Interfaces, Enums, DTOs
│   ├── validation.ts             Zod-Schemas (Client + Server)
│   └── index.ts                  Re-Export
├── server/src/
│   ├── index.ts                  Server-Einstiegspunkt
│   ├── app.ts                    Express-Setup, Middleware, Routing
│   ├── db/
│   │   ├── database.ts           SQLite-Singleton (WAL, Foreign Keys)
│   │   ├── migrate.ts            Schema-Migration (Tabellen, FTS5, Triggers)
│   │   └── seed.ts               6 Beispiel-Immobilien
│   ├── routes/
│   │   ├── immobilien.ts         CRUD + Stats Endpoints
│   │   └── csv.ts                CSV Upload + Import
│   ├── services/
│   │   ├── immobilien.service.ts Datenbank-Queries, Filter, FTS
│   │   └── csv.service.ts        CSV-Parsing, Delimiter-Detection, Mapping
│   └── middleware/
│       ├── error.ts              Globaler Error-Handler
│       └── validate.ts           Zod-Validierungs-Middleware
├── client/
│   ├── index.html                SPA-Einstieg
│   ├── vite.config.ts            Vite + Tailwind v4 + API-Proxy
│   └── src/
│       ├── main.tsx              React-Root mit Router + Toast-Provider
│       ├── App.tsx               Route-Definitionen
│       ├── api/client.ts         Typisierter Fetch-Wrapper
│       ├── hooks/                useImmobilien, useImmobilie
│       ├── pages/                Dashboard, Liste, Detail, Form, CSV, 404
│       ├── components/
│       │   ├── layout/           Sidebar, Header, Layout
│       │   ├── immobilien/       Table, FilterBar, StatusBadge
│       │   ├── csv/              (CSV-Wizard inline in CsvImport.tsx)
│       │   └── ui/               Button, Input, Select, Modal, Pagination, Toast
│       └── lib/utils.ts          Formatierung (Preis, Fläche, Labels)
└── data/
    └── beispiel-immobilien.csv   Beispiel-CSV mit deutschen Formaten
```

---

## Lizenz

MIT
