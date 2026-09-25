import { z } from "zod";
import { jourIso, todayISO } from "@/lib/dates";
import { videEnNull } from "@/lib/validation";

/**
 * Prêts du parc — matériel ET véhicules (VEH-03, VEH-05).
 *
 * Un prêt est EN COURS tant qu'il n'a pas de retour réel (`materielStatut`,
 * app.js l. 14608, partagé par l'ancien écran entre matériel et véhicules).
 * En base : `date_debut` = date du prêt, `duree_jours` = durée prévue,
 * `date_fin` = retour RÉEL (proposition 20260926070000, D-VEH-01).
 */
export interface PretBase {
  id: string;
  salarie_id: string | null;
  personne: string | null;
  date_debut: string | null;
  duree_jours: number | null;
  date_fin: string | null;
}

export function pretEnCours<P extends Pick<PretBase, "date_fin">>(prets: readonly P[]): P | null {
  return prets.find((p) => !p.date_fin) ?? null;
}

const DATE_ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Date + n jours, en calendrier pur. L'ancien `addJours` passait par l'heure
 * LOCALE (`new Date(iso+'T00:00:00')`) : même résultat en France, mais ici
 * aucune heure n'intervient, si bien qu'un changement d'heure ne peut rien
 * décaler.
 */
export function ajouterJours(dateIso: string, jours: number): string {
  const m = DATE_ISO.exec(dateIso);
  if (!m) return dateIso;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + jours));
  return jourIso(d.toISOString());
}

export function retourPrevu(p: Pick<PretBase, "date_debut" | "duree_jours">): string | null {
  return p.date_debut && p.duree_jours != null ? ajouterJours(p.date_debut, p.duree_jours) : null;
}

/** Les plus récents d'abord, comme l'historique de l'ancien écran. */
export function trierPrets<P extends Pick<PretBase, "date_debut">>(prets: readonly P[]): P[] {
  return [...prets].sort((a, b) => (b.date_debut ?? "").localeCompare(a.date_debut ?? ""));
}

export interface PersonneAnnuaire {
  id: string;
  prenom: string | null;
  nom: string | null;
}

export function nomPersonne(s: PersonneAnnuaire): string {
  return [s.prenom, s.nom].filter(Boolean).join(" ") || "Sans nom";
}

/** Le salarié s'il est connu, sinon le nom saisi (reprise), sinon « Inconnu ». */
export function nomEmprunteur(p: Pick<PretBase, "salarie_id" | "personne">, annuaire: readonly PersonneAnnuaire[]): string {
  const s = p.salarie_id ? annuaire.find((x) => x.id === p.salarie_id) : undefined;
  return s ? nomPersonne(s) : p.personne || "Inconnu";
}

/**
 * La saisie d'un prêt. La durée est un nombre ENTIER de jours, ≥ 1, ou rien :
 * l'ancien `parseInt(...)||null` acceptait « -2 » et tronquait « 2,5 ».
 * Date vide → aujourd'hui, comme l'ancien écran.
 */
export const schemaSaisiePret = z.object({
  salarie_id: z.string().trim().min(1, "Choisissez la personne à qui prêter."),
  etat: z.preprocess(videEnNull, z.string().trim().nullable()),
  date_debut: z.preprocess((v) => videEnNull(v) ?? todayISO(), z.string().regex(DATE_ISO, "Date invalide.")),
  duree_jours: z.preprocess(
    videEnNull,
    z.coerce.number({ message: "Durée invalide." }).int("Un nombre entier de jours.").min(1, "Au moins un jour.").nullable()
  ),
});
export type SaisiePret = z.infer<typeof schemaSaisiePret>;

export function saisiePretVierge(etat: string): Record<keyof SaisiePret, string> {
  return { salarie_id: "", etat, date_debut: todayISO(), duree_jours: "" };
}
