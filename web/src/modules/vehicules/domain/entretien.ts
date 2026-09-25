import { z } from "zod";
import { todayISO } from "@/lib/dates";
import { schemaNombreFr } from "@/lib/nombres";
import { videEnNull } from "@/lib/validation";

/** Un entretien tel que la base le rend (`vehicule_entretiens`). */
export const schemaEntretien = z.object({
  id: z.string(),
  vehicule_id: z.string(),
  designation: z.string(),
  kilometrage: z.number().nullable(),
  montant: z.number(),
  date_entretien: z.string().nullable(),
  fichier_chemin: z.string().nullable(),
  fichier_nom: z.string().nullable(),
});
export type Entretien = z.infer<typeof schemaEntretien>;

/**
 * La saisie d'un entretien (VEH-03). Montant vide → 0, km vide → rien, date
 * vide → aujourd'hui, comme l'ancien écran ; mais « 12abc » est refusé, là où
 * `parseFloat` en tirait 12 sans rien dire.
 */
export const schemaSaisieEntretien = z.object({
  designation: z.string().trim().min(1, "Indiquez une désignation pour cet entretien."),
  kilometrage: z.preprocess(videEnNull, z.string().pipe(schemaNombreFr).pipe(z.number().min(0, "Kilométrage négatif.")).nullable()),
  montant: z.preprocess((v) => videEnNull(v) ?? "0", z.string().pipe(schemaNombreFr).pipe(z.number().min(0, "Montant négatif."))),
  date_entretien: z.preprocess((v) => videEnNull(v) ?? todayISO(), z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide.")),
});
export type SaisieEntretien = z.infer<typeof schemaSaisieEntretien>;

export function saisieEntretienDepuis(e: Entretien | null, kmVehicule: number | null): Record<keyof SaisieEntretien, string> {
  return {
    designation: e?.designation ?? "",
    // Un nouvel entretien part du compteur connu du véhicule (app.js l. 15073).
    kilometrage: e ? (e.kilometrage == null ? "" : String(e.kilometrage)) : kmVehicule ? String(kmVehicule) : "",
    montant: e ? String(e.montant).replace(".", ",") : "",
    date_entretien: e?.date_entretien ?? todayISO(),
  };
}

/**
 * Le compteur du véhicule après un entretien : il MONTE si l'entretien porte
 * un kilométrage supérieur, et ne descend jamais (app.js l. 15187, 15277).
 * Rend `null` quand il n'y a rien à écrire.
 */
export function kilometrageApres(kmVehicule: number | null, kmEntretien: number | null): number | null {
  if (kmEntretien == null) return null;
  return kmEntretien > (kmVehicule ?? 0) ? kmEntretien : null;
}

export function trierEntretiens<E extends Pick<Entretien, "date_entretien">>(liste: readonly E[]): E[] {
  return [...liste].sort((a, b) => (b.date_entretien ?? "").localeCompare(a.date_entretien ?? ""));
}
