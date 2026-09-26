import { todayISO } from "@/lib/dates";
import { arrondiCentimes, montant } from "@/lib/money";
import { supabase } from "@/lib/supabase";
import { EnregistrementPartiel } from "@/modules/commandes/api/bons";
import { synchroniserLignes } from "@/modules/documents/api/lignes";
import { depuisBase, lignesPourEnregistrement } from "@/modules/documents/domain/lignes";
import { nettoyerLogement } from "@/modules/documents/domain/logement";
import { lireDevis } from "./devis";

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
  try {
    await synchroniserLignes("bon_commande_lignes", "bon_commande_id", data.id, lignes);
  } catch (cause) {
    // Le bon existe déjà, lié au devis : un nouvel essai serait refusé (« déjà lié »).
    // L'erreur porte donc son id, pour l'ouvrir et le compléter (relecture 4, I7).
    throw new EnregistrementPartiel(data.id, cause, "Le bon de commande est créé depuis le devis, mais pas toutes ses lignes : complétez-les sur le bon, puis enregistrez.");
  }
  return data.id;
}
