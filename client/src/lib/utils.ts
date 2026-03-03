export function formatPreis(preis: number | null): string {
  if (preis == null) return "Auf Anfrage";
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(preis);
}

export function formatFlaeche(flaeche: number | null): string {
  if (flaeche == null) return "—";
  return `${flaeche} m²`;
}

export function typLabel(typ: string): string {
  const labels: Record<string, string> = {
    wohnung: "Wohnung",
    haus: "Haus",
    grundstueck: "Grundstück",
    gewerbe: "Gewerbe",
  };
  return labels[typ] || typ;
}

export function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    verfuegbar: "Verfügbar",
    reserviert: "Reserviert",
    verkauft: "Verkauft",
  };
  return labels[status] || status;
}

export function statusColor(status: string): string {
  const colors: Record<string, string> = {
    verfuegbar: "bg-green-100 text-green-800",
    reserviert: "bg-yellow-100 text-yellow-800",
    verkauft: "bg-red-100 text-red-800",
  };
  return colors[status] || "bg-gray-100 text-gray-800";
}
