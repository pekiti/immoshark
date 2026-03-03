import { Link, useSearchParams } from "react-router-dom";
import type { ImmobilienFilter, SortColumn } from "@immoshark/shared";
import { useImmobilien } from "../hooks/useImmobilien";
import { FilterBar } from "../components/immobilien/FilterBar";
import { ImmobilienTable } from "../components/immobilien/ImmobilienTable";
import { Pagination } from "../components/ui/Pagination";
import { Button } from "../components/ui/Button";
import { useEffect } from "react";

function parseSearchParams(params: URLSearchParams): ImmobilienFilter {
  const filter: ImmobilienFilter = {};
  for (const [key, value] of params) {
    if (value) (filter as any)[key] = value;
  }
  if (filter.seite) filter.seite = Number(filter.seite);
  if (filter.limit) filter.limit = Number(filter.limit);
  if (filter.preis_min) filter.preis_min = Number(filter.preis_min);
  if (filter.preis_max) filter.preis_max = Number(filter.preis_max);
  if (filter.flaeche_min) filter.flaeche_min = Number(filter.flaeche_min);
  if (filter.flaeche_max) filter.flaeche_max = Number(filter.flaeche_max);
  if (filter.zimmer_min) filter.zimmer_min = Number(filter.zimmer_min);
  if (filter.zimmer_max) filter.zimmer_max = Number(filter.zimmer_max);
  return filter;
}

export function ImmobilienListe() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialFilter = parseSearchParams(searchParams);
  const { data, meta, filter, setFilter, loading, error } = useImmobilien(initialFilter);

  // Sync filter to URL
  useEffect(() => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(filter)) {
      if (value != null && value !== "" && key !== "limit") {
        params.set(key, String(value));
      }
    }
    setSearchParams(params, { replace: true });
  }, [filter, setSearchParams]);

  function handleSort(column: SortColumn) {
    if (filter.sort_by === column) {
      // Toggle direction, or clear if already descending
      if (filter.sort_order === "desc") {
        setFilter({ ...filter, sort_by: undefined, sort_order: undefined, seite: 1 });
      } else {
        setFilter({ ...filter, sort_order: "desc", seite: 1 });
      }
    } else {
      setFilter({ ...filter, sort_by: column, sort_order: "asc", seite: 1 });
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Immobilien</h1>
        <Link to="/immobilien/neu">
          <Button>Neu anlegen</Button>
        </Link>
      </div>

      <FilterBar filter={filter} onChange={setFilter} />

      {error && (
        <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</div>
      )}

      {loading ? (
        <div className="py-12 text-center text-gray-500">Laden...</div>
      ) : (
        <>
          <ImmobilienTable
            data={data}
            sort={{ sort_by: filter.sort_by, sort_order: filter.sort_order }}
            onSort={handleSort}
            grouped={filter.gruppe === "kontakt"}
          />
          <Pagination
            seite={meta.seite}
            limit={meta.limit}
            gesamt={meta.gesamt}
            onPageChange={(seite) => setFilter({ ...filter, seite })}
          />
        </>
      )}
    </div>
  );
}
