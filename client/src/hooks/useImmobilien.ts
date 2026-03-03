import { useState, useEffect, useCallback } from "react";
import type { Immobilie, ImmobilienFilter } from "@immoshark/shared";
import { api } from "../api/client";

export function useImmobilien(initialFilter: ImmobilienFilter = {}) {
  const [data, setData] = useState<Immobilie[]>([]);
  const [meta, setMeta] = useState({ seite: 1, limit: 20, gesamt: 0 });
  const [filter, setFilter] = useState<ImmobilienFilter>(initialFilter);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.list(filter);
      setData(result.data);
      setMeta(result.meta);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Fehler beim Laden");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  return { data, meta, filter, setFilter, loading, error, reload: load };
}

export function useImmobilie(id: number | null) {
  const [data, setData] = useState<Immobilie | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (id == null) return;
    setLoading(true);
    setError(null);
    api
      .get(id)
      .then((res) => setData(res.data))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Fehler"))
      .finally(() => setLoading(false));
  }, [id]);

  return { data, loading, error };
}
