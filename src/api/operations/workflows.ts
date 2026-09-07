/**
 * Workflows métier complexes
 * Les opérations que l'HTML utilise pour les processus clés
 */

import * as queries from "@/queries";
import type { BonCommande, Facture, Devis } from "@/api/types";

// ============ FACTURE ← DEVIS ============

/**
 * Workflow: Devis accepté → Créer facture
 */
export async function accepterDevisEtCreerFacture(
  societeId: string,
  devisId: string
): Promise<Facture> {
  // 1. Marquer devis comme accepté
  await queries.updateDevisStatut(devisId, "accepté");

  // 2. Créer facture depuis devis
  const facture = await queries.createFactureFromDevis(societeId, devisId);

  console.log(`✅ Devis ${devisId} accepté → Facture ${facture.id} créée`);
  return facture;
}

// ============ FACTURE ← BON DE COMMANDE ============

/**
 * Workflow: BC complétée → Créer facture
 */
export async function clotureractureDepuisBC(
  societeId: string,
  bcId: string,
  dateReception?: string
): Promise<Facture> {
  // 1. Marquer BC comme reçue
  if (dateReception) {
    await queries.markBCReceived(bcId, dateReception);
  }

  // 2. Créer facture depuis BC
  const facture = await queries.createFactureFromBC(societeId, bcId);

  console.log(`✅ BC ${bcId} → Facture ${facture.id} créée`);
  return facture;
}

// ============ PLANIFICATION BC ============

/**
 * Planifier un BC multi-métier avec techniciens/sous-traitants
 */
export async function planifierBCMultiMetier(
  bcId: string,
  plannings: Array<{
    metier: string;
    technicien?: string;
    sousTraitant?: string;
    datePlanifiee: string;
    datePlanifieeFin: string;
    heurePlanifiee: string;
    dureeHeures: number;
  }>
): Promise<BonCommande> {
  const scheduleParMetier: Record<string, any> = {};

  for (const p of plannings) {
    scheduleParMetier[p.metier] = {
      technicien: p.technicien,
      sous_traitant: p.sousTraitant,
      date_planifiee: p.datePlanifiee,
      date_planifiee_fin: p.datePlanifieeFin,
      heure_planifiee: p.heurePlanifiee,
      duree_heures: p.dureeHeures,
    };
  }

  const bc = await queries.scheduleBCByMetier(bcId, scheduleParMetier);

  console.log(`✅ BC ${bcId} planifiée pour ${plannings.length} métiers`);
  return bc;
}

// ============ SAV (Bon de Commande lié) ============

/**
 * Créer un SAV pour un BC précédent
 */
export async function creerSAV(
  societeId: string,
  originalBcId: string,
  probleme: string,
  photos?: string[]
): Promise<BonCommande> {
  const bc = await queries.getBonCommande(originalBcId);
  if (!bc) {
    throw new Error("BC original not found");
  }

  const sav = await queries.createSAVBonCommande(
    societeId,
    originalBcId,
    probleme,
    photos
  );

  console.log(`✅ SAV créé pour BC ${originalBcId}: ${sav.id}`);
  return sav;
}

// ============ RÉGLEMENT FACTURE ============

/**
 * Ajouter un réglement et mettre à jour le statut facture
 */
export async function ajouterReglementEtMajStatut(
  factureId: string,
  montant: number,
  mode: string,
  date: string,
  reference?: string
): Promise<{ reglement: any; facture: Facture }> {
  // 1. Ajouter le réglement
  const reglement = await queries.addReglement(
    factureId,
    montant,
    mode,
    date,
    reference
  );

  // 2. Récupérer la facture et ses totaux
  const solde = await queries.getFactureSolde(factureId);

  // 3. Mettre à jour le statut si entièrement payée
  let facture: Facture;
  if (solde.solde_restant <= 0) {
    facture = await queries.updateFactureStatut(factureId, "payée");
    console.log(`✅ Facture ${factureId} entièrement payée`);
  } else {
    facture = (await queries.getFacture(factureId))!;
    console.log(
      `✅ Réglement ${reglement.id} - Solde restant: ${solde.solde_restant}€`
    );
  }

  return { reglement, facture };
}

// ============ RAPPORT D'INTERVENTION ============

/**
 * Compléter un rapport d'intervention et créer facture
 */
