import { z } from "zod";
import { videEnNull } from "@/lib/validation";
import type { LigneBase } from "@/modules/documents/domain/lignes";
import { nettoyerLogement } from "@/modules/documents/domain/logement";

export const TYPES_DOCUMENT = ["facture", "avoir", "acompte", "note_frais"] as const;
export type TypeDocument = (typeof TYPES_DOCUMENT)[number];
export const STATUTS_FACTURE = ["brouillon", "impayée", "envoyée", "payée"] as const;
export type StatutFacture = (typeof STATUTS_FACTURE)[number];

const statutLogement = z.enum(["occupé", "vacant", "commune"]).nullable();
const modePaiement = z.enum(["virement", "cheque", "especes", "carte", "prelevement", "traite", "autre"]);

export const schemaEnteteFacture = z.object({
  id: z.string(),
  societe_id: z.string(),
  numero: z.string().nullable(),
  type_document: z.enum(TYPES_DOCUMENT),
  statut: z.enum(STATUTS_FACTURE),
  verrouillee: z.boolean(),
  legacy_id: z.string().nullable(),
  client_id: z.string().nullable(),
  client_nom: z.string(),
  interlocuteur: z.string().nullable(),
  chantier_id: z.string().nullable(),
  devis_id: z.string().nullable(),
  bon_commande_id: z.string().nullable(),
  facture_rectifiee_id: z.string().nullable(),
  motif_rectification: z.string().nullable(),
  adresse: z.string().nullable(),
  adresse_locataire: z.string().nullable(),
  code_postal: z.string().nullable(),
  ville: z.string().nullable(),
  logement_statut: statutLogement,
  occupant: z.string().nullable(),
  etage: z.string().nullable(),
  numero_logement: z.string().nullable(),
  precision_commune: z.string().nullable(),
  ancien_locataire: z.string().nullable(),
  date: z.string(),
  echeance: z.string().nullable(),
  date_fin_execution: z.string().nullable(),
  remise_pourcentage: z.number(),
  acomptes_deduits: z.number(),
  retenue_garantie_pourcentage: z.number().nullable(),
  delai_paiement_jours: z.number().int().nullable(),
  delai_paiement_mode: z.enum(["net", "fin_de_mois"]).nullable(),
  conditions_reglement: z.string().nullable(),
  mode_paiement: modePaiement.nullable(),
  ref_marche: z.string().nullable(),
  ref_bon_commande_client: z.string().nullable(),
  cadre_facturation: z.enum(["B2C", "B2B_national", "B2G", "B2B_international"]),
  conducteur_id: z.string().nullable(),
  conducteur: z.string().nullable(),
  emetteur_nom: z.string().nullable(),
  emetteur_adresse: z.string().nullable(),
  emetteur_code_postal: z.string().nullable(),
  emetteur_ville: z.string().nullable(),
  emetteur_siret: z.string().nullable(),
  emetteur_tva_intracom: z.string().nullable(),
  emetteur_iban: z.string().nullable(),
  // Recopiés tels quels sur un avoir : il est émis aussitôt, une omission serait définitive.
  emetteur_siren: z.string().nullable(),
  emetteur_pays_code: z.string().nullable(),
  tva_categorie: z.enum(["S", "Z", "E", "AE", "K", "G", "O"]).nullable(),
  tva_motif_exoneration: z.string().nullable(),
  ref_contrat: z.string().nullable(),
  devise: z.string(),
  intervention_id: z.string().nullable(),
});
export type EnteteFacture = z.infer<typeof schemaEnteteFacture>;

export const schemaLigneFacture = z.object({
  id: z.string(),
  position: z.number(),
  type: z.enum(["ligne", "chapitre", "commentaire"]),
  designation: z.string(),
  quantite: z.number(),
  prix_unitaire: z.number(),
  unite: z.string().nullable(),
  tva: z.number(),
  article_reference: z.string().nullable(),
  commentaire: z.string().nullable(),
  metier: z.string().nullable(),
}) satisfies z.ZodType<LigneBase & { position: number }>;

export interface Facture extends EnteteFacture {
  lignes: z.infer<typeof schemaLigneFacture>[];
}

const texte = z.preprocess(videEnNull, z.string().trim().nullable());
const date = z.preprocess(videEnNull, z.iso.date({ message: "Date invalide." }).nullable());

