import { Navigate, Outlet } from "react-router";
import { Button } from "@/components/ui/button";
import { useSession } from "@/modules/auth-roles/hooks/useSession";
import { useAccesClients } from "../hooks/useEspaceClient";

/** L'espace client : aucune navigation de gestion, un bandeau « lecture seule ». */
export function LayoutEspaceClient() {
  const { deconnecter } = useSession();
  const acces = useAccesClients();
  if (acces.length === 0) return <Navigate to="/" replace />;
  return (
    <div className="flex min-h-full flex-col">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-card px-4 py-3 print:hidden">
        <div>
          <p className="font-semibold">Espace client — {[...new Set(acces.map((a) => a.societeNom))].join(", ")}</p>
          <p className="text-xs text-muted-foreground">{acces.map((a) => a.clientNom).join(", ")} · consultation seule</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void deconnecter()}>Se déconnecter</Button>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 p-4 print:p-0">
        <Outlet />
      </main>
    </div>
  );
}
