import { getDb } from "../db/database.js";
import type {
  Immobilie,
  ImmobilieCreateDTO,
  ImmobilieUpdateDTO,
  ImmobilienFilter,
  ImmobilieBild,
  DashboardStats,
  SortColumn,
} from "@immoshark/shared";

// Whitelist of sortable columns (prevents SQL injection)
const SORTABLE_COLUMNS = new Set<SortColumn>([
  "strasse", "typ", "ort", "preis", "wohnflaeche", "zimmeranzahl",
  "status", "baujahr", "grundstuecksflaeche", "kontakt_name",
  "erstellt_am", "aktualisiert_am",
]);

export function listImmobilien(filter: ImmobilienFilter) {
  const db = getDb();
  const conditions: string[] = [];
  const params: Record<string, unknown> = {};

  // FTS5 full-text search across all indexed fields
  if (filter.suche) {
    const terms = filter.suche.split(/\s+/).filter(Boolean);
    // FTS for text fields + LIKE fallback for numeric fields (preis, baujahr etc.)
    const ftsMatch = terms.map((t) => `"${t}"*`).join(" ");
    const likePattern = `%${filter.suche}%`;
    conditions.push(
      `(i.id IN (SELECT rowid FROM immobilien_fts WHERE immobilien_fts MATCH $suche)` +
      ` OR CAST(i.preis AS TEXT) LIKE $suche_like` +
      ` OR CAST(i.baujahr AS TEXT) LIKE $suche_like` +
      ` OR CAST(i.wohnflaeche AS TEXT) LIKE $suche_like` +
      ` OR CAST(i.zimmeranzahl AS TEXT) LIKE $suche_like` +
      ` OR CAST(i.grundstuecksflaeche AS TEXT) LIKE $suche_like)`
    );
    params.$suche = ftsMatch;
    params.$suche_like = likePattern;
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
  if (filter.erstellt_von) {
    conditions.push("i.erstellt_am >= $erstellt_von");
    params.$erstellt_von = filter.erstellt_von;
  }
  if (filter.erstellt_bis) {
    conditions.push("i.erstellt_am < date($erstellt_bis, '+1 day')");
    params.$erstellt_bis = filter.erstellt_bis;
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const limit = filter.limit ?? 20;
  const offset = ((filter.seite ?? 1) - 1) * limit;

  // Sorting — validated column + direction
  let orderBy: string;
  if (filter.gruppe === "kontakt") {
    // Group by contact: primary sort by kontakt_name, secondary by user's sort or default
    const secondary = filter.sort_by && SORTABLE_COLUMNS.has(filter.sort_by)
      ? `i.${filter.sort_by} ${filter.sort_order === "desc" ? "DESC" : "ASC"}`
      : "i.aktualisiert_am DESC";
    orderBy = `ORDER BY i.kontakt_name ASC NULLS LAST, ${secondary}`;
  } else if (filter.sort_by && SORTABLE_COLUMNS.has(filter.sort_by)) {
    const dir = filter.sort_order === "desc" ? "DESC" : "ASC";
    orderBy = `ORDER BY i.${filter.sort_by} ${dir} NULLS LAST`;
  } else {
    orderBy = "ORDER BY i.aktualisiert_am DESC";
  }

  const countRow = db
    .query(`SELECT COUNT(*) as count FROM immobilien i ${where}`)
    .get(params) as { count: number };

  const rows = db
    .query(
      `SELECT i.* FROM immobilien i ${where} ${orderBy} LIMIT $limit OFFSET $offset`
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
