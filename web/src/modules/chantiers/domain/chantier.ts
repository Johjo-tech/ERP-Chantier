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

/**
 * Les types de l'ancienne app, codes compris : les deux applications partagent
 * la base, et l'ancienne lit `neuf` / `rehabilitation` (app.js l. 13157, 13192).
 */
export const TYPES_CHANTIER = [
  { code: "rehabilitation", libelle: "Réhabilitation" },
  { code: "neuf", libelle: "Chantier neuf" },
] as const;
export const TYPE_CHANTIER_DEFAUT = "rehabilitation";

/** Comme l'ancien écran : tout ce qui n'est pas « neuf » se lit « Réhabilitation ». */
export function libelleTypeChantier(type: string | null): string {
  return type === "neuf" ? "Chantier neuf" : "Réhabilitation";
}

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
    type: c ? (c.type ?? "") : TYPE_CHANTIER_DEFAUT,
    date_debut: c?.date_debut ?? "",
    date_fin: c?.date_fin ?? "",
    infos_diverses: c?.infos_diverses ?? "",
  };
}
