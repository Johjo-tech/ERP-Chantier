import type { ReactNode } from "react";
import { Navigate } from "react-router";
import { useSocieteActive } from "@/modules/auth-roles/hooks/useSession";

/**
 * Une fiche d'une AUTRE société (URL gardée après un changement de société,
 * lien fabriqué) renvoie à la liste plutôt que de s'afficher sous les droits
 * de la société active.
 */
export function GardeSociete({ societeId, retour, children }: { societeId: string; retour: string; children: ReactNode }) {
  const active = useSocieteActive();
  if (societeId !== active.id) return <Navigate to={retour} replace />;
  return <>{children}</>;
}
