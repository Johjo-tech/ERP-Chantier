import { libelleMetier } from "@/modules/interventions/domain/rapport";
import type { CartePlanning } from "../domain/cartes";
import { HEURES_PLANNING } from "../domain/calendrier";
import { DUREE_MAX_H, DUREE_MIN_H } from "../domain/taches";

/** Libellés et formats partagés par les cartes et la fiche (hors composants, pour le rechargement à chaud). */
export const LIBELLES_LOGEMENT: Record<string, string> = { occupé: "Logement occupé", vacant: "Logement vacant", commune: "Partie commune" };

/** `logementBadge` : la couleur de la pastille selon le logement. */
export const CLASSE_LOGEMENT: Record<string, string> = { occupé: "warn", vacant: "success", commune: "info" };

export const DUREES = Array.from({ length: DUREE_MAX_H - DUREE_MIN_H + 1 }, (_, i) => DUREE_MIN_H + i);

/**
 * La hauteur d'une case horaire (`planningRowExpr`) : la grille tient dans la
 * hauteur de la fenêtre, moins l'en-tête. Une expression CSS, pas des pixels —
 * c'est ce qui la fait suivre la fenêtre comme dans l'ancien écran.
 */
const DECALAGE_VERTICAL_PX = 225;
export const RANGEE = `((100vh - ${DECALAGE_VERTICAL_PX}px) / ${HEURES_PLANNING.length})`;

/** Le jour laissé entre une carte posée et le trait de sa case (`+ 2px` / `- 4px` de l'ancien). */
const MARGE_CARTE_PX = 2;
export function positionCarte(indiceDebut: number, cases: number): { top: string; height: string } {
  return { top: `calc(${indiceDebut} * ${RANGEE} + ${MARGE_CARTE_PX}px)`, height: `calc(${cases} * ${RANGEE} - ${2 * MARGE_CARTE_PX}px)` };
}

/** `metierDisplayLabel` : le libellé d'un métier historique (« plomberie »), sinon le nom tel quel. */
export function libelleDuMetier(m: string | null | undefined): string {
  if (!m) return "";
  return libelleMetier(m) || m;
}

/** `withVille` : l'adresse, puis « CP Ville ». */
export function avecVille(adresse: string | null | undefined, cp: string | null | undefined, ville: string | null | undefined): string {
  return [adresse, [cp, ville].filter(Boolean).join(" ")].filter(Boolean).join(", ");
}

/** Le lieu de l'intervention : l'adresse du logement quand elle diffère de celle du client. */
export function adresseDuLieu(c: CartePlanning): string {
  const b = c.bon;
  return avecVille(b.adresse_locataire || b.adresse, b.code_postal, b.ville);
}

/** Le numéro que la carte cite (`planningItems`) : celui du client, suivi du métier sur un bon multi-métiers. */
export function numeroDeLaCarte(c: CartePlanning): string {
  const n = c.bon.numero_bc ?? "";
  return c.metierKey ? `${n} (${libelleDuMetier(c.metierKey)})` : n;
}
