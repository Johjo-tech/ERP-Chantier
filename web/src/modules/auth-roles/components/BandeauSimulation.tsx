import { Button } from "@/components/ui/button";
import { ROLES_LIBELLES } from "../domain/permissions";
import { useSession } from "../hooks/useSession";

/**
 * Tant qu'un admin simule un rôle, l'écran le dit en permanence : les données
 * restent celles que la base accorde à l'ADMIN (la RLS juge le rôle réel).
 */
export function BandeauSimulation() {
  const { roleSimule, simulerRole } = useSession();
  if (!roleSimule) return null;
  return (
    <div role="status" className="flex items-center justify-between gap-4 bg-warning/30 px-4 py-2 text-sm print:hidden">
      <span>
        Aperçu en tant que <strong>{ROLES_LIBELLES[roleSimule]}</strong> — affichage seulement, la base applique
        toujours vos droits d'administrateur.
      </span>
      <Button size="sm" variant="outline" onClick={() => simulerRole(null)}>
        Revenir à mon rôle
      </Button>
    </div>
  );
}
