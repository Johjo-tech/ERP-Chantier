import type { ExtractionBC } from "./contrat";

/**
 * Ce que la lecture apporte au formulaire de bon de commande. Le formulaire
 * reste maître : l'utilisateur relit tout avant d'enregistrer.
 */
export interface PreRemplissageLu {
  client_id: string | null;
  numero_bc: string | null;
  reference_chantier: string | null;
  date_reception: string | null;
  date_fin_travaux: string | null;
  adresse_locataire: string | null;
  code_postal: string | null;
  ville: string | null;
  nature_travaux: string | null;
  lignes: { type: "ligne" | "chapitre" | "commentaire"; designation: string; quantite: number | null; unite: string | null; prix_unitaire: number | null }[];
}

export function versPreRemplissage(e: ExtractionBC, clientId: string | null): PreRemplissageLu {
  return {
    client_id: clientId,
    numero_bc: e.numeroBC,
    reference_chantier: e.referenceChantier,
    date_reception: e.dateBC,
    date_fin_travaux: e.dateFinTravaux,
    adresse_locataire: e.adresse,
    code_postal: e.codePostal,
    ville: e.ville,
    nature_travaux: e.natureTravaux,
    lignes: e.lignes
      .filter((l) => l.designation !== "")
      .map((l) => ({ type: l.type, designation: l.designation, quantite: l.qte, unite: l.unite, prix_unitaire: l.prixUnitaire })),
  };
}
