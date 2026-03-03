import { Link } from "react-router-dom";
import { Button } from "../components/ui/Button";

export function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <span className="text-6xl">🦈</span>
      <h1 className="mt-4 text-3xl font-bold text-gray-900">404</h1>
      <p className="mt-2 text-gray-500">Diese Seite wurde nicht gefunden.</p>
      <Link to="/" className="mt-6">
        <Button>Zurück zum Dashboard</Button>
      </Link>
    </div>
  );
}
