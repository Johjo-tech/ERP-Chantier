import { z } from "zod";
import { todayISO } from "@/lib/dates";
import { arrondiCentimes, type Montant } from "@/lib/money";
import { supabase } from "@/lib/supabase";
import { analyser } from "@/lib/validation";
import type { Chantier } from "../domain/chantier";
import type Big from "big.js";

/**
 * Les parts de DPGF déjà planifiées : les tâches de planning qui pointent une
 * ligne (`dpgf_ligne_id`), avec leur quantité et leur bon de commande.
 */
export const schemaTachePlanifiee = z.object({
  id: z.string(),
  dpgf_ligne_id: z.string().nullable(),
  quantite_planifiee: z.number().nullable(),
  bon_commande_id: z.string().nullable(),
  statut: z.string(),
  date_tache: z.string().nullable(),
});
export type TachePlanifiee = z.infer<typeof schemaTachePlanifiee>;

export async function listerTachesPlanifiees(chantierId: string): Promise<TachePlanifiee[]> {
  const { data, error } = await supabase()
    .from("planning_taches")
    .select("id, dpgf_ligne_id, quantite_planifiee, bon_commande_id, statut, date_tache")
    .eq("chantier_id", chantierId)
    .not("dpgf_ligne_id", "is", null)
    .order("cree_le");
  if (error) throw error;
  return analyser(z.array(schemaTachePlanifiee), data, "tâches planifiées du DPGF");
}

export interface DemandePlanification {
  societeId: string;
  chantier: Chantier;
  ligne: { id: string; metier: string };
  quantite: Big;
  montant: Montant;
  libelle: string;
}

/**
 * Crée le bon de commande de la part planifiée, puis la tâche « non planifiée »
 * (sans date) qui le relie à la ligne de DPGF (CHA-09, CHA-51).
 *
 * L'ancien écran posait `chantierId`, `dpgfLigneId` et `qtePlanifiee` sur le
 * bon — trois champs sans colonne, perdus — et un conducteur vide. Ici le lien
 * vit dans `planning_taches` (qui a les colonnes pour cela), et le bon hérite
 * du conducteur du chantier (D-CHA-04). Si la tâche échoue, le bon est retiré :
 * un bon sans lien ferait croire la quantité encore à planifier.
 */
export async function planifierQuantite(d: DemandePlanification): Promise<string> {
  const c = d.chantier;
  const { data: bon, error } = await supabase()
    .from("bons_commande")
    .insert({
      societe_id: d.societeId,
      client_id: c.client_id,
      client_nom: c.client_nom ?? "",
      numero_bc: d.libelle,
      sans_bc: false,
      en_attente_bc: false,
      gratuite: false,
      date: todayISO(),
      statut: "en attente",
      adresse: c.adresse,
      code_postal: c.code_postal,
      ville: c.ville,
      metier: d.ligne.metier,
      metiers: [d.ligne.metier],
      montant: Number(arrondiCentimes(d.montant)),
      conducteur_id: c.conducteur_id,
      reference_chantier: c.nom,
      notes: null,
      devis_id: null,
    })
    .select("id")
    .single();
  if (error) throw error;
  const { error: erreurTache } = await supabase().from("planning_taches").insert({
    societe_id: d.societeId,
    libelle: d.libelle,
    bon_commande_id: bon.id,
    chantier_id: c.id,
    dpgf_ligne_id: d.ligne.id,
    quantite_planifiee: Number(d.quantite),
    metier: d.ligne.metier,
    statut: "planifiee",
    date_tache: null,
    legacy_id: null,
  });
  if (erreurTache) {
    const { error: erreurRetrait } = await supabase().from("bons_commande").delete().eq("id", bon.id);
    if (erreurRetrait) console.error(`Bon ${bon.id} resté sans tâche de DPGF :`, erreurRetrait);
    throw erreurTache;
  }
  return bon.id;
}
