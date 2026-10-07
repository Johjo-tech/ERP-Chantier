import { useContext } from "react";
import { peut, voitLesPrix, type Action, type ModuleId } from "../domain/permissions";
import { SessionContexte, type ValeurSession } from "./SessionContexte";

export function useSession(): ValeurSession {
  const v = useContext(SessionContexte);
  if (!v) throw new Error("useSession() hors de <SessionProvider>.");
  return v;
}

/** La société active, garantie présente : à n'employer que sous une route protégée. */
export function useSocieteActive() {
  const { societeActive } = useSession();
  if (!societeActive) throw new Error("Aucune société active : route non protégée ?");
  return societeActive;
}

/**
 * Le point central des droits d'AFFICHAGE : le rôle effectif (simulé ou réel)
 * confronté à la matrice lue en base. La RLS reste la vraie barrière.
 */
export function usePermission(module: ModuleId, action: Action = "voir"): boolean {
  const { etat, roleEffectif } = useSession();
  if (etat.statut !== "connecte") return false;
  return peut(etat.session.matrice, roleEffectif, module, action);
}

export function useVoitLesPrix(): boolean {
  return voitLesPrix(useSession().roleEffectif);
}
