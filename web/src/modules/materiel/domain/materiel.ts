import { z } from "zod";
import { correspond } from "@/lib/recherche";
import { videEnNull } from "@/lib/validation";

/** Une fiche de matériel telle que la base la rend (`materiels`). */
export const schemaMateriel = z.object({
  id: z.string(),
  societe_id: z.string(),
  nom: z.string(),
  categorie: z.string().nullable(),
  etat_general: z.string().nullable(),
  numero_serie: z.string().nullable(),
  date_achat: z.string().nullable(),
});
export type Materiel = z.infer<typeof schemaMateriel>;

const texte = z.preprocess(videEnNull, z.string().trim().nullable());

export const schemaSaisieMateriel = z.object({
  nom: z.string().trim().min(1, "Le nom du matériel est requis."),
  categorie: texte,
  etat_general: texte,
  numero_serie: texte,
  date_achat: z.preprocess(videEnNull, z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide.").nullable()),
});
export type SaisieMateriel = z.infer<typeof schemaSaisieMateriel>;

export function saisieDepuis(m: Materiel | null, etatParDefaut: string): Record<keyof SaisieMateriel, string> {
  return {
    nom: m?.nom ?? "",
    categorie: m?.categorie ?? "",
    etat_general: m ? (m.etat_general ?? "") : etatParDefaut,
    numero_serie: m?.numero_serie ?? "",
    date_achat: m?.date_achat ?? "",
  };
}

/** Repli de l'ancien écran quand le référentiel « etat_materiel » est vide (`ETATS_MATERIEL`, app.js l. 14561). */
export const ETATS_MATERIEL = ["Neuf", "Bon état", "Usé", "À réparer", "Hors service"] as const;

/**
 * Les états proposés (`etatMaterielOptions`) : le référentiel, sinon le repli ;
 * la valeur courante est réinjectée EN TÊTE si elle n'y est plus — sinon
 * rouvrir puis enregistrer une fiche changerait son état en silence.
 */
export function etatsProposes(declares: readonly string[], courant: string | null): string[] {
  const utiles = declares.filter(Boolean);
  const liste = utiles.length ? utiles : [...ETATS_MATERIEL];
  return courant && !liste.includes(courant) ? [courant, ...liste] : liste;
}

/** Forme comparable d'un libellé (`normaliserEntree` de regles-referentiels.ts). */
function cleEntree(texte: string): string {
  return texte
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
}

/**
 * Les catégories proposées (`referentielCompose`) : les déclarées dans leur
 * ordre, PUIS celles que les fiches emploient déjà, par ordre alphabétique —
 * une catégorie saisie du temps du champ libre doit rester resélectionnable.
 * Deux graphies d'un même libellé (« Échafaudage » / « echafaudage ») n'en font
 * qu'une : celle du référentiel.
 */
export function composerListe(declares: readonly (string | null)[], employes: readonly (string | null)[]): string[] {
  const retenus = new Map<string, string>();
  for (const brut of declares) {
    const v = (brut ?? "").trim();
    const cle = cleEntree(v);
    if (cle && !retenus.has(cle)) retenus.set(cle, v);
  }
  const ajoutes = new Map<string, string>();
  for (const brut of employes) {
    const v = (brut ?? "").trim();
    const cle = cleEntree(v);
    if (cle && !retenus.has(cle) && !ajoutes.has(cle)) ajoutes.set(cle, v);
  }
  return [...retenus.values(), ...[...ajoutes.values()].sort((a, b) => a.localeCompare(b, "fr"))];
}

/**
 * La valeur courante telle que la liste l'écrit. L'ancien menu comparait à
 * l'identique : une fiche « echafaudage » face à « Échafaudage » ne trouvait
 * plus sa catégorie et repartait sur « — Non précisé — » à l'enregistrement.
 */
export function valeurDansListe(liste: readonly string[], courant: string | null): string {
  if (!courant) return "";
  return liste.find((v) => cleEntree(v) === cleEntree(courant)) ?? courant;
}

export function filtrerMateriels<M extends Materiel>(liste: readonly M[], recherche: string): M[] {
  return liste.filter((m) => correspond(recherche, m.nom, m.categorie));
}
