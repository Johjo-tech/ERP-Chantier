import { z } from "zod";
import { PAYS_DEFAUT, sirenDuSiret } from "./identifiants";

/**
 * Ce que la fiche client prête aux documents.
 *
 * `identiteClientDocument` (CLI-26, `rattacherClient` de l'ancien pont) : à
 * l'écriture d'une facture, l'identité de l'acheteur est RECOPIÉE depuis sa
 * fiche — SIRET, SIREN, TVA, pays, code service, code de routage et cadre de
 * facturation. Une facture dit ce que l'acheteur était le jour où on l'a
 * écrite ; la fiche peut changer ensuite. Seule la table `factures` porte ces
 * colonnes (devis, bons et rapports n'ont que `client_id` et `client_nom`).
 */
export const schemaIdentiteFiche = z.object({
  siret: z.string().nullable(),
  siren: z.string().nullable(),
  tva_intracom: z.string().nullable(),
  pays_code: z.string().nullable(),
  code_service: z.string().nullable(),
  code_routage: z.string().nullable(),
  cadre_facturation: z.enum(["B2C", "B2B_national", "B2G", "B2B_international"]).nullable(),
});
export type IdentiteFiche = z.infer<typeof schemaIdentiteFiche>;
export const COLONNES_IDENTITE_FICHE = Object.keys(schemaIdentiteFiche.shape).join(", ");

export interface IdentiteClientDocument {
  client_siret: string | null;
  client_siren: string | null;
  client_tva_intracom: string | null;
  client_pays_code: string;
  client_code_routage: string | null;
  client_code_service: string | null;
  cadre_facturation?: NonNullable<IdentiteFiche["cadre_facturation"]>;
}

/**
 * Le SIREN se déduit du SIRET quand la fiche ne le porte pas, le pays prend
 * le défaut français ; le cadre n'est écrit que s'il est connu — la colonne
 * est NOT NULL, une fiche sans cadre ne l'efface pas.
 */
export function identiteClientDocument(c: IdentiteFiche): IdentiteClientDocument {
  return {
    client_siret: c.siret,
    client_siren: c.siren ?? sirenDuSiret(c.siret),
    client_tva_intracom: c.tva_intracom,
    client_pays_code: c.pays_code ?? PAYS_DEFAUT,
    client_code_routage: c.code_routage,
    client_code_service: c.code_service,
    ...(c.cadre_facturation ? { cadre_facturation: c.cadre_facturation } : {}),
  };
}

/**
 * La lecture légère des clients pour le RAPPROCHEMENT (CLI-32,
 * `clientsRapprochables`) : ce qu'un import ou l'OCR compare — nom, SIRET,
 * SIREN — et ce qu'il reprend — cadre, délai de paiement. Sans les adresses,
 * contacts et interlocuteurs de la liste complète.
 */
export const schemaClientRapprochable = z.object({
  id: z.string(),
  nom: z.string(),
  siret: z.string().nullable(),
  siren: z.string().nullable(),
  cadre_facturation: z.enum(["B2C", "B2B_national", "B2G", "B2B_international"]).nullable(),
  delai_paiement_jours: z.number().int().nullable(),
  delai_paiement_mode: z.enum(["net", "fin_de_mois"]).nullable(),
});
export type ClientRapprochable = z.infer<typeof schemaClientRapprochable>;
export const COLONNES_RAPPROCHABLES = Object.keys(schemaClientRapprochable.shape).join(", ");
