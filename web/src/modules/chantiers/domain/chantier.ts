import { z } from "zod";
import { videEnNull } from "@/lib/validation";

export const schemaChantier = z.object({
  id: z.string(),
  societe_id: z.string(),
  nom: z.string(),
  client_id: z.string().nullable(),
  client_nom: z.string().nullable(),
  conducteur_id: z.string().nullable(),
  conducteur: z.string().nullable(),
  adresse: z.string().nullable(),
  code_postal: z.string().nullable(),
  ville: z.string().nullable(),
  type: z.string().nullable(),
  date_debut: z.string().nullable(),
  date_fin: z.string().nullable(),
  infos_diverses: z.string(),
});
export type Chantier = z.infer<typeof schemaChantier>;

const texte = z.preprocess(videEnNull, z.string().trim().nullable());
const date = z.preprocess(videEnNull, z.iso.date({ message: "Date invalide." }).nullable());

/** Les types proposés par l'ancien écran (filtre « réhabilitation / neuf »). */
export const TYPES_CHANTIER = ["Réhabilitation", "Neuf", "Rénovation", "Entretien", "Particulier"] as const;

export const schemaSaisieChantier = z
  .object({
    nom: z.string().trim().min(1, "Le nom du chantier est obligatoire."),
    client_id: texte,
    conducteur_id: texte,
    adresse: texte,
    code_postal: texte,
    ville: texte,
    type: texte,
    date_debut: date,
    date_fin: date,
    infos_diverses: z.string(),
  })
  .refine((c) => !c.date_debut || !c.date_fin || c.date_fin >= c.date_debut, {
    path: ["date_fin"],
    message: "La fin ne peut pas précéder le début.",
  });
export type SaisieChantier = z.infer<typeof schemaSaisieChantier>;

export function saisieDepuis(c: Chantier | null): Record<keyof SaisieChantier, string> {
  return {
    nom: c?.nom ?? "",
    client_id: c?.client_id ?? "",
    conducteur_id: c?.conducteur_id ?? "",
    adresse: c?.adresse ?? "",
    code_postal: c?.code_postal ?? "",
    ville: c?.ville ?? "",
    type: c?.type ?? "",
    date_debut: c?.date_debut ?? "",
    date_fin: c?.date_fin ?? "",
    infos_diverses: c?.infos_diverses ?? "",
  };
}
