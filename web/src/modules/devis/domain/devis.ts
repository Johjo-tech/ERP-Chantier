import { z } from "zod";
import { videEnNull } from "@/lib/validation";
import type { LigneBase } from "@/modules/documents/domain/lignes";
import { nettoyerLogement } from "@/modules/documents/domain/logement";

export const STATUTS_DEVIS = ["brouillon", "envoyé", "accepté", "refusé"] as const;
export type StatutDevis = (typeof STATUTS_DEVIS)[number];

export const LIBELLES_STATUT: Record<StatutDevis, string> = {
  brouillon: "Brouillon",
  envoyé: "Envoyé",
  accepté: "Accepté",
  refusé: "Refusé",
};

const statutLogement = z.enum(["occupé", "vacant", "commune"]).nullable();

export const schemaEnteteDevis = z.object({
  id: z.string(),
  societe_id: z.string(),
  numero: z.string(),
  client_id: z.string().nullable(),
  client_nom: z.string(),
  interlocuteur: z.string().nullable(),
  chantier_id: z.string().nullable(),
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
  telephone_locataire: z.string().nullable(),
  date: z.string(),
  remise_pourcentage: z.number(),
  statut: z.enum(STATUTS_DEVIS),
  conducteur_id: z.string().nullable(),
  conducteur: z.string().nullable(),
});
export type EnteteDevis = z.infer<typeof schemaEnteteDevis>;

export const schemaLigneDevis = z.object({
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

export interface Devis extends EnteteDevis {
  lignes: z.infer<typeof schemaLigneDevis>[];
}

const texte = z.preprocess(videEnNull, z.string().trim().nullable());

/** L'en-tête saisi. Le client est obligatoire (comme dans l'ancien formulaire). */
export const schemaSaisieDevis = z.object({
  client_id: z.string().min(1, "Choisissez un client."),
  interlocuteur: texte,
  chantier_id: texte,
  date: z.iso.date({ message: "Date invalide." }),
  conducteur_id: texte,
  statut: z.enum(STATUTS_DEVIS),
  remise_pourcentage: z.string(),
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
export type SaisieDevis = z.infer<typeof schemaSaisieDevis>;
export type ValeursDevis = Record<keyof SaisieDevis, string>;

export function valeursDepuis(d: Devis | null, aujourdhui: string, chantierId = "", clientId = ""): ValeursDevis {
  return {
    client_id: d?.client_id ?? clientId,
    interlocuteur: d?.interlocuteur ?? "",
    chantier_id: d?.chantier_id ?? chantierId,
    date: d?.date ?? aujourdhui,
    conducteur_id: d?.conducteur_id ?? "",
    statut: d?.statut ?? "brouillon",
    remise_pourcentage: String(d?.remise_pourcentage ?? 0).replace(".", ","),
    adresse_locataire: d?.adresse_locataire ?? "",
    code_postal: d?.code_postal ?? "",
    ville: d?.ville ?? "",
    telephone_locataire: d?.telephone_locataire ?? "",
    logement_statut: d?.logement_statut ?? "",
    occupant: d?.occupant ?? "",
    etage: d?.etage ?? "",
    numero_logement: d?.numero_logement ?? "",
    precision_commune: d?.precision_commune ?? "",
    ancien_locataire: d?.ancien_locataire ?? "",
  };
}

export interface EnteteAEnregistrer {
  client_id: string;
  client_nom: string;
  adresse: string | null;
  interlocuteur: string | null;
  chantier_id: string | null;
  date: string;
  conducteur_id: string | null;
  statut: StatutDevis;
  remise_pourcentage: number;
  adresse_locataire: string | null;
  code_postal: string | null;
  ville: string | null;
  telephone_locataire: string | null;
  logement_statut: EnteteDevis["logement_statut"];
  occupant: string | null;
  etage: string | null;
  numero_logement: string | null;
  precision_commune: string | null;
  ancien_locataire: string | null;
}

/**
 * L'en-tête à écrire, depuis la saisie validée.
 * L'adresse du devis est celle du CLIENT (siège) ; le lieu d'intervention vit
 * dans adresse_locataire / code postal / ville — comme l'ancien saveDevis.
 */
export function enteteAEnregistrer(
  s: SaisieDevis,
  client: { nom: string; adresse: string | null },
  remise: number
): EnteteAEnregistrer {
  const { remise_pourcentage: _saisie, ...reste } = s;
  return nettoyerLogement({ ...reste, client_nom: client.nom, adresse: client.adresse, remise_pourcentage: remise });
}