export async function completerRapportEtCreerFacture(
  societeId: string,
  interventionId: string,
  constatations: string,
  preconisations: string,
  signature?: string,
  photos?: string[]
): Promise<Facture> {
  // 1. Mettre à jour le rapport
  await queries.updateInterventionRapport(
    interventionId,
    constatations,
    preconisations
  );

  // 2. Ajouter signature si fournie
  if (signature) {
    await queries.signIntervention(interventionId, signature);
  }

  // 3. Ajouter photos si fournies
  if (photos && photos.length > 0) {
    await queries.addInterventionPhotos(interventionId, photos);
  }

  // 4. Créer facture depuis intervention
  const facture = await queries.createFacture(societeId, {
    client: "",
    numero: "",
    date: new Date().toISOString().split("T")[0],
    remise_pourcentage: 0,
    statut: "impayée",
    conducteur: undefined,
    verrouillee: false,
    devis_id: null,
    intervention_id: interventionId,
    bon_commande_id: null,
    chantier_id: null,
  });

  console.log(`✅ Rapport ${interventionId} complété → Facture créée`);
  return facture;
}

// ============ CHANTIER - CLÔTURE ============

/**
 * Clôturer un chantier
 * Vérifier que tous les BC sont reçus et facturés
 */
export async function cloturerChantier(
  chantierId: string,
  dateClôture: string
): Promise<void> {
  // 1. Récupérer le chantier
  const chantier = await queries.getChantier(chantierId);
  if (!chantier) {
    throw new Error("Chantier not found");
  }

  // 2. Vérifier statut (optionnel - juste une alerte)
  const avancement = await queries.getChantierAvancement(chantierId);
  console.log(`ℹ️ Chantier clôturé - Avancement: ${avancement.avancement_pct}%`);

  // 3. Mettre à jour
  await queries.updateChantier(chantierId, {
    date_fin: dateClôture,
  });

  console.log(`✅ Chantier ${chantierId} clôturé`);
}

// ============ NOTIFICATIONS & ALERTES ============

/**
 * Calculer les notifications (véhicules, habilitations, BC en retard)
 */
export async function calculerNotifications(
  societeId: string
): Promise<Array<{ id: string; type: string; message: string; urgent: boolean }>> {
  const notifications: Array<{
    id: string;
    type: string;
    message: string;
    urgent: boolean;
  }> = [];

  try {
    const today = new Date().toISOString().split("T")[0];

    // 1. Véhicules - Contrôle technique
    const vehicules = await queries.listVehicules(societeId);
    for (const v of vehicules) {
      if (!v.prochain_ct) continue;
      const jours = Math.ceil(
        (new Date(v.prochain_ct).getTime() - new Date().getTime()) /
          (1000 * 60 * 60 * 24)
      );
      if (jours <= 30) {
        notifications.push({
          id: `veh_ct_${v.id}`,
          type: "vehicule",
          message: `${v.nom} - CT ${jours < 0 ? "expiré" : `dans ${jours}j`}`,
          urgent: jours < 0,
        });
      }
    }

    // 2. BC en retard
    const bcs = await queries.listBonsCommande(societeId, { enRetard: true });
    for (const bc of bcs) {
      notifications.push({
        id: `bc_retard_${bc.id}`,
        type: "bonCommande",
        message: `BC ${bc.numero_bc} - Échéance dépassée`,
        urgent: true,
      });
    }

    // 3. Documents légaux - Expiration
    const docs = await queries.listDocuments(societeId);
    for (const d of docs) {
      if (!d.date_expiration) continue;
      const jours = Math.ceil(
        (new Date(d.date_expiration).getTime() - new Date().getTime()) /
          (1000 * 60 * 60 * 24)
      );
      if (jours <= 30) {
        notifications.push({
          id: `doc_${d.id}`,
          type: "document",
          message: `${d.nom} - ${jours < 0 ? "expiré" : `expire dans ${jours}j`}`,
          urgent: jours < 0,
        });
      }
    }

    console.log(`📢 ${notifications.length} notifications calculées`);
  } catch (err) {
    console.error("Erreur calcul notifications:", err);
  }

  return notifications;
}

// ============ EXPORT & BACKUP ============

/**
 * Exporter les données d'une société pour sauvegarde
 */
export async function sauvegarderSociete(societeId: string): Promise<Blob> {
  const data = await queries.loadAllData(societeId);

  const json = {
    version: 1,
    exportedAt: new Date().toISOString(),
    societeId,
    ...data,
  };

  const blob = new Blob([JSON.stringify(json, null, 2)], {
    type: "application/json",
  });

  console.log(
    `✅ Sauvegarde créée: ${(blob.size / 1024).toFixed(2)}KB`
  );
  return blob;
}
