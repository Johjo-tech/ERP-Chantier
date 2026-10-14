/**
 * Mise en forme des pièces imprimées (devis, factures, avoirs, bons), décidée
 * avec le client et commune à la nouvelle application : mêmes données, même
 * papier.
 */
import { formaterTaux } from "./regles-totaux";

/** Les petits mots restent en minuscules, sauf en tête. */
const PETITS_MOTS = new Set(["de", "du", "des", "la", "le", "les", "et", "en", "au", "aux", "sur", "sous", "d", "l", "à", "bis", "ter"]);
/** Les sigles restent en capitales. */
const SIGLES = new Set(["za", "zi", "zac", "zae", "bp", "cs", "tsa", "cedex", "hlm", "rn", "rd", "sci", "opac", "oph"]);

/**
 * Les adresses reprises de l'ancien logiciel sont en MAJUSCULES (« 26 CHEMIN
 * DE LA DIGUE ») : le client les veut « 26 Chemin de la Digue » sur ses pièces
 * (07/10). À l'impression seulement, la donnée ne change pas. Une adresse qui
 * porte déjà une minuscule a été saisie à la main : elle reste telle quelle.
 * Les accents absents de la donnée ne sont pas devinés.
 */
export function casseAdresse<T extends string | null | undefined>(texte: T): T {
  if (!texte || /\p{Ll}/u.test(texte)) return texte;
  let premier = true;
  // Les séparateurs (espaces, tirets, apostrophes, ponctuation) sont gardés tels quels.
  return texte
    .toLocaleLowerCase("fr-FR")
    .split(/([^\p{L}\p{N}]+)/u)
    .map((morceau) => {
      if (!/[\p{L}\p{N}]/u.test(morceau)) return morceau;
      // Le numéro de la voie est le mot de tête : « 12 bis », pas « 12 Bis ».
      const enTete = premier;
      premier = false;
      if (/^\p{N}/u.test(morceau)) return morceau;
      if (SIGLES.has(morceau)) return morceau.toLocaleUpperCase("fr-FR");
      if (!enTete && PETITS_MOTS.has(morceau)) return morceau;
      return morceau.charAt(0).toLocaleUpperCase("fr-FR") + morceau.slice(1);
    })
    .join("") as T;
}

function enNombre(v: number | string | null | undefined): number {
  if (typeof v === "number") return v;
  if (v === null || v === undefined || String(v).trim() === "") return NaN;
  return Number(String(v).replace(",", "."));
}

/** La quantité d'une ligne à la française : « 2,5 », pas « 2.5 ». */
export function quantiteImprimee(q: number | string | null | undefined): string {
  const n = enNombre(q);
  return Number.isFinite(n) ? String(n).replace(".", ",") : String(q ?? "");
}

/**
 * La TVA d'une ligne à la française : « 5,5 % », pas « 5.5% ». L'espace est
 * INSÉCABLE : la colonne « % TVA » est étroite, une espace ordinaire y
 * renvoyait « % » à la ligne et chaque ligne de la pièce doublait de hauteur.
 */
export function tvaImprimee(t: number | string | null | undefined): string {
  const n = enNombre(t);
  return Number.isFinite(n) ? formaterTaux(n).replace(" %", " %") : "";
}

interface LigneAImprimer {
  type?: string | null;
  designation?: string | null;
  prixUnitaire?: number | string | null;
}

/**
 * Ce qui s'imprime d'un devis ou d'un bon : ni chapitre, ni commentaire, ni
 * ligne vide. Une ligne chiffrée sans texte mais avec un prix reste — elle
 * compte dans le total.
 */
export function lignesRemplies<L extends LigneAImprimer>(lignes: readonly L[] | null | undefined): L[] {
  return (lignes ?? []).filter(
    (l) => String(l.designation ?? "").trim() !== "" || ((l.type || "ligne") === "ligne" && (Number(l.prixUnitaire) || 0) !== 0)
  );
}
