import Big from "big.js";
import { z } from "zod";
import { montant, somme, ZERO, type Montant } from "@/lib/money";
import { videEnNull } from "@/lib/validation";

/**
 * Les achats (dépenses) d'un chantier — CHA-11, CHA-22, CHA-23.
 *
 * La catégorie stockée est un CODE du référentiel `categorie_achat` ; son
 * libellé se renomme sans toucher aux dépenses déjà saisies. « salarie » ouvre
 * la saisie salarié + heures, qui calcule le montant (app.js l. 14141-14285).
 */
export interface CategorieAchat {
  code: string;
  libelle: string;
  couleur: string;
  icone: string;
}

/** Le repli de l'ancien écran, tant que le référentiel est vide ou pas encore chargé. */
export const CATEGORIES_ACHAT_REPLI: readonly CategorieAchat[] = [
  { code: "fournitures", libelle: "Fournitures", icone: "📦", couleur: "#2E9BF0" },
  { code: "salarie", libelle: "Salarié", icone: "👷", couleur: "#F0A82E" },
  { code: "soustraitant", libelle: "Sous-traitant", icone: "🔧", couleur: "#9B6EF0" },
];
export const CATEGORIE_SALARIE = "salarie";
const COULEUR_INCONNUE = "#999";
const ICONE_INCONNUE = "💰";

/** Les entrées du référentiel sans code sont ignorées : une dépense ne peut pas pointer vers elles. */
export function categoriesAchat(referentiel: readonly { code: string | null; libelle: string; couleur: string | null; icone: string | null }[]): CategorieAchat[] {
  const declarees = referentiel
    .filter((r): r is typeof r & { code: string } => !!r.code)
    .map((r) => ({ code: r.code, libelle: r.libelle, icone: r.icone || ICONE_INCONNUE, couleur: r.couleur || COULEUR_INCONNUE }));
  return declarees.length ? declarees : [...CATEGORIES_ACHAT_REPLI];
}

/** Une catégorie inconnue (supprimée du référentiel) garde son code comme libellé plutôt que de disparaître. */
export function categorieDe(categories: readonly CategorieAchat[], code: string | null): CategorieAchat {
  return categories.find((c) => c.code === code) ?? { code: code ?? "", libelle: code ?? "", couleur: COULEUR_INCONNUE, icone: ICONE_INCONNUE };
}

export interface AchatMontant {
  categorie: string | null;
  montant: number | string;
}

export interface TotalCategorie {
  categorie: CategorieAchat;
  montant: Montant;
  /** Part du total général, arrondie à l'unité (barre de l'ancien écran). */
  pourcentage: number;
}

/**
 * Totaux par catégorie DÉCLARÉE. Comme l'ancien écran, le total général est la
 * somme de ces totaux : une dépense d'une catégorie retirée du référentiel
 * reste listée mais ne pèse dans aucune barre.
 */
export function totauxParCategorie(categories: readonly CategorieAchat[], achats: readonly AchatMontant[]): { parCategorie: TotalCategorie[]; total: Montant } {
  const montants = categories.map((cat) => somme(achats.filter((a) => a.categorie === cat.code).map((a) => montant(a.montant))));
  const total = somme(montants);
  const parCategorie = categories.map((categorie, i) => {
    const m = montants[i] ?? ZERO;
    const pourcentage = total.gt(0) ? Number(m.div(total).times(100).round(0, Big.roundHalfUp)) : 0;
    return { categorie, montant: m, pourcentage };
  });
  return { parCategorie, total };
}

/** Montant d'une dépense de main-d'œuvre : heures × coût horaire chargé. Null si le coût n'est pas connu (CHA-55). */
export function montantSalarie(heures: string, coutHoraire: number | null): Montant | null {
  if (coutHoraire == null || coutHoraire === 0) return null;
  return montant(heures).times(montant(coutHoraire));
}

export function trierAchats<T extends { date_achat: string | null }>(achats: readonly T[]): T[] {
  return [...achats].sort((a, b) => (b.date_achat ?? "").localeCompare(a.date_achat ?? ""));
}

const nombre = (message: string) =>
  z.preprocess(
    (v) => (typeof v === "string" ? v.trim().replace(/\s/g, "").replace(",", ".") : v),
    z.string().regex(/^-?\d+(\.\d+)?$/, message).transform(Number)
  );

export const schemaSaisieAchat = z
  .object({
    categorie: z.string().min(1, "Choisissez une catégorie."),
    designation: z.string().trim().min(1, "Indiquez une désignation pour cet achat."),
    // Comme l'ancien écran (`parseFloat(...) || 0`), un montant laissé vide vaut 0.
    montant: z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? "0" : v), nombre("Montant invalide.")),
    date_achat: z.iso.date({ message: "Date invalide." }),
    salarie_id: z.preprocess(videEnNull, z.string().nullable()),
    heures: z.preprocess(videEnNull, nombre("Nombre d'heures invalide.").nullable()),
    fournisseur: z.preprocess(videEnNull, z.string().trim().nullable()),
  })
  // Hors main-d'œuvre, salarié et heures ne partent pas : l'ancien écran les remettait à NULL.
  .transform((a) => (a.categorie === CATEGORIE_SALARIE ? a : { ...a, salarie_id: null, heures: null }));
export type SaisieAchat = z.infer<typeof schemaSaisieAchat>;
