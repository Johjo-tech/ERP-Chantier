import { z } from "zod";
import { TAUX_TVA_DEFAUT, UNITES_DEFAUT } from "./reglages";

/**
 * Les réglages COMPLETS d'une société, tels que l'écran Réglages les lit et les
 * écrit (`src/integrations/reglages.ts` de l'ancienne app). `reglages.ts` n'en
 * garde que la part utile aux documents, pour les autres modules.
 */

/**
 * Seuils d'alerte, en jours avant échéance (`SEUILS` de `src/integrations/alertes.ts`).
 * `conducteurSansRdv` ne sonne rien : il décide de ce qui remonte au tableau de
 * bord du conducteur.
 */
export const SEUILS_DEFAUT = {
  vehiculeCarte: 30,
  vehiculeControle: 30,
  documentLegal: 30,
  carteBtp: 60,
  visiteMedicale: 45,
  habilitation: 60,
  conducteurSansRdv: 7,
};
export type Seuils = typeof SEUILS_DEFAUT;
export type CleSeuil = keyof Seuils;

export const LIBELLES_SEUILS: Record<CleSeuil, string> = {
  vehiculeCarte: "Cartes carburant et télépéage",
  vehiculeControle: "Contrôles périodiques véhicule",
  documentLegal: "Documents légaux",
  carteBtp: "Cartes BTP",
  visiteMedicale: "Visites médicales",
  habilitation: "Habilitations",
  conducteurSansRdv: "Bon reçu et non planifié (jours)",
};

export type DomaineSeuils = "rh" | "vehicules" | "conduite";

/** Les onglets de seuils de l'ancien écran : RH, véhicules, conduite de travaux. */
export const SEUILS_PAR_DOMAINE: Record<DomaineSeuils, readonly CleSeuil[]> = {
  rh: ["carteBtp", "visiteMedicale", "habilitation", "documentLegal"],
  vehicules: ["vehiculeCarte", "vehiculeControle"],
  conduite: ["conducteurSansRdv"],
};

export interface ReglagesDocumentsComplets {
  validiteDevisJours: number;
  delaiPaiementJours: number;
  modeDelaiPaiement: string;
  tvaDefaut: number;
  modeReglementDefaut: string;
  conditionsDevis: string;
  piedDePage: string;
  mentionAcceptation: string;
  mentionsComplementaires: string;
  afficherIban: boolean;
  couleurAccent: string;
  couleurSecondaire: string;
  siteWeb: string;
}

export interface ReglagesSociete {
  documents: ReglagesDocumentsComplets;
  unites: string[];
  tauxTva: number[];
  metiers: string[];
  seuils: Seuils;
  notifications: { actives: boolean; destinataires: string };
}

export const REGLAGES_SOCIETE_DEFAUT: ReglagesSociete = {
  documents: {
    validiteDevisJours: 30,
    delaiPaiementJours: 30,
    modeDelaiPaiement: "net",
    tvaDefaut: 10,
    modeReglementDefaut: "virement",
    conditionsDevis: "",
    piedDePage: "",
    mentionAcceptation: "Bon pour accord — date et signature",
    mentionsComplementaires: "",
    afficherIban: true,
    couleurAccent: "#FF6A1A",
    couleurSecondaire: "#182233",
    siteWeb: "",
  },
  unites: UNITES_DEFAUT,
  tauxTva: TAUX_TVA_DEFAUT,
  metiers: [],
  seuils: SEUILS_DEFAUT,
  notifications: { actives: true, destinataires: "" },
};

