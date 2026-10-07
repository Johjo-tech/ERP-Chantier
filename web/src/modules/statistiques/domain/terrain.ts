import { ajouterJours } from "@/modules/planning/domain/calendrier";
import { metiersDuBon, type CartePlanning } from "@/modules/planning/domain/cartes";
import { cartesDuJour } from "@/modules/planning/domain/filtres";

/**
 * Le tableau de bord du terrain — technicien et sous-traitant, dans la forme
 * de `renderDashboardTechnicien` (mêmes tuiles, même liste du jour). Pas un
 * euro : la base lui masque les prix. Corrigé (D-STA-B-01) : il se lit sur
 * les CARTES du planning, comme « Ma journée » — une journée supplémentaire
 * aujourd'hui compte, une tâche confiée à mon équipe sur le bon d'une autre
 * aussi (DEF-STA-13) — et le sous-traitant, reconnu par son compte, reçoit ce
 * même tableau à la place de tuiles de devis et de factures qui n'existent
 * pas (DEF-STA-14, D-STA-09).
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

/**
 * « À pointer », règle de l'ancien (`renderDashboardTechnicien`), sur la
 * carte : le rendez-vous est passé et un de ses métiers n'est pas déclaré
 * fait — la DERNIÈRE tâche lue d'un métier décide, comme `metiersFait` — ou
 * elle n'a aucun métier.
 */
function aPointer(c: CartePlanning, jour: string): boolean {
  if (!c.rdv.datePlanifiee || c.rdv.datePlanifiee >= jour) return false;
  const metiers = c.metierKey ? [c.metierKey] : metiersDuBon(c.bon);
  const faits: Record<string, boolean> = {};
  for (const t of c.taches) if (t.metier) faits[t.metier] = tacheFaite(t.statut);
  return !metiers.length || metiers.some((m) => !faits[m]);
}

/** Pièce en attente, règle de l'ancien (`etatPieceDuBon`) : la PREMIÈRE tâche qui attend une pièce dit si elle est commandée. */
function pieceEnAttente(c: CartePlanning): boolean {
  const t = c.taches.find((x) => x.piece_a_commander);
  return !!t && !t.piece_date_commande;
}

export interface TableauTerrain {
  duJour: CartePlanning[];
  aVenir: CartePlanning[];
  aPointer: CartePlanning[];
  pieces: CartePlanning[];
}

/** Une carte sans heure passe après les autres, comme l'ancien (« 99:99 »). */
const SANS_HEURE = "99:99";

/** L'heure du rendez-vous de la carte ce jour-là (le premier jour, ou une date supplémentaire). */
function heureDuJour(c: CartePlanning, jour: string): string {
  return (c.rdv.datePlanifiee === jour ? c.rdv.heurePlanifiee : c.suppl.find((d) => d.date === jour)?.creneau?.heure) || SANS_HEURE;
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
    aPointer: miennes.filter((c) => aPointer(c, jour)),
    pieces: miennes.filter(pieceEnAttente),
  };
}
