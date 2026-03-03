import { Link } from "react-router-dom";
import type { Immobilie } from "@immoshark/shared";
import { formatPreis, formatFlaeche, typLabel } from "../../lib/utils";
import { StatusBadge } from "./StatusBadge";

interface ImmobilienTableProps {
  data: Immobilie[];
}

export function ImmobilienTable({ data }: ImmobilienTableProps) {
  if (data.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-12 text-center text-gray-500">
        Keine Immobilien gefunden.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
              <th className="px-4 py-3">Objekt</th>
              <th className="px-4 py-3">Typ</th>
              <th className="px-4 py-3">Ort</th>
              <th className="px-4 py-3 text-right">Preis</th>
              <th className="px-4 py-3 text-right">Fläche</th>
              <th className="px-4 py-3 text-right">Zimmer</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {data.map((immo) => (
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
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
