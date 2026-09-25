import { todayISO } from "@/lib/dates";
import { arrondiCentimes, montant } from "@/lib/money";
import { supabase } from "@/lib/supabase";
import { synchroniserLignes } from "@/modules/documents/api/lignes";
import { depuisBase, lignesPourEnregistrement } from "@/modules/documents/domain/lignes";
import { nettoyerLogement } from "@/modules/documents/domain/logement";
import { z } from "zod";
import { analyser } from "@/lib/validation";
import { lignesDevisDuRapport } from "../domain/preconisations";
import { enregistrerDevis, lireDevis } from "./devis";

const schemaRapport = z.object({
  id: z.string(),
  numero: z.string().nullable(),
  client_id: z.string().nullable(),
  client_nom: z.string().nullable(),
  interlocuteur: z.string().nullable(),
  adresse: z.string().nullable(),
  adresse_locataire: z.string().nullable(),
  code_postal: z.string().nullable(),
  ville: z.string().nullable(),
  logement_statut: z.enum(["occupé", "vacant", "commune"]).nullable(),
  occupant: z.string().nullable(),
  etage: z.string().nullable(),
  numero_logement: z.string().nullable(),
  precision_commune: z.string().nullable(),
  ancien_locataire: z.string().nullable(),
  constatations: z.string().nullable(),
  preconisations: z.string().nullable(),
  metier: z.string().nullable(),
  conducteur_id: z.string().nullable(),
});

/**
 * Un rapport d'intervention devient un devis BROUILLON (DEV-17,
 * `transformerInterventionEn`, app.js l. 4282) : refusé si un devis porte déjà
 * ce rapport ; une préconisation = une ligne ; lieu, logement et interlocuteur
 * recopiés ; daté du jour. Le devis s'ouvre ensuite pour être chiffré.
 */
export async function devisDepuisIntervention(societeId: string, interventionId: string, tvaDefaut: number): Promise<string> {
  const db = supabase();
  const deja = await db.from("devis").select("id, numero").eq("intervention_id", interventionId).limit(1);
  if (deja.error) throw deja.error;
  const existant = deja.data?.[0];
  if (existant) throw { code: "P0001", message: `Ce rapport a déjà été transformé en devis (${existant.numero}). Ouvrez-le directement pour le modifier.` };
  const lu = await db.from("interventions").select(Object.keys(schemaRapport.shape).join(", ")).eq("id", interventionId).single();
  if (lu.error) throw lu.error;
  const r = analyser(schemaRapport, lu.data, "rapport d'intervention");
  if (!r.client_id) throw { code: "P0001", message: "Ce rapport ne désigne aucune fiche client : rattachez-le à un client avant d'en faire un devis." };
  const lieu = nettoyerLogement({ logement_statut: r.logement_statut, occupant: r.occupant, etage: r.etage, numero_logement: r.numero_logement, precision_commune: r.precision_commune, ancien_locataire: r.ancien_locataire });
  return enregistrerDevis(
    societeId,
    null,
    {
      client_id: r.client_id,
      client_nom: r.client_nom ?? "",
      adresse: r.adresse,
      interlocuteur: r.interlocuteur,
      chantier_id: null,
      date: todayISO(),
      conducteur_id: r.conducteur_id,
      statut: "brouillon",
      remise_pourcentage: 0,
      adresse_locataire: r.adresse_locataire,
      code_postal: r.code_postal,
      ville: r.ville,
      telephone_locataire: null,
      ...lieu,
      intervention_id: r.id,
    },
    lignesDevisDuRapport(r, tvaDefaut)
  );
}

/** Ce que la saisie du bon écrit quand le client n'a pas encore donné son numéro (commandes/domain/regles). */
const SENTINELLE_ATTENTE = "En attente de BC";

/**
 * Créer le bon de commande d'un devis (DEV-14, `lierDevisABonCommande`,
 * app.js l. 4766) : refusé si un bon porte déjà ce devis ; montant = HT du
 * devis, lu dans `v_devis_totaux` (la base calcule) et arrondi au centime
 * comme la colonne. Le bon naît « en attente de BC » — le numéro du client
 * n'existe pas encore — puis s'ouvre pour relecture (D-FAC-08).
 */
export async function bonDepuisDevis(societeId: string, devisId: string): Promise<string> {
  const db = supabase();
  const deja = await db.from("v_bons_commande_terrain").select("id, numero_bc, numero_interne").eq("devis_id", devisId).limit(1);
  if (deja.error) throw deja.error;
  const lie = deja.data?.[0];
  if (lie) throw { code: "P0001", message: `Ce devis est déjà lié au bon de commande ${lie.numero_interne ?? lie.numero_bc ?? ""}. Ouvrez-le directement pour le modifier.` };
  const [d, totaux] = await Promise.all([lireDevis(devisId), db.from("v_devis_totaux").select("ht").eq("devis_id", devisId).maybeSingle()]);
  if (totaux.error) throw totaux.error;
  const aujourdhui = todayISO();
  const { data, error } = await db
    .from("bons_commande")
    .insert({
      societe_id: societeId,
      devis_id: devisId,
      client_id: d.client_id,
      client_nom: d.client_nom,
      interlocuteur: d.interlocuteur,
      // Le lieu des travaux d'un bon vit dans `adresse` : c'est elle que lit bc_generer_facture.
      adresse: d.adresse_locataire,
      code_postal: d.code_postal,
      ville: d.ville,
      ...nettoyerLogement({ logement_statut: d.logement_statut, occupant: d.occupant, etage: d.etage, numero_logement: d.numero_logement, precision_commune: d.precision_commune, ancien_locataire: d.ancien_locataire }),
      conducteur_id: d.conducteur_id,
      conducteur: null,
      date: aujourdhui,
      date_reception: aujourdhui,
      numero_bc: SENTINELLE_ATTENTE,
      en_attente_bc: true,
      sans_bc: false,
      statut: "en attente",
      montant: Number(arrondiCentimes(montant(totaux.data?.ht ?? 0)).toString()),
    })
    .select("id")
    .single();
  if (error) throw error;
  const { lignes } = lignesPourEnregistrement(d.lignes.map(depuisBase).map((l) => ({ ...l, id: null })));
  await synchroniserLignes("bon_commande_lignes", "bon_commande_id", data.id, lignes);
  return data.id;
}
