import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { analyser } from "@/lib/validation";
import type { Salarie, SaisieSalarie } from "../domain/salarie";
import { exigerLignes, oublier } from "./stockage";

/**
 * Les salariés. Qui a `rh / modifier` lit la TABLE (sa politique l'exige) ;
 * les autres lisent la vue `v_salaries_annuaire`, qui masque salaires, coûts,
 * naissance, IBAN — et, avec la proposition 20260926060000, le suivi médical
 * (RH-11). Mêmes colonnes des deux côtés : la vue est un miroir de la table.
 */
const COLONNES =
  "id, nom, prenom, poste, email, telephone, date_entree, date_sortie, type_contrat, carte_btp_numero, carte_btp_validite, visite_medicale_date, visite_medicale_prochaine, technicien_id, salaire_mensuel_net, cout_horaire_charge, solde_cp_initial, date_naissance, nationalite, sexe, actif, profile_id";

const nombre = z.union([z.number(), z.string()]).nullable().transform((v) => (v === null ? null : Number(v)));

const schemaLigne = z.object({
  id: z.string(),
  nom: z.string().nullable(),
  prenom: z.string().nullable(),
  poste: z.string().nullable(),
  email: z.string().nullable(),
  telephone: z.string().nullable(),
  date_entree: z.string().nullable(),
  date_sortie: z.string().nullable(),
  type_contrat: z.string().nullable(),
  carte_btp_numero: z.string().nullable(),
  carte_btp_validite: z.string().nullable(),
  visite_medicale_date: z.string().nullable(),
  visite_medicale_prochaine: z.string().nullable(),
  technicien_id: z.string().nullable(),
  salaire_mensuel_net: nombre,
  cout_horaire_charge: nombre,
  solde_cp_initial: nombre,
  date_naissance: z.string().nullable(),
  nationalite: z.string().nullable(),
  sexe: z.string().nullable(),
  // La vue rend toutes ses colonnes nullables : un salarié sans `actif` connu est actif.
  actif: z.boolean().nullable(),
  profile_id: z.string().nullable(),
});

function versSalarie(l: z.infer<typeof schemaLigne>): Salarie {
  return {
    id: l.id,
    nom: l.nom ?? "",
    prenom: l.prenom,
    poste: l.poste,
    email: l.email,
    telephone: l.telephone,
    dateEntree: l.date_entree,
    dateSortie: l.date_sortie,
    typeContrat: l.type_contrat,
    carteBtpNumero: l.carte_btp_numero,
    carteBtpValidite: l.carte_btp_validite,
    visiteMedicaleDate: l.visite_medicale_date,
    visiteMedicaleProchaine: l.visite_medicale_prochaine,
    technicienId: l.technicien_id,
    salaireMensuelNet: l.salaire_mensuel_net,
    coutHoraireCharge: l.cout_horaire_charge,
    soldeCpInitial: l.solde_cp_initial,
    dateNaissance: l.date_naissance,
    nationalite: l.nationalite,
    sexe: l.sexe,
    actif: l.actif !== false,
    profileId: l.profile_id,
  };
}

export async function listerSalaries(societeId: string, sensible: boolean): Promise<Salarie[]> {
  const client = supabase();
  const { data, error } = sensible
    ? await client.from("salaries").select(COLONNES).eq("societe_id", societeId).order("nom")
    : await client.from("v_salaries_annuaire").select(COLONNES).eq("societe_id", societeId).order("nom");
  if (error) throw error;
  return analyser(z.array(schemaLigne), data, "salariés").map(versSalarie);
}

/**
 * Ce que la fiche écrit. Les deux dates médicales n'en font JAMAIS partie :
 * la base les tient d'après le registre des visites (déclencheurs
 * `salarie_suit_son_registre_medical` et `salarie_visite_medicale_etiquette`).
 */
function ligne(s: SaisieSalarie) {
  return {
    nom: s.nom,
    prenom: s.prenom,
    poste: s.poste,
    email: s.email,
    telephone: s.telephone,
    date_naissance: s.dateNaissance,
    nationalite: s.nationalite,
    sexe: s.sexe,
    technicien_id: s.technicienId,
    type_contrat: s.typeContrat,
    cout_horaire_charge: s.coutHoraireCharge,
    salaire_mensuel_net: s.salaireMensuelNet,
    date_entree: s.dateEntree,
    date_sortie: s.dateSortie,
    carte_btp_numero: s.carteBtpNumero,
    carte_btp_validite: s.carteBtpValidite,
    solde_cp_initial: s.soldeCpInitial,
  };
}

/**
 * Crée la fiche et rend l'identifiant que la BASE a attribué. L'ancien écran
 * fabriquait un base36 que les tables filles (`salarie_id uuid`) refusaient :
 * la visite d'embauche et la fiche conducteur d'une création se perdaient.
 * Toutes les colonnes sont données : un champ absent vaudrait NULL, et `actif`
 * est NOT NULL.
 */
export async function creerSalarie(societeId: string, s: SaisieSalarie): Promise<string> {
  const { data, error } = await supabase()
    .from("salaries")
    .insert({ ...ligne(s), societe_id: societeId, actif: true, profile_id: null, legacy_id: null, visite_medicale_date: null, visite_medicale_prochaine: null })
    .select("id");
  if (error) throw error;
  const [cree] = analyser(z.array(z.object({ id: z.string() })), data, "salarié créé");
  if (!cree) throw Object.assign(new Error("Vous n'avez pas le droit de créer un salarié."), { code: "P0001" });
  return cree.id;
}

/** `profile_id` n'est pas envoyé : la base le pose à la confirmation de l'invitation, l'écran ne doit pas l'effacer. */
export async function modifierSalarie(id: string, s: SaisieSalarie): Promise<void> {
  const { data, error } = await supabase().from("salaries").update(ligne(s)).eq("id", id).select("id");
  if (error) throw error;
  exigerLignes(data);
}

/** Rattacher à une équipe (ou l'en retirer) écrit la fiche du salarié : c'est elle qui porte le lien. */
export async function definirEquipe(salarieId: string, equipeId: string | null): Promise<void> {
  const { data, error } = await supabase().from("salaries").update({ technicien_id: equipeId }).eq("id", salarieId).select("id");
  if (error) throw error;
  exigerLignes(data);
}

/**
 * Supprime la fiche. Les lignes filles partent en cascade, PAS les fichiers :
 * on relit d'abord les chemins (dossier, visites, justificatifs), puis on les
 * retire une fois la fiche effacée — sans quoi le seau garderait les contrats
 * de gens qui ne sont plus dans la base.
 */
export async function supprimerSalarie(id: string): Promise<void> {
  const client = supabase();
  const [docs, visites, absences] = await Promise.all([
    client.from("salarie_documents").select("fichier_chemin").eq("salarie_id", id),
    client.from("salarie_visites_medicales").select("fichier_chemin").eq("salarie_id", id),
    client.from("salarie_absences").select("justificatif_chemin").eq("salarie_id", id),
  ]);
  for (const r of [docs, visites, absences]) if (r.error) throw r.error;
  const chemins = [
    ...(docs.data ?? []).map((d) => d.fichier_chemin),
    ...(visites.data ?? []).map((v) => v.fichier_chemin),
    ...(absences.data ?? []).map((a) => a.justificatif_chemin),
  ].filter((c): c is string => !!c);

  const { data, error } = await client.from("salaries").delete().eq("id", id).select("id");
  if (error) throw error;
  exigerLignes(data, "Vous n'avez pas le droit de supprimer un salarié.");
  await Promise.all(chemins.map((c) => oublier(c)));
}
