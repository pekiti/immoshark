import type { ImmobilienFilter } from "@immoshark/shared";
import { Input } from "../ui/Input";
import { Select } from "../ui/Select";
import { Button } from "../ui/Button";

interface FilterBarProps {
  filter: ImmobilienFilter;
  onChange: (filter: ImmobilienFilter) => void;
}

export function FilterBar({ filter, onChange }: FilterBarProps) {
  const update = (partial: Partial<ImmobilienFilter>) =>
    onChange({ ...filter, ...partial, seite: 1 });

  const isGrouped = filter.gruppe === "kontakt";

  return (
    <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Input
          placeholder="Suche (alle Felder)..."
          value={filter.suche || ""}
          onChange={(e) => update({ suche: e.target.value })}
        />
        <Select
          placeholder="Alle Typen"
          value={filter.typ || ""}
          onChange={(e) => update({ typ: (e.target.value || undefined) as any })}
          options={[
            { value: "wohnung", label: "Wohnung" },
            { value: "haus", label: "Haus" },
            { value: "grundstueck", label: "Grundstück" },
            { value: "gewerbe", label: "Gewerbe" },
          ]}
        />
        <Select
          placeholder="Alle Status"
          value={filter.status || ""}
          onChange={(e) => update({ status: (e.target.value || undefined) as any })}
          options={[
            { value: "verfuegbar", label: "Verfügbar" },
            { value: "reserviert", label: "Reserviert" },
            { value: "verkauft", label: "Verkauft" },
          ]}
        />
        <Input
          placeholder="Ort..."
          value={filter.ort || ""}
          onChange={(e) => update({ ort: e.target.value || undefined })}
        />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Input
          placeholder="Preis min"
          type="number"
          value={filter.preis_min ?? ""}
          onChange={(e) => update({ preis_min: e.target.value ? Number(e.target.value) : undefined })}
        />
        <Input
          placeholder="Preis max"
          type="number"
          value={filter.preis_max ?? ""}
          onChange={(e) => update({ preis_max: e.target.value ? Number(e.target.value) : undefined })}
        />
        <Input
          placeholder="Fläche min"
          type="number"
          value={filter.flaeche_min ?? ""}
          onChange={(e) => update({ flaeche_min: e.target.value ? Number(e.target.value) : undefined })}
        />
        <Input
          placeholder="Fläche max"
          type="number"
          value={filter.flaeche_max ?? ""}
          onChange={(e) => update({ flaeche_max: e.target.value ? Number(e.target.value) : undefined })}
        />
        <Input
          placeholder="Zimmer min"
          type="number"
          step="0.5"
          value={filter.zimmer_min ?? ""}
          onChange={(e) => update({ zimmer_min: e.target.value ? Number(e.target.value) : undefined })}
        />
        <Input
          placeholder="Zimmer max"
          type="number"
          step="0.5"
          value={filter.zimmer_max ?? ""}
          onChange={(e) => update({ zimmer_max: e.target.value ? Number(e.target.value) : undefined })}
        />
      </div>
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => update({ gruppe: isGrouped ? undefined : "kontakt" })}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
            isGrouped
              ? "bg-shark text-white"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0" />
          </svg>
          Nach Kontakt gruppieren
        </button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onChange({ seite: 1, limit: 20 })}
        >
          Filter zurücksetzen
        </Button>
      </div>
    </div>
  );
}
