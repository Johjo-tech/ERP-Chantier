import { useContext, type ReactNode } from "react";
import { Navigate, useLocation } from "react-router";
import { Chargement, Erreur } from "@/components/etats/Etats";
import { fonctionnaliteOuverte, type Fonctionnalite } from "@/modules/societes/domain/abonnement";
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
 * Le niveau d'abonnement que le menu exige pour chaque module (`app/navigation.ts`) :
 * une URL tapée ne doit pas ouvrir ce que le menu masque (relecture 4, M4).
 * Un module absent d'ici n'est porté par aucun niveau (planning, RH, parc…).
 */
const FONCTIONNALITE_DU_MODULE: Partial<Record<ModuleId, Fonctionnalite>> = {
  clients: "clients",
  chantiers: "chantiers",
  devis: "devis",
  articles: "articles",
  factures: "factures",
  bons_commande: "commandes",
};

/**
 * Exige le droit sur le module, et l'abonnement qui l'ouvre. Un accès direct par l'URL est refusé
 * proprement ; une page devenue interdite par un changement de rôle ou de
 * société bascule sur le premier onglet autorisé (AUTH-16).
 */
export function RouteModule({ module, action = "voir", children }: { module: ModuleId; action?: Action; children: ReactNode }) {
  const permis = usePermission(module, action);
  const { societeActive } = useSession();
  const repli = useContext(RepliOngletContexte);
  const { pathname } = useLocation();
  const fonctionnalite = FONCTIONNALITE_DU_MODULE[module];
  const souscrit = !fonctionnalite || fonctionnaliteOuverte(fonctionnalite, societeActive?.niveauAbonnement);
  if (!permis || !souscrit) {
    if (repli?.apresChangement && repli.chemin && repli.chemin !== pathname) return <Navigate to={repli.chemin} replace />;
    // L'ancien écran n'avait pas d'accès direct à refuser (pas d'adresse par écran) : l'en-tête et l'état vide des siens.
    return (
      <>
        <div className="page-head">
          <h1>Accès refusé</h1>
        </div>
        <div className="empty">{permis ? "L'abonnement de la société n'inclut pas ce module." : "Votre rôle ne donne pas accès à cette page."}</div>
      </>
    );
  }
  return <>{children}</>;
}
