import type { Constats } from "../api/planning";
import { toutesLesJournees, type CartePlanning, type TachePlanning } from "../domain/cartes";

/** Les constats d'une tâche, tels que la fiche les reprend à l'ouverture. */
export function constatsInitiaux(t: TachePlanning | null): Constats {
  return { commentaire: t?.commentaire ?? "", pieceACommander: !!t?.piece_a_commander, pieceDescription: t?.piece_description ?? "", croquis: t?.croquis ?? null };
}

/** Le jour ouvert est-il une journée supplémentaire ? Sinon c'est la date du rendez-vous (`openTechnicienInterventionModal`). */
export function journeeSupplementaire(carte: CartePlanning, jour: string | null): string | null {
  return jour && carte.suppl.some((d) => d.date === jour) && jour !== carte.rdv.datePlanifiee ? jour : null;
}

/** « Ce bon de commande a N autre(s) date(s)… » : les journées qui ne sont pas celle-ci (`majDatesRestantesFiche`). */
export function autresDates(carte: CartePlanning, jourVise: string | null): string {
  const autres = toutesLesJournees(carte.rdv.datePlanifiee, carte.faite, carte.suppl).filter((d) => d.date !== jourVise);
  const restantes = autres.filter((d) => !d.fait).length;
  return autres.length ? `Ce bon de commande a ${autres.length} autre(s) date(s) planifiée(s) — ${restantes ? `${restantes} encore à valider` : "toutes déjà validées"}.` : "";
}
