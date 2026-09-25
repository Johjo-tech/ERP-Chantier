import { ajouterJours } from "@/modules/planning/domain/calendrier";
import type { CartePlanning } from "@/modules/planning/domain/cartes";
import { cartesDuJour } from "@/modules/planning/domain/filtres";

/**
 * Le tableau de bord du terrain — technicien et sous-traitant
 * (`renderDashboardTechnicien`, app.js l. 1728). Pas un euro : son travail ne
 * s'évalue pas en chiffre d'affaires, et la base lui masque les prix. Ce qu'il
 * lui faut, c'est ce qu'il a à faire aujourd'hui ; le détail vit dans « Ma
 * journée » du planning, vers lequel tout renvoie.
 */

/** Un aperçu, pas la journée entière : au-delà, « Ma journée » fait mieux le travail. */
export const JOURNEE_VISIBLE = 8;
/** « Les six prochains jours » : la semaine qui vient, aujourd'hui exclu. */
export const JOURS_A_VENIR = 6;

export interface Affectation {
  monEquipeId: string | null;
  monSousTraitantId: string | null;
}

/** Les cartes confiées à mon équipe ou à mon entreprise — sur la carte ou sur l'une de ses tâches. */
export function mesCartes(cartes: readonly CartePlanning[], a: Affectation): CartePlanning[] {
  if (!a.monEquipeId && !a.monSousTraitantId) return [];
  return cartes.filter(
    (c) =>
      (!!a.monEquipeId && (c.equipeId === a.monEquipeId || c.taches.some((t) => t.technicien_id === a.monEquipeId))) ||
      (!!a.monSousTraitantId && (c.sousTraitantId === a.monSousTraitantId || c.taches.some((t) => t.sous_traitant_id === a.monSousTraitantId)))
  );
}

const tacheFaite = (statut: string) => statut === "realisee" || statut === "validee";

export interface TableauTerrain {
  duJour: CartePlanning[];
  aVenir: CartePlanning[];
  aPointer: CartePlanning[];
  pieces: CartePlanning[];
}

/** L'heure du rendez-vous de la carte ce jour-là (le premier jour, ou une date supplémentaire). */
function heureDuJour(c: CartePlanning, jour: string): string {
  return c.rdv.datePlanifiee === jour ? (c.rdv.heurePlanifiee ?? "") : (c.suppl.find((d) => d.date === jour)?.creneau?.heure ?? "");
}

export function tableauTerrain(cartes: readonly CartePlanning[], a: Affectation, jour: string): TableauTerrain {
  // Sans équipe ni entreprise connue, l'ancien écran montrait TOUT (`mesBonsTechnicien` :
  // « mieux vaut tout montrer que rien ») — la base, elle, ne sert que ce que le rôle peut lire
  // (D-VIS-09). « Ma journée », au planning, garde sa règle : rien sans affectation.
  const miennes = !a.monEquipeId && !a.monSousTraitantId ? [...cartes] : mesCartes(cartes, a);
  const prochains = Array.from({ length: JOURS_A_VENIR }, (_, i) => ajouterJours(jour, i + 1));
  const aVenir = miennes.filter((c) => prochains.some((j) => cartesDuJour([c], j).length > 0));
  return {
    // L'heure d'abord : une journée de terrain se lit dans l'ordre où elle se vit.
    duJour: cartesDuJour(miennes, jour).sort((x, y) => heureDuJour(x, jour).localeCompare(heureDuJour(y, jour))),
    aVenir,
    // « À pointer » : le rendez-vous est passé et le terrain n'a pas tout déclaré fait.
    aPointer: miennes.filter((c) => !!c.rdv.datePlanifiee && c.rdv.datePlanifiee < jour && !(c.taches.length > 0 && c.taches.every((t) => tacheFaite(t.statut)))),
    pieces: miennes.filter((c) => c.taches.some((t) => t.piece_a_commander && !t.piece_date_commande)),
  };
}
