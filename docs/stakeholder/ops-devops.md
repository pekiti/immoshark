# ImmoShark — Stakeholder-Dokumentation: Ops / DevOps

## Systemarchitektur

```text
┌──────────────┐     ┌──────────────────┐      ┌─────────────────────┐
│  Browser     │────▶│ Vite Dev-Server  │─────▶│ Express API (:3002) │
│ (:5173)      │     │ (Proxy /api/*)   │      │   ├── Routes        │
└──────────────┘     └──────────────────┘      │   ├── Services      │
                                               │   └── SQLite        │
                                               │       (WAL + FTS5)  │
                                               └─────────────────────┘
                                                       │
                                                       ▼
                                               ┌─────────────────────┐
                                               │ data/immoshark.db   │
                                               │ (einzelne Datei)    │
                                               └─────────────────────┘
```

**Production-Variante:** Vite baut statische Dateien (`client/dist/`), die von Express oder einem Reverse-Proxy (nginx) direkt ausgeliefert werden.

---

## Systemvoraussetzungen

| Komponente | Minimum | Empfohlen |
|---|---|---|
| **Bun** | >= 1.1 | >= 1.3 |
| **RAM** | 256 MB | 512 MB |
| **Festplatte** | 100 MB (App) + DB-Größe | SSD empfohlen für SQLite-Performance |
| **OS** | macOS, Linux, Windows (WSL2) | macOS oder Linux |

Keine weiteren Abhängigkeiten: kein Node.js, kein Python, kein Docker, kein externer DB-Server.

---

## Installation

```bash
# Repository klonen
git clone https://github.com/pekiti/immoshark.git
cd immoshark

# Abhängigkeiten installieren
bun install

# Optional: Testdaten laden
bun run seed
```

---

## Starten

### Entwicklung

```bash
bun run dev           # API (:3002) + Frontend (:5173) gleichzeitig
bun run dev:server    # Nur API (mit --watch für Auto-Reload)
bun run dev:client    # Nur Frontend (Vite HMR)
```

### Produktion

```bash
# Frontend bauen
bun run build

# Server starten (serviert API, Frontend-Dateien separat)
PORT=3002 bun run --cwd server start
```

Für Produktion: statische Dateien aus `client/dist/` über nginx oder Express-Static servieren.

---

## Konfiguration

| Variable | Default | Beschreibung |
|---|---|---|
| `PORT` | `3002` | API-Server Port |
| `OPENAI_API_KEY` | — | OpenAI API Key für KI-Spalten-Mapping (optional). Ohne Key funktioniert das Dictionary-basierte Auto-Mapping weiterhin. |

### Datenbank-Pfad

Die SQLite-Datei liegt standardmäßig in `data/immoshark.db` (relativ zum Projekt-Root). Wird automatisch erstellt beim ersten Start.

---

## Datenbank-Management

### SQLite-Pragmas (automatisch gesetzt)

| Pragma | Wert | Zweck |
|---|---|---|
| `journal_mode` | WAL | Write-Ahead Logging — bessere Parallelität, crash-sicher |
| `foreign_keys` | ON | Referentielle Integrität (Cascade-Deletes für Bilder) |

### Migration

Migrationen laufen **automatisch** beim ersten `getDb()`-Aufruf:

- Tabellen werden mit `IF NOT EXISTS` angelegt
- Fehlende Spalten werden mit `ALTER TABLE ADD COLUMN` ergänzt
- FTS5-Index wird bei Schema-Änderungen automatisch neu aufgebaut
- Triggers werden idempotent angelegt

**Kein manueller Migrations-Schritt nötig.**

### Backup

```bash
# Einfachstes Backup: Datei kopieren
cp data/immoshark.db data/immoshark_backup_$(date +%Y%m%d).db

# Oder mit SQLite-Bordmitteln (konsistenter bei laufendem Server)
sqlite3 data/immoshark.db ".backup data/immoshark_backup.db"
```

### Wiederherstellung

```bash
cp data/immoshark_backup.db data/immoshark.db
# Server neu starten
```

---

## Monitoring

### Health-Check

```bash
curl http://localhost:3002/api/health
# Erwartet: { "status": "ok" }
```

Kann als Liveness-Probe in Monitoring-Tools (Uptime Kuma, Healthchecks.io) verwendet werden.

### Logs

Express loggt auf `stderr`:
- Unbehandelte Fehler werden vom globalen Error-Handler abgefangen
- Format: Stack-Trace auf der Konsole

Für strukturiertes Logging in Produktion wäre ein Logger wie `pino` nachrüstbar.

---

## Prozess-Management

### Systemd (Linux)

```ini
# /etc/systemd/system/immoshark.service
[Unit]
Description=ImmoShark API
After=network.target

[Service]
Type=simple
User=immoshark
WorkingDirectory=/opt/immoshark
ExecStart=/usr/local/bin/bun run --cwd server start
Restart=on-failure
Environment=PORT=3002

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable immoshark
sudo systemctl start immoshark
```

### launchd (macOS)

```xml
<!-- ~/Library/LaunchAgents/de.immoshark.api.plist -->
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>de.immoshark.api</string>
  <key>ProgramArguments</key>
  <array>
    <string>/usr/local/bin/bun</string>
    <string>run</string>
    <string>--cwd</string>
    <string>server</string>
    <string>start</string>
  </array>
  <key>WorkingDirectory</key>
  <string>/opt/immoshark</string>
  <key>KeepAlive</key>
  <true/>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PORT</key>
    <string>3002</string>
  </dict>
</dict>
</plist>
```

---

## Sicherheitshinweise

| Aspekt | Status | Anmerkung |
|---|---|---|
| SQL-Injection | Geschützt | Parametrisierte Queries + Whitelist für ORDER BY |
| XSS | Geschützt | React escaped standardmäßig |
| CORS | Offen (`*`) | Für lokalen Betrieb akzeptabel; für Netzwerk einschränken |
| Auth | Nicht vorhanden | Lokale Anwendung; bei Netzwerk-Exposition nachrüsten |
| HTTPS | Nicht konfiguriert | Für lokalen Betrieb nicht nötig; bei Netzwerk über Reverse-Proxy |
| Rate-Limiting | Nicht vorhanden | Für lokalen Betrieb nicht nötig |
| File-Upload | 10 MB Limit | Multer-Config, nur CSV erlaubt |

---

## Dateisystem-Übersicht (für Ops relevant)

```text
immoshark/
├── data/immoshark.db          ← Produktionsdaten (BACKUP-RELEVANT)
├── client/dist/               ← Production-Build (nach `bun run build`)
├── server/src/index.ts        ← Server-Einstiegspunkt
├── package.json               ← Workspace-Root mit Scripts
└── node_modules/              ← Abhängigkeiten (reproduzierbar via `bun install`)
```

---

## Troubleshooting

| Problem | Ursache | Lösung |
|---|---|---|
| `EADDRINUSE :3002` | Port belegt | Anderen Port via `PORT=3003 bun run start` oder Prozess beenden |
| `database is locked` | Gleichzeitiger Schreibzugriff | WAL-Modus sollte das vermeiden; ggf. andere Prozesse prüfen |
| Leere Datenbank | Erststart oder DB gelöscht | `bun run seed` für Testdaten |
| `bun: command not found` | Bun nicht installiert | `curl -fsSL https://bun.sh/install \| bash` |
| FTS-Suche findet nichts | FTS-Index veraltet | Migration wird automatisch ausgeführt; Server neustarten |
