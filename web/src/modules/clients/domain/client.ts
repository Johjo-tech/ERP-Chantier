import { z } from "zod";
import type { Database } from "@/lib/database.types";
import { videEnNull } from "@/lib/validation";
import { verifierIdentifiants } from "./identifiants";

type Enums = Database["public"]["Enums"];
export type CadreFacturation = Enums["cadre_facturation"];
export type ModePaiement = Enums["mode_paiement"];

export const CADRES_FACTURATION: readonly { code: CadreFacturation; libelle: string }[] = [
  { code: "B2C", libelle: "Particulier" },
  { code: "B2B_national", libelle: "Entreprise française" },
  { code: "B2G", libelle: "Administration ou collectivité" },
  { code: "B2B_international", libelle: "Entreprise étrangère" },
];
export const CADRE_DEFAUT: CadreFacturation = "B2B_national";

const texte = z.preprocess(videEnNull, z.string().trim().nullable());

/** Une fiche client telle que la base la rend. */
export const schemaClient = z.object({
  id: z.string(),
  societe_id: z.string(),
  nom: z.string(),
  cadre_facturation: z.enum(["B2C", "B2B_national", "B2G", "B2B_international"]).nullable(),
  siret: z.string().nullable(),
  siren: z.string().nullable(),
  tva_intracom: z.string().nullable(),
  pays_code: z.string().nullable(),
  adresse: z.string().nullable(),
  code_postal: z.string().nullable(),
  ville: z.string().nullable(),
  email: z.string().nullable(),
  telephone: z.string().nullable(),
  contact_nom: z.string().nullable(),
  facturation_adresse: z.string().nullable(),
  facturation_code_postal: z.string().nullable(),
  facturation_ville: z.string().nullable(),
  delai_paiement_jours: z.number().int().nullable(),
  delai_paiement_mode: z.enum(["net", "fin_de_mois"]).nullable(),
  mode_paiement: z.enum(["virement", "cheque", "especes", "carte", "prelevement", "traite", "autre"]).nullable(),
  code_service: z.string().nullable(),
  code_routage: z.string().nullable(),
  reference_engagement: z.string().nullable(),
  numero_marche: z.string().nullable(),
  reference_acheteur: z.string().nullable(),
  adresse_electronique_schema: z.string().nullable(),
  adresse_electronique_valeur: z.string().nullable(),
  livraison_adresse: z.string().nullable(),
  livraison_code_postal: z.string().nullable(),
  livraison_ville: z.string().nullable(),
  contact_telephone: z.string().nullable(),
  contact_email: z.string().nullable(),
  notes: z.string().nullable(),
});
export type Client = z.infer<typeof schemaClient>;

/**
 * La saisie du formulaire, validée avant tout envoi.
 * Seul le MAL FORMÉ est refusé : un client sans SIRET reste enregistrable.
 */
export const schemaSaisieClient = z
  .object({
    nom: z.string().trim().min(1, "Le nom du client est obligatoire."),
    cadre_facturation: z.enum(["B2C", "B2B_national", "B2G", "B2B_international"]),
    siret: texte,
    siren: texte,
    tva_intracom: z.preprocess(videEnNull, z.string().trim().toUpperCase().nullable()),
    pays_code: z.preprocess(videEnNull, z.string().trim().toUpperCase().length(2, "Code pays sur deux lettres (FR, BE…).").nullable()),
    adresse: texte,
    code_postal: texte,
    ville: texte,
    email: z.preprocess((v) => videEnNull(typeof v === "string" ? v.trim() : v), z.email("Adresse e-mail invalide.").nullable()),
    telephone: texte,
    contact_nom: texte,
    facturation_adresse: texte,
    facturation_code_postal: texte,
    facturation_ville: texte,
    delai_paiement_jours: z.preprocess(
      videEnNull,
      z.coerce
        .number({ message: "Nombre de jours invalide." })
        .int("Nombre de jours entier.")
        .min(0, "Le délai ne peut pas être négatif.")
        .max(365, "365 jours au plus.")
        .nullable()
    ),
    delai_paiement_mode: z.enum(["net", "fin_de_mois"]),
    // `traite` et `autre` ne se proposent plus mais existent en base : une fiche qui les porte reste enregistrable.
    mode_paiement: z.preprocess(
      videEnNull,
      z.enum(["virement", "cheque", "especes", "carte", "prelevement", "traite", "autre"], { message: "Mode de paiement inconnu." }).nullable()
    ),
    code_service: texte,
    code_routage: texte,
    reference_engagement: texte,
    numero_marche: texte,
    reference_acheteur: texte,
    adresse_electronique_schema: texte,
    adresse_electronique_valeur: texte,
    livraison_adresse: texte,
    livraison_code_postal: texte,
    livraison_ville: texte,
    contact_telephone: texte,
    contact_email: z.preprocess((v) => videEnNull(typeof v === "string" ? v.trim() : v), z.email("Adresse e-mail invalide.").nullable()),
    notes: texte,
  })
  .superRefine((c, ctx) => {
    // Un particulier n'a ni SIRET ni TVA à l'écran : des valeurs anciennes cachées ne bloquent pas.
    if (c.cadre_facturation === "B2C") return;
    for (const a of verifierIdentifiants(c)) {
      ctx.addIssue({ code: "custom", path: [a.champ], message: a.libelle });
    }
  });

