import type { RoleMembre } from "@/modules/auth-roles/domain/permissions";
import { dossierSalarie, joursEntre, TYPE_HABILITATION, type DocumentRh, type DossierSalarie } from "./documents";
import { etatVisite, type EtatVisite } from "./visites";

/**
 * La conformité RH d'un salarié : son dossier ET son suivi médical (RH-09),
 * et les alertes de la liste (RH-10). Les deux règles feuilles ne se
 * connaissent pas : elles se composent ici.
 */

/** Les seuils de Réglages › RH qui servent ici, en jours avant échéance. */
export interface SeuilsRh {
  documentLegal: number;
  visiteMedicale: number;
  carteBtp: number;
  habilitation: number;
}

export interface ConformiteRh extends DossierSalarie {
  visite: { etat: EtatVisite; jours: number | null };
  /** « Pas d'échéance connue » vaut manquement : c'est ce que l'inspection viendra demander. */
  manqueMedical: boolean;
}

/**
 * L'échéance qui fait foi est la COLONNE `visite_medicale_prochaine`, tenue par
 * la base d'après la dernière visite — et qui garde, faute de registre,
 * l'échéance saisie à la main avant qu'il existe.
 */
export function conformiteRh(documents: readonly DocumentRh[], prochaineVisite: string | null, aujourdHui: string, seuils: Pick<SeuilsRh, "documentLegal" | "visiteMedicale">): ConformiteRh {
  const dossier = dossierSalarie(documents, aujourdHui, seuils.documentLegal);
  const visite = etatVisite(prochaineVisite, aujourdHui, seuils.visiteMedicale);
  const manqueMedical = visite.etat === "inconnue" || visite.etat === "depassee";
  return { ...dossier, visite, manqueMedical, complet: dossier.complet && !manqueMedical };
}

/** Ce qui manque, dit en toutes lettres (infobulle du badge « dossier incomplet »). */
export function motifIncomplet(c: ConformiteRh): string {
  const manques = [...c.manquants.map((t) => t.libelle), c.manqueMedical ? "Suivi médical" : ""].filter(Boolean);
  return manques.join(", ") || "Document expiré";
}

/** Le décompte de la colonne « Dossier » : les manques d'abord, sinon les expirés. */
export function resumeDossier(c: ConformiteRh): string | null {
  if (c.complet) return null;
  const manques = c.manquants.length + (c.manqueMedical ? 1 : 0);
  if (manques) return `${manques} manquant${manques > 1 ? "s" : ""}`;
  return `${c.expires.length} expiré${c.expires.length > 1 ? "s" : ""}`;
}

export type NiveauEcheance = "expire" | "bientot" | null;

/** Échéance d'une date au regard d'un seuil : expirée, proche, ou rien à dire. */
export function niveauEcheance(date: string | null | undefined, aujourdHui: string, seuil: number): NiveauEcheance {
  const j = joursEntre(aujourdHui, date);
  if (j === null) return null;
  if (j < 0) return "expire";
  return j <= seuil ? "bientot" : null;
}

/**
 * Le « ⚠ à vérifier » de la liste : carte BTP et habilitations proches ou
 * expirées. L'ancienne liste codait 30 jours en dur, alors que les seuils
 * `carteBtp` et `habilitation` sont réglables : ce sont eux qui s'appliquent
 * ici (D-RH-04), comme dans les alertes.
 */
export function aVerifier(carteBtpValidite: string | null, documents: readonly DocumentRh[], aujourdHui: string, seuils: Pick<SeuilsRh, "carteBtp" | "habilitation">): string[] {
  const motifs: string[] = [];
  if (niveauEcheance(carteBtpValidite, aujourdHui, seuils.carteBtp)) motifs.push("Carte BTP");
  const habilitations = documents.filter((d) => d.type === TYPE_HABILITATION && niveauEcheance(d.dateExpiration, aujourdHui, seuils.habilitation));
  if (habilitations.length) motifs.push(`${habilitations.length} habilitation(s)`);
  return motifs;
}

export type FiltreDossiers = "" | "incomplets" | "expires" | "bientot";

export function filtrerDossiers<T extends { bilan: ConformiteRh }>(lignes: readonly T[], filtre: FiltreDossiers): T[] {
  if (filtre === "incomplets") return lignes.filter((l) => !l.bilan.complet);
  if (filtre === "expires") return lignes.filter((l) => l.bilan.expires.length > 0);
  if (filtre === "bientot") return lignes.filter((l) => l.bilan.bientot.length > 0);
  return [...lignes];
}

/**
 * Ce que l'écran RH montre à chacun — miroir d'affichage de la matrice et de
 * `peut_ecrire()` ; la RLS tranche.
 *  - `sensible` : fiche complète, dossiers, visites, congés, registre, coûts —
 *    ce que `rh/modifier` ouvre (les politiques de `salaries` et de ses tables
 *    filles l'exigent, la vue d'annuaire masque le reste).
 *  - `intervenants` : créer ou modifier équipes et sous-traitants. La matrice
 *    les range sous `rh` (onglet historique), la base exige `peut_ecrire()` :
 *    l'écran demande les deux, soit l'administrateur (D-RH-05).
 */
export function droitsRh(peut: (action: "voir" | "creer" | "modifier" | "supprimer") => boolean, role: RoleMembre | null) {
  const ecritLeTerrain = role === "admin" || role === "conducteur" || role === "technicien";
  return {
    voir: peut("voir"),
    sensible: peut("modifier"),
    creer: peut("creer"),
    modifier: peut("modifier"),
    supprimer: peut("supprimer"),
    intervenants: peut("modifier") && ecritLeTerrain,
    /** La fiche conducteur (`conducteurs`) s'écrit sous `peut_ecrire()`. */
    conducteur: peut("modifier") && ecritLeTerrain,
  };
}
export type DroitsRh = ReturnType<typeof droitsRh>;
