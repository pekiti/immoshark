import { Button } from "./Button";

interface PaginationProps {
  seite: number;
  limit: number;
  gesamt: number;
  onPageChange: (seite: number) => void;
}

export function Pagination({ seite, limit, gesamt, onPageChange }: PaginationProps) {
  const totalPages = Math.ceil(gesamt / limit);
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between border-t border-gray-200 pt-4">
      <p className="text-sm text-gray-600">
        {(seite - 1) * limit + 1}–{Math.min(seite * limit, gesamt)} von {gesamt}
      </p>
      <div className="flex gap-2">
        <Button
          variant="secondary"
          size="sm"
          disabled={seite <= 1}
          onClick={() => onPageChange(seite - 1)}
        >
          Zurück
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={seite >= totalPages}
          onClick={() => onPageChange(seite + 1)}
        >
          Weiter
        </Button>
      </div>
    </div>
  );
}
