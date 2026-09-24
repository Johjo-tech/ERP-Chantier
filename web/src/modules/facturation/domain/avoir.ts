import { arrondiCentimes, formatEuros, montant, somme, ZERO, type Montant } from "@/lib/money";
import { estAvoir } from "@/modules/documents/domain/totaux";
import { DEMI_CENTIME, type ReglementMontant } from "./reglements";

export { estAvoir };

/** Port de `src/api/regles-avoir.ts`. */
export const LONGUEUR_MOTIF_MIN = 5;

export const MOTIFS_AVOIR = [
  "Erreur de facturation (quantité ou montant)",
  "Prestation non réalisée",
  "Travaux non conformes",
  "Remise commerciale accordée après facturation",
  "Erreur de destinataire",
  "Double facturation",
  "Annulation de la commande",
] as const;

export const MODE_REGLEMENT_AVOIR = "avoir";
export const MODE_REGLEMENT_IMPUTATION = "imputation";

export function libelleDocument(typeDocument: string | null | undefined): string {
  const t = String(typeDocument ?? "").toLowerCase();
  if (t.includes("avoir")) return "AVOIR";
  if (t.includes("acompte")) return "FACTURE D'ACOMPTE";
  return "FACTURE";
}

/** L'avoir rectifie une pièce ÉMISE ; un brouillon se corrige lui-même. */
export function refusAvoir(facture: { numero: string | null; type_document: string } | null, motif: string): string | null {
  if (!facture) return "Facture introuvable.";
  if (!String(facture.numero ?? "").trim()) {
    return "Cette facture n'est pas émise : modifiez-la directement, un avoir n'aurait rien à corriger.";
  }
  if (estAvoir(facture.type_document)) return "Un avoir ne s'annule pas par un autre avoir : il faut refacturer.";
  if (motif.trim().length < LONGUEUR_MOTIF_MIN) {
    return "Le motif est obligatoire : il s'imprime sur l'avoir et justifie la rectification.";
  }
  return null;
}

export function resteAImputer(ttcAvoir: unknown, reglements: readonly ReglementMontant[]): Montant {
  const credit = arrondiCentimes(montant(ttcAvoir)).abs();
  const impute = arrondiCentimes(somme(reglements.map((r) => montant(r.montant))));
  const reste = arrondiCentimes(credit.minus(impute));
  return reste.lt(DEMI_CENTIME) ? ZERO : reste;
}

export type CleImputation = "disponible" | "partiellement_impute" | "impute";
export const LIBELLES_IMPUTATION: Record<CleImputation, string> = {
  disponible: "Disponible",
  partiellement_impute: "Partiellement imputé",
  impute: "Imputé",
};

export function statutImputation(ttcAvoir: unknown, reglements: readonly ReglementMontant[]) {
  const credit = arrondiCentimes(montant(ttcAvoir)).abs();
  const reste = resteAImputer(ttcAvoir, reglements);
  const impute = arrondiCentimes(credit.minus(reste));
  const cle: CleImputation = reste.lt(DEMI_CENTIME) ? "impute" : impute.lt(DEMI_CENTIME) ? "disponible" : "partiellement_impute";
  return { cle, libelle: LIBELLES_IMPUTATION[cle], impute, reste };
}

interface PieceImputation {
  numero: string | null;
  type_document: string;
  client_nom: string | null;
}

/** Contrôles de l'imputation d'un avoir sur une facture, dans l'ordre de l'ancien code. */
export function refusImputationAvoir(s: {
  avoir: PieceImputation | null;
  facture: PieceImputation | null;
  montant: unknown;
  resteFacture: unknown;
  resteAvoir: unknown;
}): string | null {
  const { avoir, facture } = s;
  if (!avoir) return "Avoir introuvable.";
  if (!facture) return "Facture introuvable.";
  if (!estAvoir(avoir.type_document)) return "Ce document n'est pas un avoir.";
  if (estAvoir(facture.type_document)) return "Un avoir ne s'impute pas sur un autre avoir.";
  if (!String(facture.numero ?? "").trim()) return "Cette facture n'est pas émise : il n'y a rien à solder.";
  const ca = String(avoir.client_nom ?? "").trim();
  const cf = String(facture.client_nom ?? "").trim();
  if (ca && cf && ca !== cf) return `Cet avoir a été établi pour ${ca} : il ne peut pas solder une facture de ${cf}.`;
  const m = arrondiCentimes(montant(s.montant));
  if (m.lte(0)) return "Le montant imputé doit être supérieur à 0.";
  const ra = arrondiCentimes(montant(s.resteAvoir));
  if (ra.lte(0)) return "Cet avoir est déjà entièrement imputé.";
  if (m.minus(ra).gt(DEMI_CENTIME)) return `Cet avoir ne dispose plus que de ${formatEuros(ra)}.`;
  const rf = arrondiCentimes(montant(s.resteFacture));
  if (rf.lte(0)) return "Cette facture est déjà entièrement réglée.";
  if (m.minus(rf).gt(DEMI_CENTIME)) return `La facture ne doit plus que ${formatEuros(rf)}.`;
  return null;
}
