import { z } from "zod";
import { videEnNull } from "@/lib/validation";
import { chiffres, PAYS_DEFAUT, sirenDuSiret, tvaIntracomFr, verifierIdentifiants } from "@/modules/clients/domain/identifiants";

/**
 * L'identité légale de la société : colonnes de `societes` (liste blanche
 * `CHAMPS_SOCIETE` de l'ancien `html-adapter.ts`).
 *
 * Mêmes règles que l'ancienne fiche (`src/api/regles-efacture.ts`, parité :
 * tests/parite/societe.essai.ts) : seul le MAL FORMÉ bloque l'enregistrement ;
 * ce qui MANQUE s'affiche dans le bandeau de complétude, sans rien bloquer.
 */

/** Indemnité forfaitaire pour frais de recouvrement — art. D. 441-5 c. com. */
export const INDEMNITE_RECOUVREMENT_EUR = 40;

export const REGIMES_TVA: readonly { code: string; libelle: string; sansTva?: boolean }[] = [
  { code: "reel_normal_mensuel", libelle: "Réel normal — déclaration mensuelle" },
  { code: "reel_normal_trimestriel", libelle: "Réel normal — déclaration trimestrielle" },
  { code: "reel_simplifie", libelle: "Réel simplifié (CA12)" },
  { code: "franchise_en_base", libelle: "Franchise en base", sansTva: true },
];

export const MENTION_FRANCHISE_EN_BASE = "TVA non applicable, art. 293 B du CGI";

/** Saisie, jamais déduite du régime : la correspondance relève de la DGFiP. */
export const PERIODICITES_EREPORTING: readonly { code: string; libelle: string }[] = [
  { code: "mensuel", libelle: "Mensuelle" },
  { code: "trimestriel", libelle: "Trimestrielle" },
  { code: "annuel", libelle: "Annuelle" },
];

export const SCHEMAS_ADRESSE_ELECTRONIQUE: readonly { code: string; libelle: string }[] = [
  { code: "0009", libelle: "SIRET" },
  { code: "0225", libelle: "SIREN" },
  { code: "0002", libelle: "Immatriculation légale" },
];

/** La franchise en base interdit de facturer de la TVA : seul régime qui change le document. */
export function sansTva(regimeTva: string | null | undefined): boolean {
  return REGIMES_TVA.some((r) => r.code === regimeTva && r.sansTva === true);
}

/** La ligne `societes` telle que la base la rend (colonnes d'identité seulement). */
export const schemaSociete = z.object({
  id: z.string(),
  code: z.string(),
  nom: z.string(),
  raison_sociale_legale: z.string().nullable(),
  forme_juridique: z.string().nullable(),
  siret: z.string().nullable(),
  siren: z.string().nullable(),
  tva_intracom: z.string().nullable(),
  code_naf: z.string().nullable(),
  capital_social: z.number().nullable(),
  rcs_numero: z.string().nullable(),
  rcs_ville: z.string().nullable(),
  pays_code: z.string().nullable(),
  adresse: z.string().nullable(),
  code_postal: z.string().nullable(),
  ville: z.string().nullable(),
  telephone: z.string().nullable(),
  email: z.string().nullable(),
  regime_tva: z.string().nullable(),
  ereporting_regime: z.string().nullable(),
  tva_sur_encaissements: z.boolean().nullable(),
  autoliquidation_batiment: z.boolean().nullable(),
  mention_penalites_retard: z.string().nullable(),
  indemnite_recouvrement: z.number().nullable(),
  assurance_decennale_nom: z.string().nullable(),
  assurance_decennale_police: z.string().nullable(),
  adresse_electronique_schema: z.string().nullable(),
  adresse_electronique_valeur: z.string().nullable(),
  iban: z.string().nullable(),
  bic: z.string().nullable(),
  logo_url: z.string().nullable(),
});
export type Societe = z.infer<typeof schemaSociete>;

export const COLONNES_SOCIETE = Object.keys(schemaSociete.shape).join(", ");

