import { ROLES_LIBELLES } from "../domain/permissions";
import { useSession } from "../hooks/useSession";

/**
 * Tant qu'un admin simule un rôle, l'écran le dit en permanence : les données
 * restent celles que la base accorde à l'ADMIN (la RLS juge le rôle réel).
 * L'ancien écran n'avait pas ce bandeau (D-010) ; il prend donc l'habit de son
 * bandeau d'alerte (`.bandeau-alerte`), le seul qu'il connaissait.
 */
export function BandeauSimulation() {
  const { roleSimule, simulerRole } = useSession();
  if (!roleSimule) return null;
  return (
    <div role="status" className="bandeau-alerte bandeau-simulation">
      <span>
        👁 Aperçu en tant que <b>{ROLES_LIBELLES[roleSimule]}</b> — affichage seulement, la base applique toujours vos droits d'administrateur.
      </span>
      <button type="button" className="btn small" onClick={() => simulerRole(null)}>
        Revenir à mon rôle
      </button>
    </div>
  );
}