type Brut = Record<string, unknown>;
const objet = (v: unknown): Brut => (v !== null && typeof v === "object" && !Array.isArray(v) ? (v as Brut) : {});
const texteOu = (v: unknown, defaut = ""): string => (v == null ? defaut : String(v));
const nombreOu = (v: unknown, defaut: number): number => {
  const x = Number(v);
  return Number.isFinite(x) ? x : defaut;
};
const booleenOu = (v: unknown, defaut: boolean): boolean => (typeof v === "boolean" ? v : defaut);
const listeOu = (v: unknown, defaut: string[]): string[] => {
  if (!Array.isArray(v)) return defaut;
  const nettoyee = v.map((x) => String(x).trim()).filter(Boolean);
  return nettoyee.length ? nettoyee : defaut;
};
const tauxOu = (v: unknown, defaut: number[]): number[] => {
  if (!Array.isArray(v)) return [...defaut];
  const propres = v.map(Number).filter((n) => Number.isFinite(n) && n >= 0);
  return propres.length ? [...new Set(propres)].sort((a, b) => a - b) : [...defaut];
};

function seuilsOu(v: unknown): Seuils {
  const b = objet(v);
  const out = { ...SEUILS_DEFAUT };
  for (const cle of Object.keys(SEUILS_DEFAUT) as CleSeuil[]) out[cle] = Math.max(0, nombreOu(b[cle], SEUILS_DEFAUT[cle]));
  return out;
}

/**
 * Des réglages complets à partir du document stocké — `fusionnerReglages` de
 * l'ancienne app, à l'identique (tests/parite/reglages.essai.ts) : un document
 * partiel, ancien ou abîmé ne doit jamais empêcher l'écran de s'ouvrir.
 */
export function fusionnerReglages(brut: unknown): ReglagesSociete {
  const r = objet(brut);
  const doc = objet(r.documents);
  const notif = objet(r.notifications);
  const d = REGLAGES_SOCIETE_DEFAUT.documents;
  return {
    documents: {
      validiteDevisJours: nombreOu(doc.validiteDevisJours, d.validiteDevisJours),
      delaiPaiementJours: nombreOu(doc.delaiPaiementJours, d.delaiPaiementJours),
      modeDelaiPaiement: texteOu(doc.modeDelaiPaiement, d.modeDelaiPaiement),
      tvaDefaut: nombreOu(doc.tvaDefaut, d.tvaDefaut),
      modeReglementDefaut: texteOu(doc.modeReglementDefaut, d.modeReglementDefaut),
      conditionsDevis: texteOu(doc.conditionsDevis, d.conditionsDevis),
      piedDePage: texteOu(doc.piedDePage, d.piedDePage),
      mentionAcceptation: texteOu(doc.mentionAcceptation, d.mentionAcceptation),
      mentionsComplementaires: texteOu(doc.mentionsComplementaires, d.mentionsComplementaires),
      afficherIban: booleenOu(doc.afficherIban, d.afficherIban),
      couleurAccent: texteOu(doc.couleurAccent, d.couleurAccent),
      couleurSecondaire: texteOu(doc.couleurSecondaire, d.couleurSecondaire),
      siteWeb: texteOu(doc.siteWeb, d.siteWeb),
    },
    unites: listeOu(r.unites, UNITES_DEFAUT),
    tauxTva: tauxOu(r.tauxTva, TAUX_TVA_DEFAUT),
    metiers: listeOu(r.metiers, []),
    seuils: seuilsOu(r.seuils),
    notifications: { actives: booleenOu(notif.actives, true), destinataires: texteOu(notif.destinataires) },
  };
}

/** Les réglages d'une ligne `societe_settings.infos_entreprise`. */
export function reglagesDepuisInfos(infosEntreprise: unknown): ReglagesSociete {
  return fusionnerReglages(objet(infosEntreprise).reglages);
}

/**
 * Le nouveau `infos_entreprise` après un enregistrement de réglages (SOC-07).
 *
 * FUSION, jamais remplacement : ce document porte aussi ce que l'ancienne app y
 * range hors réglages (logo, gérant, documents légaux…). Les clés de `reglages`
 * que ce code ne connaît pas sont conservées telles quelles.
 */
export function infosAvecReglages(infosEntreprise: unknown, reglages: ReglagesSociete): Record<string, unknown> {
  const infos = objet(infosEntreprise);
  return { ...infos, reglages: { ...objet(infos.reglages), ...reglages } };
}

