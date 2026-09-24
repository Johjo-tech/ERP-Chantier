import { z } from "zod";
import { schemaNombreFr } from "@/lib/nombres";
import { videEnNull } from "@/lib/validation";

export const TYPES_ARTICLE = [
  { code: "service", libelle: "Prestation" },
  { code: "bien", libelle: "Bien" },
] as const;
export type TypeArticle = (typeof TYPES_ARTICLE)[number]["code"];

/** L'unité d'un article neuf, comme l'ancien catalogue. */
export const UNITE_DEFAUT = "u";

/** Un article tel que la base le rend (ART-30). `metier` n'est ni saisi ni recopié (ART-50). */
export const schemaArticle = z.object({
  id: z.string(),
  societe_id: z.string(),
  code: z.string(),
  designation: z.string(),
  description: z.string().nullable(),
  unite: z.string().nullable(),
  prix_unitaire: z.number(),
  prix_achat: z.number().nullable(),
  tva: z.number(),
  // Une contrainte CHECK borne la colonne ; un texte inattendu signalerait un schéma qui a bougé.
  type_article: z.enum(["bien", "service"]),
  famille: z.string().nullable(),
  actif: z.boolean(),
  gere_en_stock: z.boolean(),
});
export type Article = z.infer<typeof schemaArticle>;

const texte = z.preprocess(videEnNull, z.string().trim().nullable());
const OUI = "oui";

/**
 * La fiche saisie (ART-02). Code et désignation obligatoires ; le prix de vente
 * vide vaut 0 comme dans l'ancien écran, mais un prix ILLISIBLE est refusé au
 * lieu d'être lu 0 par `parseFloat` (D-013). Le prix d'achat vide reste vide :
 * « inconnu » n'est pas « gratuit ».
 */
export const schemaSaisieArticle = z.object({
  code: z.string().trim().min(1, "Le code article est obligatoire."),
  designation: z.string().trim().min(1, "La désignation est obligatoire."),
  famille: texte,
  description: texte,
  type_article: z.enum(["bien", "service"], { message: "Type d'article inconnu." }),
  unite: texte,
  prix_unitaire: z.preprocess((v) => videEnNull(v) ?? "0", schemaNombreFr),
  prix_achat: z.preprocess(videEnNull, schemaNombreFr.nullable()),
  tva: z.preprocess(
    (v) => videEnNull(v) ?? "",
    schemaNombreFr.pipe(z.number().min(0, "La TVA est comprise entre 0 et 100 %.").max(100, "La TVA est comprise entre 0 et 100 %."))
  ),
  gere_en_stock: z.string().transform((v) => v === OUI),
});
export type SaisieArticle = z.infer<typeof schemaSaisieArticle>;
export type ValeursArticle = Record<keyof SaisieArticle, string>;

const enTexte = (n: number) => String(n).replace(".", ",");

/** Valeurs du formulaire : une fiche existante, ou une fiche neuve (éventuellement pré-remplie). */
export function valeursDepuis(a: Article | null, tvaDefaut: number, brouillon: Partial<ValeursArticle> = {}): ValeursArticle {
  if (!a) {
    return {
      code: "", designation: "", famille: "", description: "", type_article: "service", unite: UNITE_DEFAUT,
      prix_unitaire: "0", prix_achat: "", tva: enTexte(tvaDefaut), gere_en_stock: "", ...brouillon,
    };
  }
  return {
    code: a.code,
    designation: a.designation,
    famille: a.famille ?? "",
    description: a.description ?? "",
    type_article: a.type_article,
    unite: a.unite ?? "",
    prix_unitaire: enTexte(a.prix_unitaire),
    prix_achat: a.prix_achat == null ? "" : enTexte(a.prix_achat),
    tva: enTexte(a.tva),
    gere_en_stock: a.gere_en_stock ? OUI : "",
  };
}

export const valeurCase = (coche: boolean) => (coche ? OUI : "");

export function libelleType(t: TypeArticle): string {
  return TYPES_ARTICLE.find((x) => x.code === t)?.libelle ?? "Prestation";
}

/** Filtre d'état de la liste : actifs par défaut, les retirés se demandent (ART-01). */
export type FiltreActif = "actifs" | "retires" | "tous";

export interface CriteresArticles {
  recherche: string;
  actif: FiltreActif;
  type: TypeArticle | "";
  famille: string;
  page: number;
}

export const CRITERES_DEFAUT: CriteresArticles = { recherche: "", actif: "actifs", type: "", famille: "", page: 1 };

export const PAR_PAGE = 25;

export function nombreDePages(total: number, parPage = PAR_PAGE): number {
  return Math.max(1, Math.ceil(total / parPage));
}

/**
 * Le motif d'un `ilike` : `%` et `_` du texte saisi sont des caractères, pas
 * des jokers — chercher « 10_20 » ne doit pas trouver « 10-20 ». La barre
 * oblique inverse, caractère d'échappement de `LIKE`, s'échappe elle aussi.
 */
export function motifRecherche(q: string): string {
  return `%${q.trim().replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}
