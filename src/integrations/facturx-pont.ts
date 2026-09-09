/**
 * Le PDF téléchargé devient une facture électronique.
 *
 * L'application historique fabrique déjà son PDF ; ce pont l'intercepte juste
 * avant la remise, y embarque la facture structurée, et rend le fichier
 * enrichi. Le geste de l'utilisateur ne change pas — c'est le fichier qui n'est
 * plus le même.
 *
 * **Un échec ici ne doit jamais priver quelqu'un de sa facture.** Si les
 * données ne permettent pas d'émettre — client sans SIRET, société sans SIREN —
 * le PDF ordinaire part quand même, et le motif est tracé. Refuser le
 * téléchargement pour un champ manquant serait pire que le manque.
 */

import { etatPlateforme, preparerEmission, transmettreFacture } from "@/api/operations/efacture";
import { versCII } from "@/api/regles-cii";
import type { Uuid } from "@/api/types";
import { pdfFacturX } from "./facturx";

export interface ResultatFacturX {
  fichier: Blob;
  /** Vrai si la facture structurée a bien été embarquée. */
  structuree: boolean;
  /** Ce qui a empêché de le faire, en clair. */
  manques: string[];
}

/**
 * Enrichit le PDF d'une facture. Rend toujours un fichier remettable.
 */
export async function enrichirFactureX(
  pdf: Blob,
  factureId: Uuid
): Promise<ResultatFacturX> {
  try {
    const { charge, manques } = await preparerEmission(factureId);

    if (manques.length) {
      // Une facture incomplète n'est pas une facture électronique : on ne
      // l'habille pas d'un XML qui serait rejeté, on le dit.
      return { fichier: pdf, structuree: false, manques: manques.map((m) => m.libelle) };
    }

    const en = charge.en_invoice;
    const fichier = await pdfFacturX(pdf, versCII(charge), {
      numero: String(en.number),
      date: String(en.issue_date),
      emetteur: en.seller?.name ?? null,
    });
    return { fichier, structuree: true, manques: [] };
  } catch (err) {
    console.error("Facture électronique non embarquée", err);
    return {
      fichier: pdf,
      structuree: false,
      manques: [err instanceof Error ? err.message : "erreur inconnue"],
    };
  }
}

/**
 * Transmet la facture, et rend un message prêt à afficher.
 *
 * L'écran n'a pas à connaître les codes de la norme : un manque `BT-49` ne dit
 * rien à qui doit corriger une fiche client. On rend la phrase.
 */
export async function transmettre(factureId: Uuid): Promise<{
  depose: boolean;
  message: string;
}> {
  try {
    const { depose, identifiant, manques } = await transmettreFacture(factureId);
    if (depose) {
      return { depose: true, message: `Facture déposée sur la plateforme (${identifiant}).` };
    }
    return {
      depose: false,
      message: `Transmission impossible : ${manques.map((m) => m.libelle).join(" ")}`,
    };
  } catch (err) {
    return {
      depose: false,
      message: err instanceof Error ? err.message : "Transmission impossible.",
    };
  }
}

/** Ce que l'écran peut dire de la connexion, sans jamais voir un jeton. */
export async function etatConnexionPdp(societeId: Uuid) {
  return etatPlateforme(societeId);
}