const texte = z.preprocess(videEnNull, z.string().trim().nullable());
const booleen = z.preprocess((v) => v === true || v === "true" || v === "on", z.boolean());
const nombrePositif = (message: string) =>
  z.preprocess(
    (v) => (typeof v === "string" ? videEnNull(v.replace(",", ".").replace(/\s/g, "")) : v),
    z.coerce.number({ message }).min(0, message).nullable()
  );

/**
 * La saisie de l'onglet Organisation. Le `nom` court (menu, sélecteur) ne se
 * modifie pas ici : l'ancienne fiche ne l'exposait pas, et c'est lui que
 * reconnaissent les utilisateurs dans le sélecteur de société.
 */
export const schemaSaisieSociete = z
  .object({
    raison_sociale_legale: texte,
    forme_juridique: texte,
    siret: texte,
    siren: texte,
    tva_intracom: z.preprocess(videEnNull, z.string().trim().toUpperCase().nullable()),
    code_naf: texte,
    capital_social: nombrePositif("Le capital social est un montant positif."),
    rcs_numero: texte,
    rcs_ville: texte,
    pays_code: z.preprocess(videEnNull, z.string().trim().toUpperCase().length(2, "Code pays sur deux lettres (FR, BE…).").nullable()),
    adresse: texte,
    code_postal: texte,
    ville: texte,
    telephone: texte,
    email: z.preprocess((v) => videEnNull(typeof v === "string" ? v.trim() : v), z.email("Adresse e-mail invalide.").nullable()),
    regime_tva: texte,
    ereporting_regime: texte,
    tva_sur_encaissements: booleen,
    autoliquidation_batiment: booleen,
    mention_penalites_retard: texte,
    indemnite_recouvrement: nombrePositif("L'indemnité de recouvrement est un montant positif."),
    assurance_decennale_nom: texte,
    assurance_decennale_police: texte,
    adresse_electronique_schema: texte,
    adresse_electronique_valeur: texte,
    iban: z.preprocess((v) => (typeof v === "string" ? videEnNull(v.replace(/\s/g, "").toUpperCase()) : v), z.string().nullable()),
    bic: z.preprocess((v) => (typeof v === "string" ? videEnNull(v.replace(/\s/g, "").toUpperCase()) : v), z.string().nullable()),
  })
  .superRefine((s, ctx) => {
    // `verifierEntite` de l'ancienne app : le mal formé bloque, l'absent jamais.
    for (const a of verifierIdentifiants(s)) ctx.addIssue({ code: "custom", path: [a.champ], message: a.libelle });
  });

export type SaisieSociete = z.infer<typeof schemaSaisieSociete>;
export type ValeursSociete = Record<keyof SaisieSociete, string>;

const t = (v: string | null | undefined) => v ?? "";

export function valeursSociete(s: Societe): ValeursSociete {
  return {
    raison_sociale_legale: t(s.raison_sociale_legale),
    forme_juridique: t(s.forme_juridique),
    siret: t(s.siret),
    siren: t(s.siren),
    tva_intracom: t(s.tva_intracom),
    code_naf: t(s.code_naf),
    capital_social: s.capital_social == null ? "" : String(s.capital_social),
    rcs_numero: t(s.rcs_numero),
    rcs_ville: t(s.rcs_ville),
    pays_code: s.pays_code ?? PAYS_DEFAUT,
    adresse: t(s.adresse),
    code_postal: t(s.code_postal),
    ville: t(s.ville),
    telephone: t(s.telephone),
    email: t(s.email),
    regime_tva: t(s.regime_tva),
    ereporting_regime: t(s.ereporting_regime),
    tva_sur_encaissements: s.tva_sur_encaissements ? "true" : "false",
    autoliquidation_batiment: s.autoliquidation_batiment ? "true" : "false",
    mention_penalites_retard: t(s.mention_penalites_retard),
    // Colonne vide : l'écran propose le défaut légal, comme l'ancienne fiche.
    indemnite_recouvrement: String(s.indemnite_recouvrement ?? INDEMNITE_RECOUVREMENT_EUR),
    assurance_decennale_nom: t(s.assurance_decennale_nom),
    assurance_decennale_police: t(s.assurance_decennale_police),
    adresse_electronique_schema: t(s.adresse_electronique_schema),
    adresse_electronique_valeur: t(s.adresse_electronique_valeur),
    iban: t(s.iban),
    bic: t(s.bic),
  };
}

