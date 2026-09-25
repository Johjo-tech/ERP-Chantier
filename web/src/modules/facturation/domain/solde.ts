import { z } from "zod";
import { arrondiCentimes, montant, somme, type Montant } from "@/lib/money";
import { LIBELLES_IMPUTATION } from "./avoir";
import type { EtatPiece } from "./etat";
import { LIBELLES_REGLEMENT } from "./reglements";

/**
 * Le solde de chaque pièce, LU dans `v_facture_solde` (proposition
 * 20260926040000, D-FAC-01) : la base calcule payé, reste, retard ; l'écran
 * ne fait que les montrer et les additionner. Remplace le recalcul à l'écran
 * que D-050 assumait faute d'une vue juste.
 */
export const CLES_SOLDE = ["brouillon", "reprise", "non_reglee", "partiellement_reglee", "reglee", "disponible", "partiellement_impute", "impute"] as const;
export type CleSolde = (typeof CLES_SOLDE)[number];

export const schemaSolde = z.object({
  facture_id: z.string(),
  societe_id: z.string(),
  numero: z.string().nullable(),
  type_document: z.string(),
  date: z.string(),
  echeance: z.string().nullable(),
  client_id: z.string().nullable(),
  client_nom: z.string(),
  chantier_id: z.string().nullable(),
  interlocuteur: z.string().nullable(),
  cle: z.enum(CLES_SOLDE),
  sens: z.number(),
  ttc: z.number(),
  paye: z.number(),
  reste: z.number(),
  reste_exigible: z.number(),
  jours_retard: z.number().nullable(),
  en_retard: z.boolean(),
  du: z.number(),
  credit: z.number(),
  acomptes: z.number(),
  retenue: z.number(),
  net_a_payer: z.number(),
});
export type Solde = z.infer<typeof schemaSolde>;

export const COLONNES_SOLDE = Object.keys(schemaSolde.shape).join(", ");

/** Le solde de la base, dans la forme que les écrans affichent (badge, reste, retard). */
export function etatDepuisSolde(s: Solde): EtatPiece {
  switch (s.cle) {
    case "brouillon":
      return { nature: "brouillon" };
    case "reprise":
      return { nature: "reprise", libelle: s.sens < 0 ? "Imputé (reprise)" : "Réglée (reprise)" };
    case "disponible":
    case "partiellement_impute":
    case "impute":
      return { nature: "avoir", cle: s.cle, libelle: LIBELLES_IMPUTATION[s.cle], reste: montant(s.reste) };
    default:
      return { nature: "facture", cle: s.cle, libelle: LIBELLES_REGLEMENT[s.cle], reste: montant(s.reste), enRetard: s.en_retard, joursRetard: s.en_retard ? (s.jours_retard ?? 0) : 0 };
  }
}

export const estAvoirSolde = (s: Pick<Solde, "sens">) => s.sens < 0;

/** Ce qui s'additionne aux créances : jamais le crédit d'un avoir (FAC-85). */
export function totalDu(soldes: readonly Pick<Solde, "du">[]): Montant {
  return arrondiCentimes(somme(soldes.map((s) => montant(s.du))));
}

export type EtatFiltre = "" | "non_reglee" | "partiellement_reglee" | "reglee" | "en_retard";

export const ETATS_REGLEMENT: readonly { valeur: EtatFiltre; libelle: string }[] = [
  { valeur: "", libelle: "Tous les états" },
  { valeur: "non_reglee", libelle: "Non réglées" },
  { valeur: "partiellement_reglee", libelle: "Partiellement réglées" },
  { valeur: "reglee", libelle: "Réglées" },
  { valeur: "en_retard", libelle: "En retard" },
];

/**
 * La pièce répond-elle à l'état demandé (`factureRepondALEtat`, app.js l.
 * 10766) ? Une seule définition pour « Par client » et « Par facture ». Les
 * avoirs ne répondent à aucun état : ils ne se règlent pas, ils s'imputent.
 */
export function repondALEtat(s: Solde, etat: EtatFiltre): boolean {
  if (!etat) return true;
  if (estAvoirSolde(s)) return false;
  if (etat === "en_retard") return s.en_retard;
  // Une pièce historique « payée » est réglée (par reprise).
  if (etat === "reglee") return s.cle === "reglee" || s.cle === "reprise";
  return s.cle === etat;
}

export interface DossierClient {
  client: string;
  pieces: Solde[];
  du: Montant;
  enRetard: boolean;
}

/**
 * Les dossiers de « Par client » (`listeDossiersReglementsHTML`) : le total dû
 * et le retard sortent de la MÊME liste que celle qu'on montre — un filtre
 * « Réglées » n'annonce pas « 2 200 € dû ». Brouillons écartés : ils ne doivent rien.
 */
export function dossiersClients(soldes: readonly Solde[], etat: EtatFiltre): DossierClient[] {
  const parClient = new Map<string, Solde[]>();
  for (const s of soldes) {
    if (s.cle === "brouillon" || !repondALEtat(s, etat)) continue;
    parClient.set(s.client_nom, [...(parClient.get(s.client_nom) ?? []), s]);
  }
  return [...parClient.entries()]
    .sort(([a], [b]) => a.localeCompare(b, "fr"))
    .map(([client, pieces]) => ({ client, pieces, du: totalDu(pieces), enRetard: pieces.some((p) => p.en_retard) }));
}

export type TriFactures = "retard" | "reste" | "echeance" | "client";

export const TRIS_REGLEMENT: readonly { valeur: TriFactures; libelle: string }[] = [
  { valeur: "retard", libelle: "Les plus en retard d'abord" },
  { valeur: "reste", libelle: "Reste dû décroissant" },
  { valeur: "echeance", libelle: "Échéance la plus proche" },
  { valeur: "client", libelle: "Client (A → Z)" },
];

export interface CriteresParFacture {
  etat: EtatFiltre;
  client: string;
  /** Bornes sur l'ÉCHÉANCE (à défaut la date) : ce qui arrive à terme dans la période. */
  du: string;
  au: string;
  tri: TriFactures;
}

const terme = (s: Solde) => s.echeance || s.date;
const COMPARATEURS: Record<TriFactures, (a: Solde, b: Solde) => number> = {
  retard: (a, b) => Number(b.en_retard) - Number(a.en_retard) || (b.jours_retard ?? 0) - (a.jours_retard ?? 0),
  reste: (a, b) => b.reste - a.reste,
  echeance: (a, b) => terme(a).localeCompare(terme(b)),
  client: (a, b) => a.client_nom.localeCompare(b.client_nom, "fr"),
};

/** « Par facture » (`facturesParEtatReglement`, app.js l. 10792) : avoirs et brouillons exclus. */
export function facturesParEtat(soldes: readonly Solde[], c: CriteresParFacture): Solde[] {
  return soldes
    .filter((s) => !estAvoirSolde(s) && s.cle !== "brouillon")
    .filter((s) => !c.client || s.client_nom === c.client)
    .filter((s) => !c.du || terme(s) >= c.du)
    .filter((s) => !c.au || terme(s) <= c.au)
    .filter((s) => repondALEtat(s, c.etat))
    .sort(COMPARATEURS[c.tri]);
}

