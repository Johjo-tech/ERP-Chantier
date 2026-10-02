/**
 * Ce que l'écran propose sur une facture — et la phrase qui explique le reste.
 * Port de `src/api/regles-actions-facture.ts` (parité :
 * tests/parite/actions-facture.essai.ts).
 *
 * La barre d'actions « ne montre que le possible » : un geste refusé ne
 * s'affiche pas, et le refus qu'opposerait le geste sort de la MÊME expression
 * que le bouton masqué. Les droits arrivent résolus (la matrice est en base).
 */
import type { Action, ModuleId, RoleMembre } from "@/modules/auth-roles/domain/permissions";
import { actionsFacturation } from "@/modules/auth-roles/domain/actions";
import { estAvoir } from "@/modules/documents/domain/totaux";
import { verrouFacture } from "./verrou";

export type GesteFacture = "modifier" | "imprimer" | "envoyer" | "emettre" | "transmettre" | "avoir" | "imputerAvoir" | "dupliquer" | "supprimer";

export interface DroitsFacture {
  modifier: boolean;
  creer: boolean;
  supprimer: boolean;
  /** Émettre : la règle du circuit de facturation, hors matrice (`actionsFacturation`). */
  emettre: boolean;
  /** `reglements/creer` — imputer un avoir écrit deux règlements. */
  imputerAvoir: boolean;
}

export interface ActionsFacture {
  peutModifier: boolean;
  peutImprimer: boolean;
  peutEnvoyer: boolean;
  peutEmettre: boolean;
  peutTransmettre: boolean;
  peutEtablirAvoir: boolean;
  peutImputerAvoir: boolean;
  peutDupliquer: boolean;
  peutSupprimer: boolean;
}

export interface FactureAgissable {
  numero: string | null;
  type_document: string;
  verrouillee: boolean;
}

const SANS_NUMERO = "Cette facture n'est pas émise : sans numéro elle ne sort pas — ni impression, ni envoi, ni dépôt sur la plateforme. Émettez-la d'abord.";
const ROLE_SANS_ECRITURE = "Votre rôle ne permet pas d'écrire sur une facture : ce geste revient à l'administrateur ou à la secrétaire.";
const ROLE_SANS_EMISSION = "L'émission d'une facture revient à l'administrateur ou à la secrétaire.";

/** Mot pour mot `refusAvoirSurPiece` (regles-avoir) : la règle qu'appliquera l'établissement. */
function refusAvoirSurPiece(f: FactureAgissable): string | null {
  if (!String(f.numero ?? "").trim()) return "Cette facture n'est pas émise : modifiez-la directement, un avoir n'aurait rien à corriger.";
  if (estAvoir(f.type_document)) return "Un avoir ne s'annule pas par un autre avoir : il faut refacturer.";
  return null;
}

/** Les droits du rôle, lus une fois pour toute la liste (`droitsFacture`, integrations/session.ts). */
export function droitsFacture(peut: (module: ModuleId, action: Action) => boolean, role: RoleMembre | null): DroitsFacture {
  return {
    modifier: peut("factures", "modifier"),
    creer: peut("factures", "creer"),
    supprimer: peut("factures", "supprimer"),
    emettre: actionsFacturation(role).peutFacturer,
    imputerAvoir: peut("reglements", "creer"),
  };
}

/** Pourquoi ce geste est refusé sur cette pièce — `null` quand il ne l'est pas. */
export function refusGesteFacture(geste: GesteFacture, facture: FactureAgissable | null | undefined, droits: DroitsFacture): string | null {
  if (!facture) return "Facture introuvable.";
  const numero = String(facture.numero ?? "").trim();
  const unAvoir = estAvoir(facture.type_document);
  switch (geste) {
    case "modifier": {
      const verrou = verrouFacture(facture);
      if (verrou) return verrou.libelle;
      return droits.modifier ? null : ROLE_SANS_ECRITURE;
    }
    case "imprimer":
    case "envoyer":
      return numero ? null : SANS_NUMERO;
    case "transmettre":
      if (!numero) return SANS_NUMERO;
      return droits.modifier ? null : ROLE_SANS_ECRITURE;
    case "emettre":
      if (numero) return `Déjà émise sous le numéro ${numero}.`;
      if (unAvoir) return "Un avoir naît de la facture qu'il rectifie : il ne s'émet pas à la main.";
      return droits.emettre && droits.modifier ? null : ROLE_SANS_EMISSION;
    case "avoir": {
      const refus = refusAvoirSurPiece(facture);
      if (refus) return refus;
      return droits.creer ? null : ROLE_SANS_ECRITURE;
    }
    case "imputerAvoir":
      if (unAvoir) return "Un avoir s'impute sur une facture : il ne se règle pas.";
      if (!numero) return SANS_NUMERO;
      return droits.imputerAvoir ? null : "Votre rôle ne permet pas d'enregistrer un règlement.";
    case "dupliquer":
      if (unAvoir) return "Un avoir rectifie une facture précise : il ne se duplique pas.";
      return droits.creer ? null : ROLE_SANS_ECRITURE;
    case "supprimer":
      if (numero) return `La facture ${numero} est numérotée : elle ne peut plus être supprimée. Une correction passe par un avoir.`;
      return droits.supprimer ? null : "Votre rôle ne permet pas de supprimer une facture.";
  }
}

export function actionsFacture(facture: FactureAgissable, droits: DroitsFacture): ActionsFacture {
  const ouvert = (g: GesteFacture) => refusGesteFacture(g, facture, droits) === null;
  return {
    peutModifier: ouvert("modifier"),
    peutImprimer: ouvert("imprimer"),
    peutEnvoyer: ouvert("envoyer"),
    peutEmettre: ouvert("emettre"),
    peutTransmettre: ouvert("transmettre"),
    peutEtablirAvoir: ouvert("avoir"),
    peutImputerAvoir: ouvert("imputerAvoir"),
    peutDupliquer: ouvert("dupliquer"),
    peutSupprimer: ouvert("supprimer"),
  };
}

/** Une fois en tête de liste, et non sous chaque carte : le rôle ne change pas d'une pièce à l'autre. */
export function motifRoleFacture(droits: DroitsFacture): string | null {
  if (droits.modifier || droits.creer || droits.supprimer || droits.emettre) return null;
  return "Votre rôle donne un accès en consultation : établir, émettre, corriger ou supprimer une facture reviennent à l'administrateur ou à la secrétaire.";
}
