import { renderPrintIntervention } from "@/modules/documents/impression/gabarit-rapport";
import type { EmetteurImprimable } from "@/modules/documents/impression/pieces";
import type { PieceImprimee } from "@/modules/documents/impression/zone";
import { CONTROLES_PAR_METIER, type MetierRapport } from "./rapport";

/** Ce que le gabarit lit d'un rapport complet (`api/rapports#RapportComplet`). */
export interface RapportAImprimer {
  rapport: {
    numero: string | null;
    date: string;
    heure: string | null;
    client_nom: string;
    interlocuteur: string | null;
    adresse: string | null;
    adresse_locataire: string | null;
    code_postal: string | null;
    ville: string | null;
    occupant: string | null;
    numero_logement: string | null;
    logement_statut: string | null;
    etage: string | null;
    metier: MetierRapport | null;
    constatations: string | null;
    preconisations: string | null;
  };
  controles: Record<string, boolean>;
  precisionAutre: string;
  photos: { url: string | null }[];
  signatureClient: string | null;
  signatureTechnicien: string | null;
}

/**
 * Le rapport tel que l'ancien gabarit le lit (`renderPrintIntervention`,
 * app.js l. 3646) et son PDF (`generateInterventionPdf` : nommé d'après le
 * numéro, « rapport » à défaut). `bcNumero` : le n° du client du bon lié,
 * vide s'il n'en a pas ; `undefined` si aucun bon n'est lié.
 */
export function pieceRapport(c: RapportAImprimer, e: EmetteurImprimable, bcNumero: string | undefined): PieceImprimee {
  const r = c.rapport;
  const html = renderPrintIntervention({
    s: e.s,
    nomSociete: e.nomSociete,
    bcNumero,
    controlesDuMetier: r.metier ? CONTROLES_PAR_METIER[r.metier].map((p) => ({ key: p.cle, label: p.libelle })) : [],
    it: {
      numero: r.numero,
      date: r.date,
      heure: r.heure,
      client: r.client_nom,
      interlocuteur: r.interlocuteur,
      adresse: r.adresse,
      adresseLocataire: r.adresse_locataire,
      codePostal: r.code_postal,
      ville: r.ville,
      occupant: r.occupant,
      numeroLogement: r.numero_logement,
      logementStatut: r.logement_statut,
      etage: r.etage,
      controles: c.controles,
      controleAutreTexte: c.precisionAutre,
      rapport: { constatations: r.constatations, preconisations: r.preconisations },
      // Une photo dont le lien n'a pu être signé ne s'imprime pas plutôt que de laisser un cadre vide.
      photos: c.photos.filter((p) => p.url).map((p) => ({ dataUrl: p.url as string })),
      signature: c.signatureClient,
      signatureTechnicien: c.signatureTechnicien,
    },
  });
  return { html, nomFichier: r.numero || "rapport", variables: e.variables };
}
