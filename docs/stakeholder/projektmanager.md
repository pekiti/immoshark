# ImmoShark — Stakeholder-Dokumentation: Projektmanager

## Zusammenfassung

ImmoShark ist eine lokale Webanwendung zur Verwaltung von Immobiliendaten. Sie wird als Self-Hosted-Lösung ausgeliefert — keine Cloud-Abhängigkeiten, keine laufenden Hosting-Kosten, keine Datenweitergabe an Dritte.

---

## Projektstatus

| Eigenschaft | Wert |
|---|---|
| Version | 0.3.0 |
| Lizenz | MIT |
| Produktionsbereit | MVP-Stand — Features vollständig, KI-Mapping + Freitext-Extraktion, Deployment-Optimierung offen |
| Testabdeckung | 137 automatisierte Tests (Unit, Integration, Smoke) |

---

## Geschäftswert

### Zielgruppe

Immobilienmakler und kleine Hausverwaltungen, die:
- bestehende Daten in Tabellenkalkulationen pflegen
- keine monatlichen SaaS-Kosten für eine Verwaltungssoftware wollen
- Wert auf Datensouveränität legen (alles bleibt lokal)

### Kernfunktionen

| Funktion | Nutzen |
|---|---|
| **CSV-Import mit KI-Mapping** | Bestehende Datenbestände aus Excel/Calc ohne Neueingabe übernehmen. GPT-5 erkennt unbekannte Spaltenformate und extrahiert strukturierte Daten aus Freitext-Spalten (optional, abschaltbar) |
| **Import-Profile** | Spalten-Zuordnung als benanntes Profil speichern und wiederverwenden. Standard-Profil wird automatisch beim Upload angewendet — kein wiederholtes manuelles Mapping nötig |
| **Daten-Normalisierung** | Telefonnummern werden automatisch in +49-Format normalisiert, Kfz-Kürzel (SB, SLS, HOM etc.) zu vollen Stadtnamen aufgelöst |
| **Volltextsuche** | Über alle 13 Textfelder hinweg sofort finden — Adressen, Kontakte, Notizen |
| **Dashboard** | Bestandsübersicht auf einen Blick — Statistiken, letzte Objekte, Schnellsuche |
| **Filter + Sortierung** | Bestand nach Typ, Status, Preis, Fläche, Zimmer, Datum eingrenzen |
| **CRUD-Verwaltung** | Immobilien anlegen, bearbeiten, löschen mit Validierung |

### Funktionale Abgrenzung (was ImmoShark *nicht* ist)

- Kein Portal für Endkunden (kein öffentliches Listing)
- Kein Dokumentenmanagement (keine Exposé-PDF-Generierung)
- Keine Mehrbenutzerverwaltung (kein Login-System)
- Keine Cloud-Synchronisation

---

## Technische Rahmenbedingungen

| Aspekt | Detail |
|---|---|
| Runtime | Bun (einzige System-Abhängigkeit) |
| Datenbank | SQLite (eingebettet, keine separate Installation) |
| Deployment | Lokal auf dem Rechner des Anwenders |
| Betriebssysteme | macOS, Linux, Windows (via WSL2) |
| Datenformat | Alle Daten in einer einzelnen SQLite-Datei (`data/immoshark.db`) |

### Backup-Strategie

Die gesamte Datenbank liegt in einer einzigen Datei. Backup = Datei kopieren. Kein Datenbank-Server nötig.

---

## Risiken und offene Punkte

| Risiko | Einschätzung | Mitigation |
|---|---|---|
| Keine Mehrbenutzerfähigkeit | Niedrig (Zielgruppe: Einzelnutzer) | Bei Bedarf: SQLite unterstützt WAL-Modus für gleichzeitigen Lesezugriff |
| Kein Login/Auth | Niedrig (lokal, kein Netzwerkzugang) | Bei Bedarf: Basic-Auth-Middleware nachrüstbar |
| SQLite-Skalierung | Sehr niedrig | SQLite skaliert problemlos bis ~100.000 Datensätze für diesen Use-Case |
| Datenverlust | Niedrig | WAL-Modus + einfaches Datei-Backup. Kein Cloud-Sync nötig |

---

## Meilensteine und Erweiterungsmöglichkeiten

| Phase | Inhalt | Status |
|---|---|---|
| MVP | CRUD, CSV-Import, Suche, Dashboard, Filter | Abgeschlossen |
| Qualität | Automatisierte Tests (Unit, Integration, Smoke) | Abgeschlossen |
| KI-Integration | GPT-5-basiertes Spalten-Mapping, Einstellungen, Versionierung | Abgeschlossen (v0.2.0) |
| KI-Extraktion | Freitext-Extraktion, Telefonnormalisierung, Ortsnamen-Auflösung | Abgeschlossen (v0.3.0) |
| Import-Profile | Speichern/Laden/Verwalten von CSV-Zuordnungsprofilen, Default-Profil | Abgeschlossen |
| Stabilität | Deployment-Dokumentation, Monitoring | Offen |
| Erweiterung | Exposé-PDF-Export, Bilderhandlung, Multi-User | Geplant |

---

## Weiterführende Dokumentation

| Dokument | Zielgruppe |
|---|---|
| [Benutzeranleitung](enduser/anleitung.md) | Endanwender |
| [Backend-Entwickler](backend-entwickler.md) | Backend-Entwicklung |
| [Frontend-Entwickler](frontend-entwickler.md) | Frontend-Entwicklung |
| [Tester](tester.md) | QA / Testing |
| [Ops / DevOps](ops-devops.md) | Betrieb / Deployment |
