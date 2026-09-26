import { lirePreference, ecrirePreference } from "@/lib/stockage";

/**
 * Le menu épinglé (TRV-11, `menuEpingle`, app.js l. 1267) : une préférence
 * d'affichage propre à ce navigateur, sous la même clé que l'ancien écran —
 * qui l'avait réglée la retrouve. Un stockage refusé ramène au comportement
 * d'origine (menu qui se replie), jamais à une erreur.
 */
export const CLE_MENU_EPINGLE = "erp.menu.epingle";

/** Les écrans qui reprennent la largeur du menu (l'ancien planning le masquait). */
const ECRANS_LARGES = ["/planning"];

export function lireMenuEpingle(): boolean {
  return lirePreference(CLE_MENU_EPINGLE) === "1";
}

export function ecrireMenuEpingle(epingle: boolean): void {
  ecrirePreference(CLE_MENU_EPINGLE, epingle ? "1" : "0");
}

/** L'écran du planning, qui masque le menu par une règle à lui (`is-planning-view`). */
export function estEcranLarge(chemin: string): boolean {
  return ECRANS_LARGES.some((e) => chemin === e || chemin.startsWith(`${e}/`));
}

/** Replié d'office sur un écran large — jamais quand l'utilisateur l'a épinglé. */
export function replieAutomatiquement(chemin: string, epingle: boolean): boolean {
  return !epingle && estEcranLarge(chemin);
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * L'adresse ouvre-t-elle un formulaire ? L'ancien `openForm` refermait le menu
 * à chaque ouverture de formulaire (création, fiche d'un document) pour rendre
 * la largeur à la saisie ; ici, un formulaire est une adresse — « nouveau »,
 * « modifier », ou la fiche d'un document désigné par son identifiant.
 */
export function ouvreUnFormulaire(chemin: string): boolean {
  const segments = chemin.split("/").filter(Boolean);
  return segments.some((s) => s === "nouveau" || s === "nouvelle" || s === "modifier" || UUID.test(s));
}
