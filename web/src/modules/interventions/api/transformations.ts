import { todayISO } from "@/lib/dates";
import { clientPlanning, supabase } from "@/lib/supabase";
import { lireClient } from "@/modules/clients/api/clients";
import { dateEcheance, delaiPaiementRetenu, libelleDelaiPaiement } from "@/modules/clients/domain/delais";
import { enregistrerDevis } from "@/modules/devis/api/devis";
import { lignesDevisDuRapport } from "@/modules/devis/domain/preconisations";
import { nettoyerLogement } from "@/modules/documents/domain/logement";
import { creerFacture } from "@/modules/facturation/api/factures";
import { chargerReglages } from "@/modules/societes/api/reglages";
import type { Rapport } from "./rapports";

/**
 * « Transformer en devis / en facture » (PLN-20, DEV-17, FAC-15) — la SEULE
 * voie du rapport vers une pièce (D-TRV-09 résorbé, D-CLI-09) : la carte de
 * la liste et l'aperçu du rapport passent tous deux ici. Un document
 * BROUILLON, rattaché au rapport (`intervention_id`) dès son INSERT, dont les
 * lignes sont les préconisations (« x2 m² » donne quantité et unité — la
 * règle du module devis, `lignesDevisDuRapport`, parité
 * `parsePreconisationsEnLignes`), sans prix. Gardes : pas deux devis ni deux
 * factures pour un rapport, un client du répertoire exigé, un rapport lié à
 * un bon se facture par le bon.
 */
const refus = (message: string) => ({ code: "P0001", message });

function clientExige(r: Rapport): string {
  if (!r.client_id) throw refus("Ce rapport n'est rattaché à aucun client du répertoire : choisissez le client à l'étape Infos, puis réessayez.");
  return r.client_id;
}

/** Le lieu et le logement du rapport ; les champs qui ne valent pas pour son statut sont vidés (`nettoyerLogement`). */
const lieu = (r: Rapport) => ({
  adresse_locataire: r.adresse_locataire,
  code_postal: r.code_postal,
  ville: r.ville,
  ...nettoyerLogement({
    logement_statut: r.logement_statut,
    occupant: r.occupant,
    etage: r.etage,
    numero_logement: r.numero_logement,
    precision_commune: r.precision_commune,
    ancien_locataire: r.ancien_locataire,
  }),
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
  // Le lien au rapport part avec l'INSERT : un devis sans lui échapperait à la garde « déjà transformé ».
  return enregistrerDevis(
    societeId,
    null,
    { client_id: clientId, client_nom: client.nom, adresse: client.adresse, interlocuteur: r.interlocuteur, chantier_id: null, date: todayISO(), conducteur_id: r.conducteur_id, statut: "brouillon", remise_pourcentage: 0, telephone_locataire: null, ...lieu(r), intervention_id: r.id },
    lignesDevisDuRapport(r, reglages.tvaDefaut)
  );
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
    lignesDevisDuRapport(r, reglages.tvaDefaut)
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
