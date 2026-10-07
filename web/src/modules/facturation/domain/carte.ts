import { montant, type Montant } from "@/lib/money";
import { joursDepuis } from "./etat";
import type { Solde } from "./solde";

/**
 * Ce que dit une carte de Facturation, dans les mots de l'ancien écran
 * (`renderFacturesListHTML`, `reglementStatutFacture`, `delaiBadgeHTML`,
 * `badgeAvoirHTML`, `locataireCardLine`, `logementBadge` — app.js). Les
 * montants viennent de la base (`v_facture_solde`, D-FAC-01) ; seule la mise
 * en mots se fait ici.
 */

/** Le seuil des comparaisons de l'ancien écran (`reste > 0.01`, `paye > 0.004`). */
const UN_CENTIME = montant("0.01");
const DEMI_CENTIME = montant("0.004");

export type ClasseBadge = "success" | "danger" | "warn" | "info" | "gray" | "yellow";

export interface EtatCarte {
  cle: "non_reglee" | "partiellement_reglee" | "reglee" | "disponible" | "partiellement_impute" | "impute";
  libelle: string;
  classe: ClasseBadge;
  paye: Montant;
  reste: Montant;
  /** Un avoir s'impute, il ne se règle pas : ni retard, ni « dû ». */
  avoir: boolean;
  reprise: boolean;
}

/**
 * L'état tel que l'ancien écran l'affiche. Un BROUILLON y est « Non réglée »
 * (ou « Réglée » à zéro) : l'ancien calcul ne lisait que les règlements, et le
 * brouillon n'en a pas — la base le classe à part, l'écran le montre comme avant.
 */
export function etatCarte(s: Pick<Solde, "cle" | "paye" | "reste" | "sens">, ttc: Montant): EtatCarte {
  const paye = montant(s.paye);
  const reste = montant(s.reste);
  const base = { paye, reste, avoir: false, reprise: false };
  switch (s.cle) {
    case "reprise":
      // Aucun règlement en base pour une pièce reprise « payée » : l'ancien écran la disait réglée de tout son TTC, sans en fabriquer.
      return s.sens < 0
        ? { ...base, paye: ttc.abs(), reste: montant(0), cle: "impute", libelle: "Imputé (reprise)", classe: "success", avoir: true, reprise: true }
        : { ...base, paye: ttc, reste: montant(0), cle: "reglee", libelle: "Réglée (reprise)", classe: "success", reprise: true };
    case "disponible":
      return { ...base, cle: s.cle, libelle: "Disponible", classe: "info", avoir: true };
    case "partiellement_impute":
      return { ...base, cle: s.cle, libelle: "Partiellement imputé", classe: "warn", avoir: true };
    case "impute":
      return { ...base, cle: s.cle, libelle: "Imputé", classe: "success", avoir: true };
    case "brouillon":
    case "non_reglee":
    case "partiellement_reglee":
    case "reglee":
      if (reste.lt(DEMI_CENTIME)) return { ...base, cle: "reglee", libelle: "Réglée", classe: "success" };
      if (paye.lt(DEMI_CENTIME)) return { ...base, cle: "non_reglee", libelle: "Non réglée", classe: "danger" };
      return { ...base, cle: "partiellement_reglee", libelle: "Partiellement réglée", classe: "warn" };
  }
}

/** Jours depuis l'échéance, ou la date à défaut (`joursDepuisEcheance`). */
export function joursDepuisEcheance(f: { echeance: string | null; date: string }, aujourdhui: string): number | null {
  const ref = f.echeance || f.date;
  return ref ? joursDepuis(ref, aujourdhui) : null;
}

export function reglementEnRetard(e: EtatCarte, jours: number | null): boolean {
  return !e.avoir && e.reste.gt(UN_CENTIME) && (jours ?? 0) > 0;
}

/** « En retard de N j », « Échéance aujourd'hui », « Échéance dans N j » (`delaiBadgeHTML`). */
export function delaiBadge(f: { echeance: string | null; date: string }, reste: Montant, aujourdhui: string): { classe: ClasseBadge; texte: string } | null {
  if (!reste.gt(UN_CENTIME)) return null;
  const jours = joursDepuisEcheance(f, aujourdhui);
  if (jours === null) return null;
  if (jours > 0) return { classe: "danger", texte: `En retard de ${jours} j` };
  if (jours === 0) return { classe: "warn", texte: "Échéance aujourd'hui" };
  return { classe: "gray", texte: `Échéance dans ${-jours} j` };
}

