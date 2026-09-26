import { Link } from "react-router";

export function PageIntrouvable() {
  return (
    <div className="flex flex-col gap-2">
      <h1 className="text-lg font-semibold">Page introuvable</h1>
      <Link to="/" className="text-sm text-primary underline">
        Retour au tableau de bord
      </Link>
    </div>
  );
}