/**
 * « 0 ; 5,5 ; 10 » → [0, 5.5, 10]. La virgule décimale française est admise
 * entre deux chiffres ; le reste sépare les taux. Tri et doublons sont laissés
 * à `fusionnerReglages` à la relecture : une seule règle.
 */
export function lireListeTaux(saisie: string): number[] {
  return saisie
    .replace(/(\d),(\d)/g, "$1.$2")
    .split(/[,;\s]+/)
    .map((x) => Number.parseFloat(x))
    .filter((n) => Number.isFinite(n) && n >= 0);
}

const entierPositif = (message: string) => z.coerce.number({ message }).int(message).min(0, message);

/** La saisie de l'onglet « Devis & factures » (PAR-02). */
export const schemaSaisieDocuments = z.object({
  validiteDevisJours: entierPositif("Nombre de jours entier, positif ou nul."),
  delaiPaiementJours: entierPositif("Nombre de jours entier, positif ou nul."),
  modeDelaiPaiement: z.enum(["net", "fin_de_mois"], { message: "Mode de délai inconnu." }),
  tvaDefaut: z.preprocess(
    (v) => (typeof v === "string" ? v.replace(",", ".") : v),
    z.coerce.number({ message: "Taux invalide." }).min(0, "Le taux ne peut pas être négatif.")
  ),
  tauxTva: z
    .string()
    .transform(lireListeTaux)
    .refine((l) => l.length > 0, "Indiquez au moins un taux (0 sert à l'autoliquidation)."),
  modeReglementDefaut: z.string().min(1, "Choisissez un mode de règlement."),
  mentionAcceptation: z.string(),
  conditionsDevis: z.string(),
  mentionsComplementaires: z.string(),
  piedDePage: z.string(),
  siteWeb: z.string().trim(),
  afficherIban: z.enum(["true", "false"]).transform((v) => v === "true"),
});
export type SaisieDocuments = z.infer<typeof schemaSaisieDocuments>;

export function valeursDocuments(r: ReglagesSociete): Record<keyof SaisieDocuments, string> {
  const d = r.documents;
  return {
    validiteDevisJours: String(d.validiteDevisJours),
    delaiPaiementJours: String(d.delaiPaiementJours),
    modeDelaiPaiement: d.modeDelaiPaiement === "fin_de_mois" ? "fin_de_mois" : "net",
    tvaDefaut: String(d.tvaDefaut).replace(".", ","),
    tauxTva: r.tauxTva.map((t) => String(t).replace(".", ",")).join(" ; "),
    modeReglementDefaut: d.modeReglementDefaut,
    mentionAcceptation: d.mentionAcceptation,
    conditionsDevis: d.conditionsDevis,
    mentionsComplementaires: d.mentionsComplementaires,
    piedDePage: d.piedDePage,
    siteWeb: d.siteWeb,
    afficherIban: d.afficherIban ? "true" : "false",
  };
}

export function appliquerDocuments(r: ReglagesSociete, s: SaisieDocuments): ReglagesSociete {
  const { tauxTva, ...documents } = s;
  return { ...r, tauxTva, documents: { ...r.documents, ...documents } };
}

/** Un seuil saisi : entier positif ou nul, comme `Math.max(0, n)` de l'ancien écran. */
export const schemaSeuil = z.coerce
  .number({ message: "Nombre de jours invalide." })
  .int("Nombre de jours entier.")
  .min(0, "Un seuil ne peut pas être négatif.");

export function appliquerSeuils(r: ReglagesSociete, seuils: Partial<Seuils>): ReglagesSociete {
  return { ...r, seuils: { ...r.seuils, ...seuils } };
}

export const schemaNotifications = z.object({
  actives: z.boolean(),
  destinataires: z
    .string()
    .trim()
    .refine(
      (v) => v === "" || v.split(",").every((a) => z.email().safeParse(a.trim()).success),
      "Adresses e-mail séparées par des virgules."
    ),
});

/** Couleurs de l'identité visuelle : `#RRGGBB`, ce que rend `<input type="color">`. */
export const schemaCouleur = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Couleur au format #RRGGBB.");
