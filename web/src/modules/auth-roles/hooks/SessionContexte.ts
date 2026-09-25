import { createContext } from "react";
import type { Session, SocieteAccessible } from "../domain/types";
import type { RoleMembre } from "../domain/permissions";
import type { MotifDeconnexion } from "../domain/expiration";

export type EtatSession =
  | { statut: "chargement" }
  /** `motif` : la session a été fermée sans que l'utilisateur le demande (AUTH-10). */
  | { statut: "anonyme"; motif?: MotifDeconnexion }
  | { statut: "erreur"; erreur: unknown; reessayer: () => void }
  | { statut: "connecte"; session: Session };

export interface ValeurSession {
  etat: EtatSession;
  societeActive: SocieteAccessible | null;
  choisirSociete: (id: string) => void;
  roleReel: RoleMembre | null;
  roleSimule: RoleMembre | null;
  simulerRole: (role: RoleMembre | null) => void;
  roleEffectif: RoleMembre | null;
  deconnecter: () => Promise<void>;
}

export const SessionContexte = createContext<ValeurSession | null>(null);