export type SaisieClient = z.infer<typeof schemaSaisieClient>;
export type SaisieClientBrute = z.input<typeof schemaSaisieClient>;

/** Valeurs du formulaire pour une fiche existante (ou vierge). */
export function saisieDepuis(c: Client | null): Record<keyof SaisieClient, string> {
  return {
    nom: c?.nom ?? "",
    cadre_facturation: c?.cadre_facturation ?? CADRE_DEFAUT,
    siret: c?.siret ?? "",
    siren: c?.siren ?? "",
    tva_intracom: c?.tva_intracom ?? "",
    pays_code: c?.pays_code ?? "FR",
    adresse: c?.adresse ?? "",
    code_postal: c?.code_postal ?? "",
    ville: c?.ville ?? "",
    email: c?.email ?? "",
    telephone: c?.telephone ?? "",
    contact_nom: c?.contact_nom ?? "",
    facturation_adresse: c?.facturation_adresse ?? "",
    facturation_code_postal: c?.facturation_code_postal ?? "",
    facturation_ville: c?.facturation_ville ?? "",
    delai_paiement_jours: c?.delai_paiement_jours == null ? "" : String(c.delai_paiement_jours),
    delai_paiement_mode: c?.delai_paiement_mode ?? "net",
    mode_paiement: c?.mode_paiement ?? "",
    code_service: c?.code_service ?? "",
    code_routage: c?.code_routage ?? "",
    reference_engagement: c?.reference_engagement ?? "",
    numero_marche: c?.numero_marche ?? "",
    reference_acheteur: c?.reference_acheteur ?? "",
    adresse_electronique_schema: c?.adresse_electronique_schema ?? "",
    adresse_electronique_valeur: c?.adresse_electronique_valeur ?? "",
    livraison_adresse: c?.livraison_adresse ?? "",
    livraison_code_postal: c?.livraison_code_postal ?? "",
    livraison_ville: c?.livraison_ville ?? "",
    contact_telephone: c?.contact_telephone ?? "",
    contact_email: c?.contact_email ?? "",
    notes: c?.notes ?? "",
  };
}

export function libelleCadre(c: CadreFacturation | null): string {
  return CADRES_FACTURATION.find((x) => x.code === c)?.libelle ?? "Entreprise française";
}

/** La question avant suppression, qui dit ce que la fiche emporte (CLI-51). */
export function questionSuppression(u: { devis: number; factures: number; bons: number; chantiers: number } | undefined): string {
  if (!u) return "Supprimer définitivement ce client ?";
  const cites = [
    u.devis && `${u.devis} devis`,
    u.factures && `${u.factures} facture(s)`,
    u.bons && `${u.bons} bon(s) de commande`,
    u.chantiers && `${u.chantiers} chantier(s)`,
  ].filter(Boolean);
  if (!cites.length) return "Supprimer définitivement ce client ?";
  return `Ce client est cité par ${cites.join(", ")} : ces pièces garderont son nom mais perdront le lien à la fiche. Supprimer quand même ?`;
}