/** « ∑ » de l'ancienne fiche : le n° de TVA déduit du SIREN, ou du SIRET à défaut. */
export function tvaDeduite(v: Pick<ValeursSociete, "siren" | "siret">): string | null {
  return tvaIntracomFr(chiffres(v.siren) || sirenDuSiret(v.siret) || "");
}

// ============ COMPLÉTUDE ============

export interface Manque {
  champ: string;
  libelle: string;
}

/** Les mentions attendues sur une facture de l'émetteur (noms de colonnes). */
const ATTENDUS: readonly Manque[] = [
  { champ: "raison_sociale_legale", libelle: "la raison sociale" },
  { champ: "siret", libelle: "le SIRET" },
  { champ: "tva_intracom", libelle: "le n° de TVA intracommunautaire" },
  { champ: "forme_juridique", libelle: "la forme juridique" },
  { champ: "adresse", libelle: "l'adresse" },
  { champ: "code_postal", libelle: "le code postal" },
  { champ: "ville", libelle: "la ville" },
  { champ: "adresse_electronique_valeur", libelle: "l'adresse électronique de réception" },
];

/** Capital et RCS : obligatoires pour une SOCIÉTÉ (R123-238), pas pour une entreprise individuelle. */
const ATTENDUS_SOCIETE_COMMERCIALE: readonly Manque[] = [
  { champ: "capital_social", libelle: "le capital social" },
  { champ: "rcs_numero", libelle: "le n° RCS" },
  { champ: "rcs_ville", libelle: "la ville du greffe" },
];

const RECOMMANDES: readonly Manque[] = [
  { champ: "telephone", libelle: "le téléphone" },
  { champ: "email", libelle: "l'e-mail" },
  { champ: "iban", libelle: "l'IBAN" },
  { champ: "bic", libelle: "le BIC" },
];

const FORMES_SANS_CAPITAL = [
  "EI",
  "ENTREPRISE INDIVIDUELLE",
  "EIRL",
  "AUTO-ENTREPRENEUR",
  "AUTOENTREPRENEUR",
  "MICRO-ENTREPRISE",
  "MICROENTREPRISE",
];

export function estSociete(formeJuridique?: string | null): boolean {
  const forme = (formeJuridique ?? "").trim().toUpperCase().replace(/[.\s]+/g, " ").trim();
  if (!forme) return false;
  return !FORMES_SANS_CAPITAL.includes(forme);
}

type Entite = Partial<Record<string, string | number | boolean | null>>;

const rempli = (v: unknown): boolean => v !== null && v !== undefined && String(v).trim() !== "";

const manquants = (e: Entite, attendus: readonly Manque[]) => attendus.filter((c) => !rempli(e[c.champ]));

/** Ce qui manque pour émettre une facture régulière (`completudeSociete`). */
export function completudeSociete(e: Entite): Manque[] {
  const forme = typeof e.forme_juridique === "string" ? e.forme_juridique : null;
  return manquants(e, estSociete(forme) ? [...ATTENDUS, ...ATTENDUS_SOCIETE_COMMERCIALE] : ATTENDUS);
}

/** Ce qu'un client cherchera sans que la loi l'exige (`recommandationsSociete`). */
export function recommandationsSociete(e: Entite): Manque[] {
  return manquants(e, RECOMMANDES);
}

/** Le texte du bandeau (`messageAnomalies` pour des manques). */
export function messageManques(manques: readonly Manque[]): string {
  return manques.length ? `Il manquera pour émettre : ${manques.map((m) => m.libelle).join(", ")}.` : "";
}
