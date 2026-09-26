import type { ExtractionBC } from "./contrat";

type TypeLigne = "ligne" | "chapitre" | "commentaire";

/**
 * Ce que la lecture apporte au formulaire de bon de commande — tout ce que
 * `versSaisieBonCommande` transmettait (OCR-12, relecture 3 M2 ; parité :
 * tests/parite/ocr.essai.ts). Le formulaire reste maître : l'utilisateur relit
 * tout avant d'enregistrer, rien n'est écrit ici.
 */
export interface PreRemplissageLu {
  client_id: string | null;
  interlocuteur: string | null;
  /** Aucun numéro lu : le bon naît « Sans BC » (`sansBC = !numeroBC`). */
  mode: "normal" | "sans_bc";
  numero_bc: string | null;
  reference_chantier: string | null;
  /** La date du bon, sinon aujourd'hui. */
  date_reception: string;
  date_fin_travaux: string | null;
  adresse_locataire: string | null;
  code_postal: string | null;
  ville: string | null;
  nature_travaux: string | null;
  notes: string | null;
  logement_statut: ExtractionBC["logementStatut"];
  occupant: string | null;
  etage: string | null;
  numero_logement: string | null;
  facturation_adresse: string | null;
  facturation_code_postal: string | null;
  facturation_ville: string | null;
  montant: number | null;
  lignes: { type: TypeLigne; designation: string; quantite: number | null; unite: string | null; prix_unitaire: number | null; tva: number | null }[];
}

export function versPreRemplissage(e: ExtractionBC, clientId: string | null, aujourdhui: string): PreRemplissageLu {
  return {
    client_id: clientId,
    interlocuteur: e.interlocuteur,
    mode: e.numeroBC ? "normal" : "sans_bc",
    numero_bc: e.numeroBC,
    reference_chantier: e.referenceChantier,
    date_reception: e.dateBC ?? aujourdhui,
    date_fin_travaux: e.dateFinTravaux,
    adresse_locataire: e.adresse,
    code_postal: e.codePostal,
    ville: e.ville,
    nature_travaux: e.natureTravaux,
    notes: e.notes,
    logement_statut: e.logementStatut,
    occupant: e.occupant,
    etage: e.etage,
    numero_logement: e.numeroLogement,
    facturation_adresse: e.facturationAdresse,
    facturation_code_postal: e.facturationCodePostal,
    facturation_ville: e.facturationVille,
    montant: e.montantTotalHT,
    lignes: e.lignes.map((l) => ({ type: l.type, designation: l.designation, quantite: l.qte, unite: l.unite, prix_unitaire: l.prixUnitaire, tva: l.tva })),
  };
}
