import { useContext, type ReactNode } from "react";
import { Navigate, useLocation } from "react-router";
import { Chargement, Erreur } from "@/components/etats/Etats";
import type { Action, ModuleId } from "../domain/permissions";
import { RepliOngletContexte } from "../hooks/RepliOnglet";
import { usePermission, useSession } from "../hooks/useSession";

/** Exige une session ouverte ; sinon renvoie à la connexion. */
export function RouteConnectee({ children }: { children: ReactNode }) {
  const { etat } = useSession();
  if (etat.statut === "chargement") return <Chargement libelle="Ouverture de la session…" />;
  if (etat.statut === "erreur") return <Erreur erreur={etat.erreur} reessayer={etat.reessayer} />;
  if (etat.statut === "anonyme") return <Navigate to="/connexion" replace />;
  return <>{children}</>;
}

/**
 * Exige le droit sur le module. Un accès direct par l'URL est refusé
 * proprement ; une page devenue interdite par un changement de rôle ou de
 * société bascule sur le premier onglet autorisé (AUTH-16).
 */
export function RouteModule({ module, action = "voir", children }: { module: ModuleId; action?: Action; children: ReactNode }) {
  const autorise = usePermission(module, action);
  const repli = useContext(RepliOngletContexte);
  const { pathname } = useLocation();
  if (!autorise) {
    if (repli?.apresChangement && repli.chemin && repli.chemin !== pathname) return <Navigate to={repli.chemin} replace />;
    return (
      <div className="p-6">
        <h1 className="text-lg font-semibold">Accès refusé</h1>
        <p className="text-sm text-muted-foreground">Votre rôle ne donne pas accès à cette page.</p>
      </div>
    );
  }
  return <>{children}</>;
}
