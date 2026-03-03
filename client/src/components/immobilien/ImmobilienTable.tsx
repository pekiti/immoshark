import { Link } from "react-router-dom";
import type { Immobilie, SortColumn, SortOrder } from "@immoshark/shared";
import { formatPreis, formatFlaeche, typLabel } from "../../lib/utils";
import { StatusBadge } from "./StatusBadge";

interface SortState {
  sort_by?: SortColumn;
  sort_order?: SortOrder;
}

interface ImmobilienTableProps {
  data: Immobilie[];
  sort: SortState;
  onSort: (column: SortColumn) => void;
  grouped?: boolean;
}

function SortIcon({ column, sort }: { column: SortColumn; sort: SortState }) {
  if (sort.sort_by !== column) {
    return <span className="ml-1 text-gray-300">&#8597;</span>;
  }
  return (
    <span className="ml-1 text-shark">
      {sort.sort_order === "desc" ? "&#9660;" : "&#9650;"}
    </span>
  );
}

interface Column {
  key: SortColumn;
  label: string;
  align?: "right";
}

const columns: Column[] = [
  { key: "strasse", label: "Objekt" },
  { key: "typ", label: "Typ" },
  { key: "ort", label: "Ort" },
  { key: "preis", label: "Preis", align: "right" },
  { key: "wohnflaeche", label: "Fläche", align: "right" },
  { key: "zimmeranzahl", label: "Zimmer", align: "right" },
  { key: "status", label: "Status" },
];

function renderRow(immo: Immobilie) {
  return (
    <tr key={immo.id} className="transition-colors hover:bg-gray-50">
      <td className="px-4 py-3">
        <Link
          to={`/immobilien/${immo.id}`}
          className="font-medium text-shark hover:text-shark-light hover:underline"
        >
          {immo.strasse} {immo.hausnummer}
        </Link>
        {immo.expose_nummer && (
          <p className="text-xs text-gray-400">{immo.expose_nummer}</p>
        )}
      </td>
      <td className="px-4 py-3 text-gray-600">{typLabel(immo.typ)}</td>
      <td className="px-4 py-3 text-gray-600">
        {immo.plz} {immo.ort}
      </td>
      <td className="px-4 py-3 text-right font-medium">{formatPreis(immo.preis)}</td>
      <td className="px-4 py-3 text-right text-gray-600">{formatFlaeche(immo.wohnflaeche)}</td>
      <td className="px-4 py-3 text-right text-gray-600">
        {immo.zimmeranzahl != null ? immo.zimmeranzahl : "—"}
      </td>
      <td className="px-4 py-3">
        <StatusBadge status={immo.status} />
      </td>
    </tr>
  );
}

export function ImmobilienTable({ data, sort, onSort, grouped }: ImmobilienTableProps) {
  if (data.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-12 text-center text-gray-500">
        Keine Immobilien gefunden.
      </div>
    );
  }

  // Group rows by kontakt_name when grouped mode is active
  const groups: { name: string; items: Immobilie[] }[] = [];
  if (grouped) {
    const map = new Map<string, Immobilie[]>();
    for (const immo of data) {
      const key = immo.kontakt_name || "Kein Kontakt";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(immo);
    }
    for (const [name, items] of map) {
      groups.push({ name, items });
    }
  }

  const headerRow = (
    <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
      {columns.map((col) => (
        <th
          key={col.key}
          className={`cursor-pointer select-none px-4 py-3 transition-colors hover:bg-gray-100 ${
            col.align === "right" ? "text-right" : ""
          }`}
          onClick={() => onSort(col.key)}
        >
          {col.label}
          <SortIcon column={col.key} sort={sort} />
        </th>
      ))}
    </tr>
  );

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>{headerRow}</thead>
          <tbody className="divide-y divide-gray-100">
            {grouped
              ? groups.map((group) => (
                  <Fragment key={group.name}>
                    <tr>
                      <td
                        colSpan={columns.length}
                        className="bg-shark/5 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-shark"
                      >
                        {group.name}
                        <span className="ml-2 text-gray-400 font-normal normal-case">
                          ({group.items.length} {group.items.length === 1 ? "Objekt" : "Objekte"})
                        </span>
                      </td>
                    </tr>
                    {group.items.map(renderRow)}
                  </Fragment>
                ))
              : data.map(renderRow)}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Need Fragment for grouping
import { Fragment } from "react";