/** La saisie d'une facture BROUILLON (une facture émise ne se modifie plus). */
export const schemaSaisieFacture = z.object({
  client_id: z.string().min(1, "Choisissez un client."),
  interlocuteur: texte,
  chantier_id: texte,
  date: z.iso.date({ message: "Date invalide." }),
  conducteur_id: texte,
  remise_pourcentage: z.string(),
  echeance: date,
  echeance_manuelle: z.enum(["oui", "non"]),
  date_fin_execution: date,
  ref_marche: texte,
  ref_bon_commande_client: texte,
  mode_paiement: z.preprocess(videEnNull, modePaiement.nullable()),
  adresse_locataire: texte,
  code_postal: texte,
  ville: texte,
  telephone_locataire: texte,
  logement_statut: z.preprocess(videEnNull, statutLogement),
  occupant: texte,
  etage: texte,
  numero_logement: texte,
  precision_commune: texte,
  ancien_locataire: texte,
});
export type SaisieFacture = z.infer<typeof schemaSaisieFacture>;
export type ValeursFacture = Record<keyof SaisieFacture, string>;

export function valeursDepuis(f: Facture | null, aujourdhui: string): ValeursFacture {
  return {
    client_id: f?.client_id ?? "",
    interlocuteur: f?.interlocuteur ?? "",
    chantier_id: f?.chantier_id ?? "",
    date: f?.date ?? aujourdhui,
    conducteur_id: f?.conducteur_id ?? "",
    remise_pourcentage: String(f?.remise_pourcentage ?? 0).replace(".", ","),
    echeance: f?.echeance ?? "",
    // Une échéance déjà posée sur un brouillon est tenue pour saisie : on ne la recalcule pas en douce.
    echeance_manuelle: f?.echeance ? "oui" : "non",
    date_fin_execution: f?.date_fin_execution ?? "",
    ref_marche: f?.ref_marche ?? "",
    ref_bon_commande_client: f?.ref_bon_commande_client ?? "",
    mode_paiement: f?.mode_paiement ?? "",
    adresse_locataire: f?.adresse_locataire ?? "",
    code_postal: f?.code_postal ?? "",
    ville: f?.ville ?? "",
    telephone_locataire: "",
    logement_statut: f?.logement_statut ?? "",
    occupant: f?.occupant ?? "",
    etage: f?.etage ?? "",
    numero_logement: f?.numero_logement ?? "",
    precision_commune: f?.precision_commune ?? "",
    ancien_locataire: f?.ancien_locataire ?? "",
  };
}

/** Ce que l'écran écrit dans `factures` pour un brouillon. */
export interface EnteteAEnregistrer {
  client_id: string;
  client_nom: string;
  adresse: string | null;
  cadre_facturation: EnteteFacture["cadre_facturation"];
  interlocuteur: string | null;
  chantier_id: string | null;
  date: string;
  echeance: string | null;
  date_fin_execution: string | null;
  conducteur_id: string | null;
  remise_pourcentage: number;
  delai_paiement_jours: number;
  delai_paiement_mode: "net" | "fin_de_mois";
  conditions_reglement: string;
  mode_paiement: EnteteFacture["mode_paiement"];
  ref_marche: string | null;
  ref_bon_commande_client: string | null;
  adresse_locataire: string | null;
  code_postal: string | null;
  ville: string | null;
  logement_statut: EnteteFacture["logement_statut"];
  occupant: string | null;
  etage: string | null;
  numero_logement: string | null;
  precision_commune: string | null;
  ancien_locataire: string | null;
}

export function enteteAEnregistrer(
  s: SaisieFacture,
  client: { nom: string; adresse: string | null; cadre_facturation: EnteteFacture["cadre_facturation"] | null },
  remise: number,
  delai: { jours: number; mode: "net" | "fin_de_mois" },
  conditions: string,
  echeance: string | null
): EnteteAEnregistrer {
  const { remise_pourcentage: _r, echeance_manuelle: _m, telephone_locataire: _t, echeance: _e, ...reste } = s;
  return nettoyerLogement({
    ...reste,
    client_nom: client.nom,
    adresse: client.adresse,
    cadre_facturation: client.cadre_facturation ?? "B2B_national",
    remise_pourcentage: remise,
    delai_paiement_jours: delai.jours,
    delai_paiement_mode: delai.mode,
    conditions_reglement: conditions,
    echeance,
  });
}
