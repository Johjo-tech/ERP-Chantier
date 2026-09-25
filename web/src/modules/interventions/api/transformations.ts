import { todayISO } from "@/lib/dates";
import { clientPlanning, supabase } from "@/lib/supabase";
import { lireClient } from "@/modules/clients/api/clients";
import { dateEcheance, delaiPaiementRetenu, libelleDelaiPaiement } from "@/modules/clients/domain/delais";
import { enregistrerDevis } from "@/modules/devis/api/devis";
import type { LigneAEnregistrer } from "@/modules/documents/domain/lignes";
import { creerFacture } from "@/modules/facturation/api/factures";
import { chargerReglages } from "@/modules/societes/api/reglages";
import { lignesAReprendre } from "../domain/rapport";
import type { Rapport } from "./rapports";

/**
 * « Transformer en devis / en facture » (PLN-20) : un document BROUILLON,
 * rattaché au rapport (`intervention_id`), dont les lignes sont les
 * préconisations (« x2 m² » donne quantité et unité), sans prix — le prix se
 * saisit sur le document. Composé des API publiques des modules devis,
 * facturation, clients et sociétés : aucune règle de ces modules n'est
 * recopiée ici.
 */
const refus = (message: string) => ({ code: "P0001", message });

function lignesDuRapport(r: Rapport, tva: number): LigneAEnregistrer[] {
  return lignesAReprendre(r).map((l, position) => ({
    id: null,
    position,
    type: "ligne",
    designation: l.designation,
    quantite: l.quantite,
    prix_unitaire: 0,
    unite: l.unite,
    tva,
    article_reference: null,
    commentaire: null,
    metier: null,
    montant_ht: 0,
  }));
}

function clientExige(r: Rapport): string {
  if (!r.client_id) throw refus("Ce rapport n'est rattaché à aucun client du répertoire : choisissez le client à l'étape Infos, puis réessayez.");
  return r.client_id;
}

const lieu = (r: Rapport) => ({
  adresse_locataire: r.adresse_locataire,
  code_postal: r.code_postal,
  ville: r.ville,
  logement_statut: r.logement_statut,
  occupant: r.occupant,
  etage: r.etage,
  numero_logement: r.numero_logement,
  precision_commune: r.precision_commune,
  ancien_locataire: r.ancien_locataire,
});

async function dejaTransforme(table: "devis" | "factures", rapportId: string): Promise<string | null> {
  const { data, error } = await supabase().from(table).select("id, numero").eq("intervention_id", rapportId).limit(1);
  if (error) throw error;
  const trouve = data[0];
  return trouve ? (trouve.numero ?? "brouillon en cours") : null;
}

export async function devisDepuisRapport(societeId: string, r: Rapport): Promise<string> {
  const deja = await dejaTransforme("devis", r.id);
  if (deja) throw refus(`Ce rapport a déjà été transformé en devis (${deja}). Ouvrez-le directement pour le modifier.`);
  const clientId = clientExige(r);
  const [client, reglages] = await Promise.all([lireClient(clientId), chargerReglages(societeId)]);
  const id = await enregistrerDevis(
    societeId,
    null,
    { client_id: clientId, client_nom: client.nom, adresse: client.adresse, interlocuteur: r.interlocuteur, chantier_id: null, date: todayISO(), conducteur_id: r.conducteur_id, statut: "brouillon", remise_pourcentage: 0, telephone_locataire: null, ...lieu(r) },
    lignesDuRapport(r, reglages.tvaDefaut)
  );
  const lien = await supabase().from("devis").update({ intervention_id: r.id }).eq("id", id);
  if (lien.error) throw lien.error;
  return id;
}

/**
 * Un rapport lié à un bon ne facture pas à côté de lui : il facture le BON,
 * par son circuit (pré-facture, chiffrage). L'écran renvoie alors vers le bon.
 */
export async function factureDepuisRapport(societeId: string, r: Rapport): Promise<string> {
  if (r.bon_commande_id) throw refus("Ce rapport facture le bon de commande lié : la facture se crée depuis le bon, après son chiffrage.");
  const deja = await dejaTransforme("factures", r.id);
  if (deja) throw refus(`Ce rapport a déjà été transformé en facture (${deja}). Ouvrez-la directement pour la modifier.`);
  const clientId = clientExige(r);
  const [client, reglages] = await Promise.all([lireClient(clientId), chargerReglages(societeId)]);
  const date = todayISO();
  const delai = delaiPaiementRetenu(client, { delai_paiement_jours: reglages.delaiPaiementJours, delai_paiement_mode: reglages.modeDelaiPaiement });
  return creerFacture(
    societeId,
    {
      client_id: clientId,
      client_nom: client.nom,
      adresse: client.adresse,
      interlocuteur: r.interlocuteur,
      date,
      conducteur_id: r.conducteur_id,
      intervention_id: r.id,
      remise_pourcentage: 0,
      delai_paiement_jours: delai.jours,
      delai_paiement_mode: delai.mode,
      conditions_reglement: libelleDelaiPaiement(delai),
      echeance: dateEcheance(date, delai) || null,
      mode_paiement: client.mode_paiement ?? null,
      cadre_facturation: client.cadre_facturation ?? "B2B_national",
      ...lieu(r),
    },
    lignesDuRapport(r, reglages.tvaDefaut)
  );
}

/** Le courriel du client, pour préremplir l'envoi du rapport (vide s'il n'est pas lisible). */
export async function courrielDuClient(clientId: string | null): Promise<string> {
  if (!clientId) return "";
  const { data, error } = await clientPlanning().from("clients").select("email").eq("id", clientId).maybeSingle();
  if (error) {
    console.warn("Courriel du client illisible :", error);
    return "";
  }
  return data?.email ?? "";
}
