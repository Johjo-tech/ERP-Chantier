import { arrondiCentimes, montant, type Montant } from "@/lib/money";
import { totauxDocument, type LigneMontant } from "@/modules/documents/domain/totaux";

/**
 * Ce qu'un bon de commande doit porter, et ce qu'il vaut.
 *
 * Port de `src/api/regles-bc.ts` (refBonCommandeClient, lignesDeTravaux,
 * manquesBonCommande) et des règles de `saveBonCommande` (app.js l. 8431) ;
 * parité : tests/parite/commandes.essai.ts.
 */

/** Ce que la saisie écrit quand le client n'a pas (encore) donné de numéro. */
export const SENTINELLE_ATTENTE = "En attente de BC";
export const SENTINELLE_SANS = "Sans BC";
const SENTINELLES: readonly string[] = [SENTINELLE_ATTENTE, SENTINELLE_SANS];
/** Préfixe de NOTRE série SAV : jamais une référence que le client reconnaîtrait. */
const PREFIXE_SAV = "SAV-";

/**
 * La référence du bon telle que le client la connaît (BT-13), ou rien.
 * Miroir de `public.ref_bc_client` : la première ligne du champ, hors
 * sentinelles et hors numéro SAV — une phrase française dans un champ
 * normalisé serait pire qu'un champ vide.
 */
export function refBonCommandeClient(numeroBc?: string | null): string | null {
  const brut = (numeroBc ?? "").trim();
  if (!brut || brut.startsWith(PREFIXE_SAV)) return null;
  const premiere = (brut.split("\n")[0] ?? "").trim();
  if (!premiere || SENTINELLES.includes(premiere)) return null;
  return premiere;
}

/** Le numéro tel qu'on le rend saisissable : une sentinelle n'est pas un numéro (numeroBCSaisissable). */
export function numeroSaisissable(numeroBc: string | null): string {
  return SENTINELLES.includes((numeroBc ?? "").trim()) ? "" : (numeroBc ?? "");
}

export type ModeBon = "normal" | "sans_bc" | "attente_bc";

export const LIBELLES_MODE: Record<ModeBon, string> = {
  normal: "Nouveau BC",
  sans_bc: "Sans BC",
  attente_bc: "En attente de BC",
};

export function modeDuBon(b: { sans_bc: boolean; en_attente_bc: boolean }): ModeBon {
  if (b.en_attente_bc) return "attente_bc";
  return b.sans_bc ? "sans_bc" : "normal";
}

/**
 * Le numéro à écrire et les drapeaux qui l'accompagnent (BC-31).
 * La saisie d'un numéro EST la bascule : un bon en attente qui reçoit enfin
 * le sien devient un bon standard, sans geste d'état séparé. Tant que le
 * champ reste vide, la sentinelle garde la trace du mode.
 */
export function numeroAEnregistrer(mode: ModeBon, saisi: string) {
  const numero = saisi.trim();
  const sans_bc = mode === "sans_bc" && !numero;
  const en_attente_bc = mode === "attente_bc" && !numero;
  const sentinelle = en_attente_bc ? SENTINELLE_ATTENTE : sans_bc ? SENTINELLE_SANS : null;
  return { numero_bc: numero || sentinelle, sans_bc, en_attente_bc };
}

/** Une ligne telle que les règles la lisent (projection de la saisie ou de la base). */
export interface LigneBon extends LigneMontant {
  type?: string | null;
  designation?: string | null;
}

const estLigne = (l: LigneBon) => (l.type ?? "ligne") === "ligne";

/** Une ligne de travaux dit ce qu'il y a à faire ; le prix peut attendre le chiffrage. */
export function lignesDeTravaux<L extends LigneBon>(lignes: readonly L[] | null | undefined): L[] {
  return (lignes ?? []).filter((l) => estLigne(l) && (l.designation ?? "").trim() !== "");
}

export type CodeManque = "adresse_intervention" | "ligne_travaux";

export interface Manque {
  code: CodeManque;
  libelle: string;
}

/**
 * Ce qui manque pour enregistrer un bon hors brouillon (BC-30). L'adresse
 * d'intervention est reportée sur la facture sous « Lieu d'intervention » ;
 * sans ligne, `bc_generer_facture` s'invente un forfait qui ne décrit rien.
 */
export function manquesBonCommande(bon: { adresse?: string | null; lignes?: readonly LigneBon[] | null }): Manque[] {
  const manques: Manque[] = [];
  if ((bon.adresse ?? "").trim() === "") {
    manques.push({
      code: "adresse_intervention",
      libelle:
        "L'adresse d'intervention est obligatoire : c'est le lieu des travaux, pas l'adresse du client. " +
        "Elle est reportée sur la facture sous « Lieu d'intervention ».",
    });
  }
  if (!lignesDeTravaux(bon.lignes).length) {
    manques.push({
      code: "ligne_travaux",
      libelle:
        "Au moins une ligne de travaux est obligatoire : décrivez en gros ce qu'il y a à faire. " +
        "Le prix peut attendre le chiffrage, la description non — sans elle, la facture ne dira pas ce qui a été fait.",
    });
  }
  return manques;
}

/**
 * Le bon a-t-il des lignes qui font foi (bcLignesOntDuContenu) ? Une ligne
 * compte dès qu'elle a une désignation OU un prix — l'ancien test, espaces
 * compris, que `manquesBonCommande` ne reprend pas (il trime).
 */
export function lignesOntDuContenu(lignes: readonly LigneBon[]): boolean {
  return lignes.some((l) => estLigne(l) && (!!l.designation || montant(l.prix_unitaire).gt(0)));
}

/**
 * Le montant du bon (BC-33). Dès qu'une ligne est renseignée, ce sont les
 * lignes qui font foi : leur HT, sans arrondi. Un bon SANS ligne garde son
 * montant saisi — sinon rouvrir l'un des 12 bons de production dans ce cas
 * (25 323,48 €) le ramènerait à zéro.
 */
export function montantDuBon(lignes: readonly LigneBon[], montantSaisi: unknown): Montant {
  return lignesOntDuContenu(lignes) ? totauxDocument(lignes).ht : montant(montantSaisi);
}

/** Le montant tel que la colonne numeric(14,2) le garde : arrondi au bord, pas dans le calcul (D-006). */
export function montantAEnregistrer(lignes: readonly LigneBon[], montantSaisi: unknown): number {
  return Number(arrondiCentimes(montantDuBon(lignes, montantSaisi)).toString());
}
