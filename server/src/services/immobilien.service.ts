import { getDb } from "../db/database.js";
import type {
  Immobilie,
  ImmobilieCreateDTO,
  ImmobilieUpdateDTO,
  ImmobilienFilter,
  ImmobilieBild,
  DashboardStats,
} from "@immoshark/shared";

export function listImmobilien(filter: ImmobilienFilter) {
  const db = getDb();
  const conditions: string[] = [];
  const params: Record<string, unknown> = {};

  // FTS5 full-text search
  if (filter.suche) {
    conditions.push(
      "i.id IN (SELECT rowid FROM immobilien_fts WHERE immobilien_fts MATCH $suche)"
    );
    // Add * for prefix matching
    params.$suche = filter.suche
      .split(/\s+/)
      .filter(Boolean)
      .map((t) => `"${t}"*`)
      .join(" ");
  }

  if (filter.typ) {
    conditions.push("i.typ = $typ");
    params.$typ = filter.typ;
  }
  if (filter.status) {
    conditions.push("i.status = $status");
    params.$status = filter.status;
  }
  if (filter.ort) {
    conditions.push("i.ort LIKE $ort");
    params.$ort = `%${filter.ort}%`;
  }
  if (filter.preis_min != null) {
    conditions.push("i.preis >= $preis_min");
    params.$preis_min = filter.preis_min;
  }
  if (filter.preis_max != null) {
    conditions.push("i.preis <= $preis_max");
    params.$preis_max = filter.preis_max;
  }
  if (filter.flaeche_min != null) {
    conditions.push("i.wohnflaeche >= $flaeche_min");
    params.$flaeche_min = filter.flaeche_min;
  }
  if (filter.flaeche_max != null) {
    conditions.push("i.wohnflaeche <= $flaeche_max");
    params.$flaeche_max = filter.flaeche_max;
  }
  if (filter.zimmer_min != null) {
    conditions.push("i.zimmeranzahl >= $zimmer_min");
    params.$zimmer_min = filter.zimmer_min;
  }
  if (filter.zimmer_max != null) {
    conditions.push("i.zimmeranzahl <= $zimmer_max");
    params.$zimmer_max = filter.zimmer_max;
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const limit = filter.limit ?? 20;
  const offset = ((filter.seite ?? 1) - 1) * limit;

  const countRow = db
    .query(`SELECT COUNT(*) as count FROM immobilien i ${where}`)
    .get(params) as { count: number };

  const rows = db
    .query(
      `SELECT i.* FROM immobilien i ${where} ORDER BY i.aktualisiert_am DESC LIMIT $limit OFFSET $offset`
    )
    .all({ ...params, $limit: limit, $offset: offset }) as Immobilie[];

  return {
    data: rows,
    meta: { seite: filter.seite ?? 1, limit, gesamt: countRow.count },
  };
}

export function getImmobilie(id: number): (Immobilie & { bilder: ImmobilieBild[] }) | null {
  const db = getDb();
  const row = db.query("SELECT * FROM immobilien WHERE id = $id").get({ $id: id }) as Immobilie | null;
  if (!row) return null;

  const bilder = db
    .query("SELECT * FROM immobilien_bilder WHERE immobilie_id = $id ORDER BY reihenfolge")
    .all({ $id: id }) as ImmobilieBild[];

  return { ...row, bilder };
}

export function createImmobilie(data: ImmobilieCreateDTO): Immobilie {
  const db = getDb();
  const fields = Object.keys(data) as (keyof ImmobilieCreateDTO)[];
  const cols = fields.join(", ");
  const placeholders = fields.map((f) => `$${f}`).join(", ");
  const params: Record<string, unknown> = {};
  for (const f of fields) {
    params[`$${f}`] = data[f] ?? null;
  }

  const result = db
    .query(`INSERT INTO immobilien (${cols}) VALUES (${placeholders}) RETURNING *`)
    .get(params) as Immobilie;

  return result;
}

export function updateImmobilie(id: number, data: ImmobilieUpdateDTO): Immobilie | null {
  const db = getDb();
  const fields = Object.keys(data) as (keyof ImmobilieUpdateDTO)[];
  if (fields.length === 0) return getImmobilie(id);

  const sets = fields.map((f) => `${f} = $${f}`).join(", ");
  const params: Record<string, unknown> = { $id: id };
  for (const f of fields) {
    params[`$${f}`] = data[f] ?? null;
  }

  const result = db
    .query(
      `UPDATE immobilien SET ${sets}, aktualisiert_am = datetime('now') WHERE id = $id RETURNING *`
    )
    .get(params) as Immobilie | null;

  return result;
}

export function deleteImmobilie(id: number): boolean {
  const db = getDb();
  const result = db.query("DELETE FROM immobilien WHERE id = $id RETURNING id").get({ $id: id });
  return result != null;
}

export function getStats(): DashboardStats {
  const db = getDb();

  const totals = db
    .query(
      `SELECT
        COUNT(*) as gesamt,
        SUM(CASE WHEN status='verfuegbar' THEN 1 ELSE 0 END) as verfuegbar,
        SUM(CASE WHEN status='reserviert' THEN 1 ELSE 0 END) as reserviert,
        SUM(CASE WHEN status='verkauft' THEN 1 ELSE 0 END) as verkauft,
        AVG(preis) as durchschnittspreis
      FROM immobilien`
    )
    .get() as {
    gesamt: number;
    verfuegbar: number;
    reserviert: number;
    verkauft: number;
    durchschnittspreis: number | null;
  };

  const typRows = db
    .query("SELECT typ, COUNT(*) as count FROM immobilien GROUP BY typ")
    .all() as { typ: string; count: number }[];

  const nach_typ: Record<string, number> = {};
  for (const row of typRows) {
    nach_typ[row.typ] = row.count;
  }

  return { ...totals, nach_typ };
}

export function getRecentImmobilien(limit = 5): Immobilie[] {
  const db = getDb();
  return db
    .query("SELECT * FROM immobilien ORDER BY erstellt_am DESC LIMIT $limit")
    .all({ $limit: limit }) as Immobilie[];
}
