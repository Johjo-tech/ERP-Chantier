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

/** Replié d'office sur un écran large — jamais quand l'utilisateur l'a épinglé. */
export function replieAutomatiquement(chemin: string, epingle: boolean): boolean {
  return !epingle && ECRANS_LARGES.some((e) => chemin === e || chemin.startsWith(`${e}/`));
}
