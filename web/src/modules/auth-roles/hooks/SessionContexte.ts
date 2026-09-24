import { createContext } from "react";
import type { Session, SocieteAccessible } from "../api/session";
import type { RoleMembre } from "../domain/permissions";

export type EtatSession =
  | { statut: "chargement" }
  | { statut: "anonyme" }
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
