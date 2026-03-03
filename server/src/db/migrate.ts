import type { Database } from "bun:sqlite";

export function migrate(db: Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS immobilien (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      strasse TEXT NOT NULL,
      hausnummer TEXT NOT NULL,
      plz TEXT NOT NULL,
      ort TEXT NOT NULL,
      preis REAL,
      wohnflaeche REAL,
      grundstuecksflaeche REAL,
      zimmeranzahl REAL,
      typ TEXT NOT NULL CHECK(typ IN ('wohnung','haus','grundstueck','gewerbe')),
      baujahr INTEGER,
      beschreibung TEXT,
      provision TEXT,
      energieausweis_klasse TEXT CHECK(energieausweis_klasse IN ('A+','A','B','C','D','E','F','G','H')),
      energieausweis_verbrauch REAL,
      kontakt_name TEXT,
      kontakt_telefon TEXT,
      kontakt_email TEXT,
      expose_nummer TEXT UNIQUE,
      status TEXT NOT NULL DEFAULT 'verfuegbar' CHECK(status IN ('verfuegbar','reserviert','verkauft')),
      erstellt_am TEXT NOT NULL DEFAULT (datetime('now')),
      aktualisiert_am TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_immobilien_ort ON immobilien(ort);
    CREATE INDEX IF NOT EXISTS idx_immobilien_plz ON immobilien(plz);
    CREATE INDEX IF NOT EXISTS idx_immobilien_typ ON immobilien(typ);
    CREATE INDEX IF NOT EXISTS idx_immobilien_status ON immobilien(status);
    CREATE INDEX IF NOT EXISTS idx_immobilien_preis ON immobilien(preis);

    CREATE TABLE IF NOT EXISTS immobilien_bilder (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      immobilie_id INTEGER NOT NULL REFERENCES immobilien(id) ON DELETE CASCADE,
      url TEXT NOT NULL,
      beschreibung TEXT,
      reihenfolge INTEGER NOT NULL DEFAULT 0
    );

    CREATE VIRTUAL TABLE IF NOT EXISTS immobilien_fts USING fts5(
      strasse, hausnummer, plz, ort, beschreibung, kontakt_name, expose_nummer,
      content='immobilien',
      content_rowid='id',
      tokenize='unicode61'
    );
  `);

  // Sync triggers for FTS
  const triggerExists = db
    .query("SELECT name FROM sqlite_master WHERE type='trigger' AND name='immobilien_ai'")
    .get();

  if (!triggerExists) {
    db.exec(`
      CREATE TRIGGER immobilien_ai AFTER INSERT ON immobilien BEGIN
        INSERT INTO immobilien_fts(rowid, strasse, hausnummer, plz, ort, beschreibung, kontakt_name, expose_nummer)
        VALUES (new.id, new.strasse, new.hausnummer, new.plz, new.ort, new.beschreibung, new.kontakt_name, new.expose_nummer);
      END;

      CREATE TRIGGER immobilien_ad AFTER DELETE ON immobilien BEGIN
        INSERT INTO immobilien_fts(immobilien_fts, rowid, strasse, hausnummer, plz, ort, beschreibung, kontakt_name, expose_nummer)
        VALUES ('delete', old.id, old.strasse, old.hausnummer, old.plz, old.ort, old.beschreibung, old.kontakt_name, old.expose_nummer);
      END;

      CREATE TRIGGER immobilien_au AFTER UPDATE ON immobilien BEGIN
        INSERT INTO immobilien_fts(immobilien_fts, rowid, strasse, hausnummer, plz, ort, beschreibung, kontakt_name, expose_nummer)
        VALUES ('delete', old.id, old.strasse, old.hausnummer, old.plz, old.ort, old.beschreibung, old.kontakt_name, old.expose_nummer);
        INSERT INTO immobilien_fts(rowid, strasse, hausnummer, plz, ort, beschreibung, kontakt_name, expose_nummer)
        VALUES (new.id, new.strasse, new.hausnummer, new.plz, new.ort, new.beschreibung, new.kontakt_name, new.expose_nummer);
      END;
    `);
  }
}