/** Le badge d'un avoir : ce qu'il lui reste à donner (`badgeAvoirHTML`). */
export function badgeAvoir(reste: Montant, credit: Montant, formater: (m: Montant) => string): { classe: ClasseBadge; texte: string; titre: string } {
  if (!reste.gt(DEMI_CENTIME)) return { classe: "success", texte: "Imputé", titre: "Cet avoir a été entièrement imputé" };
  if (reste.lt(credit.minus(DEMI_CENTIME))) return { classe: "warn", texte: "Partiellement imputé", titre: `Imputé en partie : ${formater(reste)} restent à imputer` };
  return { classe: "warn", texte: "À imputer", titre: "À imputer sur une facture du même client" };
}

/** Les étiquettes que le filtre « règlement » reconnaît (`contexteFacture`). */
export function etiquettesReglement(e: EtatCarte, jours: number | null): string[] {
  if (e.avoir) return ["avoir", e.cle === "impute" ? "avoir_impute" : "avoir_disponible"];
  const sortie = [e.cle === "reglee" ? "payee" : e.cle === "partiellement_reglee" ? "partiel" : "impayee"];
  if (reglementEnRetard(e, jours)) sortie.push("retard");
  return sortie;
}

export const LIBELLES_MODE_PAIEMENT: Record<string, string> = {
  virement: "virement",
  cheque: "chèque",
  especes: "espèces",
  carte: "carte bancaire",
  prelevement: "prélèvement",
  traite: "traite",
  autre: "tout moyen convenu",
};
export function libelleModePaiement(mode: string | null): string {
  return (mode && LIBELLES_MODE_PAIEMENT[mode]) || "virement";
}

export function avecVille(adresse: string | null, cp: string | null, ville: string | null): string {
  const cpVille = [cp, ville].filter(Boolean).join(" ");
  return [adresse, cpVille].filter(Boolean).join(", ");
}

export interface LieuCarte {
  adresse_locataire: string | null;
  code_postal: string | null;
  ville: string | null;
  occupant: string | null;
  numero_logement: string | null;
  precision_commune: string | null;
  ancien_locataire: string | null;
}

/** La ligne « Locataire … » d'une carte (`locataireCardLine`), ou rien. */
export function ligneLocataire(item: LieuCarte): string | null {
  const numero = item.numero_logement ? ` · Log ${item.numero_logement}` : "";
  const adresse = avecVille(item.adresse_locataire, item.code_postal, item.ville);
  if (item.precision_commune) return `Partie commune : ${item.precision_commune}${adresse ? ` — ${adresse}` : ""}`;
  if (item.ancien_locataire) return `Ancien locataire${numero} : ${item.ancien_locataire}${adresse ? ` — ${adresse}` : ""}`;
  if (item.adresse_locataire || item.occupant || item.numero_logement) {
    let ligne = `Locataire${numero}`;
    if (item.occupant) ligne += ` : ${item.occupant}`;
    if (adresse) ligne += `${item.occupant ? " — " : " : "}${adresse}`;
    return ligne;
  }
  return null;
}

/** Le badge du logement (`logementBadge`) : occupé en orange, vacant en vert, partie commune en bleu. */
export function badgeLogement(statut: string | null): { classe: ClasseBadge; libelle: string } | null {
  if (statut === "occupé") return { classe: "warn", libelle: "Logement occupé" };
  if (statut === "vacant") return { classe: "success", libelle: "Logement vacant" };
  if (statut === "commune") return { classe: "info", libelle: "Partie commune" };
  return null;
}

/** La classe du badge de statut d'un devis ou d'une facture (`badgeClass`, app.js l. 855). */
export function classeStatut(statut: string | null): ClasseBadge {
  const table: Record<string, ClasseBadge> = {
    brouillon: "gray", envoyé: "info", envoyée: "info", accepté: "success", payée: "success", terminée: "success", reçu: "success",
    refusé: "danger", impayée: "danger", annulé: "danger", "en cours": "yellow",
  };
  return (statut && table[statut]) || "gray";
}

/** « 12 factures sur 48. » — seulement quand un filtre est actif (`syntheseListe`). */
export function syntheseListe(retenus: number, total: number, quoi: string, actif: boolean): string | null {
  if (!actif || retenus === total) return null;
  return `${retenus} ${quoi}${retenus > 1 ? "s" : ""} sur ${total}.`;
}
