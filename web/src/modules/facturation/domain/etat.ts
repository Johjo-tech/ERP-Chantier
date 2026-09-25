import { partiesIso } from "@/lib/dates";
import { JOUR_MS } from "@/lib/durees";
import { montant, type Montant } from "@/lib/money";
import { statutImputation } from "./avoir";
import { statutReglement, type ReglementMontant } from "./reglements";
import { estAvoir } from "@/modules/documents/domain/totaux";

/**
 * L'état affiché d'une pièce, dans l'ordre de l'ancien écran (app.js l. 6482) :
 * pièce historique « payée » → réglée par reprise (aucun règlement fabriqué) ;
 * avoir → statut d'imputation ; sinon statut de règlement.
 */
export type EtatPiece =
  | { nature: "brouillon" }
  | { nature: "reprise"; libelle: string }
  | { nature: "avoir"; cle: "disponible" | "partiellement_impute" | "impute"; libelle: string; reste: Montant }
  | { nature: "facture"; cle: "non_reglee" | "partiellement_reglee" | "reglee"; libelle: string; reste: Montant; enRetard: boolean; joursRetard: number };

const SEUIL_RETARD = montant("0.01");

/** Jours écoulés depuis l'échéance (ou la date), dates « AAAA-MM-JJ » comparées en UTC. */
export function joursDepuis(reference: string, aujourdhui: string): number {
  const j = (d: string) => {
    const { annee, mois, jour } = partiesIso(d);
    return Date.UTC(annee, mois - 1, jour);
  };
  return (j(aujourdhui) - j(reference)) / JOUR_MS;
}

export function etatPiece(
  f: { numero: string | null; type_document: string; statut: string; legacy_id: string | null; date: string; echeance: string | null },
  ttc: unknown,
  reglements: readonly ReglementMontant[],
  aujourdhui: string
): EtatPiece {
  if (!f.numero && f.statut === "brouillon") return { nature: "brouillon" };
  const avoir = estAvoir(f.type_document);
  if (f.legacy_id && f.statut === "payée") return { nature: "reprise", libelle: avoir ? "Imputé (reprise)" : "Réglée (reprise)" };
  if (avoir) {
    const s = statutImputation(ttc, reglements);
    return { nature: "avoir", cle: s.cle, libelle: s.libelle, reste: s.reste };
  }
  const s = statutReglement(ttc, reglements);
  const jours = joursDepuis(f.echeance || f.date, aujourdhui);
  const enRetard = s.reste.gt(SEUIL_RETARD) && jours > 0;
  return { nature: "facture", cle: s.cle, libelle: s.libelle, reste: s.reste, enRetard, joursRetard: enRetard ? jours : 0 };
}

/** « En retard de N j », « Échéance aujourd'hui », « Échéance dans N j » — rien si soldée. */
export function libelleDelai(e: EtatPiece, echeanceOuDate: string, aujourdhui: string): string | null {
  if (e.nature !== "facture" || !e.reste.gt(SEUIL_RETARD)) return null;
  const j = joursDepuis(echeanceOuDate, aujourdhui);
  if (j > 0) return `En retard de ${j} j`;
  if (j === 0) return "Échéance aujourd'hui";
  return `Échéance dans ${-j} j`;
}

export { montant };
