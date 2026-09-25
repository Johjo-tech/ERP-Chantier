import { z } from "zod";
import { videEnNull } from "@/lib/validation";
import { JOUR_MS } from "@/lib/durees";

/** Numéros de `getUTCDay()` : le week-end ne compte pas dans un congé. */
const DIMANCHE = 0;
const SAMEDI = 6;

/**
 * Congés et absences (RH-08, RH-20). L'ancien écran posait un tableau
 * `absences` sur la fiche, sans colonne : tout était perdu au rechargement et
 * le solde de CP retombait sur l'acquis. Ici chaque absence est une ligne de
 * `salarie_absences` (D-RH-02), et ces règles sont celles de l'ancien écran
 * (`soldeCPRestant`, `nbJoursOuvres` — parité : tests/parite/rh.essai.ts).
 */

export const TYPES_ABSENCE = ["Congé payé", "Arrêt maladie", "Congé sans solde", "Absence injustifiée", "Accident du travail"] as const;
export type TypeAbsence = (typeof TYPES_ABSENCE)[number];

/** Le type qui entame le solde de congés payés. */
export const TYPE_CONGE_PAYE: TypeAbsence = "Congé payé";

/** Un arrêt se justifie par le document du médecin : l'écran propose alors de le joindre. */
export function demandeJustificatif(type: string): boolean {
  return type === "Arrêt maladie" || type === "Accident du travail";
}

export interface Absence {
  id: string;
  salarieId: string;
  type: string;
  dateDebut: string;
  dateFin: string;
  nbJours: number | null;
  commentaire: string | null;
  justificatifChemin: string | null;
  justificatifNom: string | null;
}

/**
 * Les jours ouvrés d'une période, bornes comprises : hors samedi et dimanche.
 * Les jours fériés sont COMPTÉS, comme dans l'ancien écran (RH-08) — les
 * retirer changerait les soldes déjà annoncés aux salariés.
 */
export function nbJoursOuvres(dateDebut: string, dateFin: string): number {
  const debut = Date.parse(`${dateDebut}T00:00:00Z`);
  const fin = Date.parse(`${dateFin}T00:00:00Z`);
  if (Number.isNaN(debut) || Number.isNaN(fin)) return 0;
  let n = 0;
  for (let t = debut; t <= fin; t += JOUR_MS) {
    const jour = new Date(t).getUTCDay();
    if (jour !== DIMANCHE && jour !== SAMEDI) n++;
  }
  return n;
}

/** Solde restant = acquis − jours de congés payés posés (les autres absences n'y touchent pas). */
export function soldeCpRestant(soldeInitial: number | string | null | undefined, absences: readonly Pick<Absence, "type" | "nbJours">[]): number {
  const initial = Number.parseFloat(String(soldeInitial ?? "")) || 0;
  const pris = absences.filter((a) => a.type === TYPE_CONGE_PAYE).reduce((s, a) => s + (Number(a.nbJours) || 0), 0);
  return initial - pris;
}

/** L'absence en cours aujourd'hui, s'il y en a une : c'est elle que la liste signale. */
export function absenceEnCours<T extends Pick<Absence, "dateDebut" | "dateFin">>(absences: readonly T[], aujourdHui: string): T | null {
  return absences.find((a) => a.dateDebut <= aujourdHui && a.dateFin >= aujourdHui) ?? null;
}

/** Les plus récentes d'abord. */
export function trierAbsences<T extends Pick<Absence, "dateDebut">>(absences: readonly T[]): T[] {
  return [...absences].sort((a, b) => b.dateDebut.localeCompare(a.dateDebut));
}

export const schemaSaisieAbsence = z
  .object({
    type: z.enum(TYPES_ABSENCE, "Type d'absence inconnu."),
    dateDebut: z.iso.date("Indiquez une date de début et de fin."),
    dateFin: z.iso.date("Indiquez une date de début et de fin."),
    commentaire: z.preprocess(videEnNull, z.string().trim().nullable()),
  })
  .refine((a) => a.dateFin >= a.dateDebut, { message: "La date de fin doit être après la date de début.", path: ["dateFin"] });
export type SaisieAbsence = z.infer<typeof schemaSaisieAbsence>;
