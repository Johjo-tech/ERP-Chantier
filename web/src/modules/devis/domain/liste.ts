import { moisIso } from "@/lib/dates";
import Big from "big.js";
import { correspond } from "@/lib/recherche";
import type { StatutLogement } from "@/modules/documents/domain/logement";

/**
 * La liste des devis : filtres de l'ancien écran (DEV-01, app.js l. 4347) —
 * recherche, conducteur, logement, client, interlocuteur, statut — et le taux
 * de conversion du mois (DEV-28).
 */
export interface DevisFiltrable {
  numero: string;
  client_id: string | null;
  client_nom: string;
  interlocuteur: string | null;
  conducteur: string | null;
  conducteur_id: string | null;
  logement_statut: StatutLogement | null;
  statut: string;
  date: string;
  adresse_locataire: string | null;
  ville: string | null;
}

export interface CriteresDevis {
  recherche: string;
  statut: string;
  conducteur: string;
  logement: string;
  client: string;
  interlocuteur: string;
}

export const CRITERES_DEVIS_VIDES: CriteresDevis = { recherche: "", statut: "", conducteur: "", logement: "", client: "", interlocuteur: "" };

export function filtrerDevis<D extends DevisFiltrable>(liste: readonly D[], c: CriteresDevis): D[] {
  return liste.filter(
    (d) =>
      correspond(c.recherche, d.numero, d.client_nom, d.interlocuteur, d.conducteur, d.adresse_locataire, d.ville) &&
      (!c.statut || d.statut === c.statut) &&
      // Par la RÉFÉRENCE du conducteur : trois graphies d'un prénom ne font plus trois conducteurs.
      (!c.conducteur || d.conducteur_id === c.conducteur) &&
      (!c.logement || d.logement_statut === c.logement) &&
      (!c.client || d.client_id === c.client) &&
      (!c.interlocuteur || (d.interlocuteur ?? "") === c.interlocuteur)
  );
}

const CENT = new Big(100);

/**
 * Acceptés / devis DATÉS du mois, en pourcentage entier (`computeMonthSummary`,
 * app.js l. 1596) : 3 devis dont 1 accepté → 33. Aucun devis → 0.
 */
export function tauxConversion(liste: readonly Pick<DevisFiltrable, "date" | "statut">[], mois: string): number {
  const duMois = liste.filter((d) => moisIso(d.date) === mois);
  if (!duMois.length) return 0;
  const acceptes = duMois.filter((d) => d.statut === "accepté").length;
  return Number(new Big(acceptes).times(CENT).div(duMois.length).round(0, Big.roundHalfUp).toString());
}

/**
 * Le conducteur d'un ANCIEN devis qui n'a que son nom (DEV-26, `conducteurIdDe`,
 * app.js l. 17931) : retrouvé par nom, sans tenir compte de la casse ni des
 * espaces de bord. Sans cela, l'enregistrer effaçait le conducteur en silence.
 */
export function conducteurIdDe(d: { conducteur_id: string | null; conducteur: string | null }, conducteurs: readonly { id: string; nom: string }[]): string {
  if (d.conducteur_id) return d.conducteur_id;
  const nom = (d.conducteur ?? "").trim().toLowerCase();
  if (!nom) return "";
  return conducteurs.find((c) => c.nom.trim().toLowerCase() === nom)?.id ?? "";
}
