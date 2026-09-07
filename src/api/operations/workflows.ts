/**
 * Workflows métier
 *
 * Enchaînements que l'app déclenche en un geste : accepter un devis, facturer
 * un bon de commande, encaisser un règlement, planifier par métier…
 */

import { todayISO } from "@/api/client";
import * as queries from "@/api/queries";
import { loadAllData } from "@/integrations/html-adapter";
import type {
  BonCommande,
  Facture,
  FactureComplete,
  Reglement,
  ScheduleParMetier,
  Uuid,
} from "@/api/types";

// ============ FACTURE ← DEVIS ============

/** Devis accepté → facture reprenant l'en-tête et les lignes. */
export async function accepterDevisEtCreerFacture(
  societeId: Uuid,
  devisId: Uuid
): Promise<FactureComplete> {
  await queries.updateDevisStatut(devisId, "accepté");
  const facture = await queries.createFactureFromDevis(societeId, devisId);

  console.log(`✅ Devis ${devisId} accepté → facture ${facture.numero}`);
  return facture;
}

// ============ FACTURE ← BON DE COMMANDE ============

/** Bon de commande reçu → facture. */
export async function facturerBonCommande(
  societeId: Uuid,
  bcId: Uuid,
  dateReception?: string
): Promise<FactureComplete> {
  if (dateReception) await queries.markBCReceived(bcId, dateReception);
  const facture = await queries.createFactureFromBC(societeId, bcId);

  console.log(`✅ BC ${bcId} facturé → ${facture.numero}`);
  return facture;
}

// ============ PLANIFICATION MULTI-MÉTIER ============

export interface PlanningMetier {
  metier: string;
  technicien?: string;
  sousTraitant?: string;
  datePlanifiee?: string;
  datePlanifieeFin?: string;
  heurePlanifiee?: string;
  dureeHeures?: number;
}

/** Affecte un intervenant et un créneau à chaque métier du bon de commande. */
export async function planifierBCMultiMetier(
  bcId: Uuid,
  plannings: PlanningMetier[]
): Promise<BonCommande> {
  const schedule: Record<string, ScheduleParMetier> = {};

  for (const p of plannings) {
    schedule[p.metier] = {
      technicien: p.technicien,
      sous_traitant: p.sousTraitant,
      date_planifiee: p.datePlanifiee,
      date_planifiee_fin: p.datePlanifieeFin,
      heure_planifiee: p.heurePlanifiee,
      duree_heures: p.dureeHeures,
    };
  }

  const bc = await queries.setScheduleParMetier(bcId, schedule);
  console.log(`✅ BC ${bcId} planifié sur ${plannings.length} métier(s)`);
  return bc;
}

// ============ SAV ============

/**
 * Crée un SAV à partir d'un bon de commande.
 *
 * ⚠ Le lien vers le BC d'origine n'est pas persisté : `bons_commande` n'a pas
 * de colonne de rattachement (voir docs/SCHEMA.md).
 */
export async function creerSAV(
  societeId: Uuid,
  bcOrigineId: Uuid,
  probleme: string
): Promise<BonCommande> {
  const sav = await queries.createSAV(societeId, bcOrigineId, probleme);
  console.log(`✅ SAV ${sav.numero_bc} créé depuis le BC ${bcOrigineId}`);
  return sav;
}

// ============ RÈGLEMENT ============

/** Encaisse un règlement et bascule la facture en « payée » si le solde est nul. */
export async function ajouterReglementEtMajStatut(
  societeId: Uuid,
  factureId: Uuid,
  montant: number,
  mode: string,
  date: string,
  reference?: string
): Promise<{ reglement: Reglement; facture: Facture; soldeRestant: number }> {
  const reglement = await queries.addReglement(societeId, {
    facture_id: factureId,
    montant,
    mode,
    date,
    reference,
  });

  const soldeRestant = await calculerSoldeFacture(factureId);

  const facture =
    soldeRestant <= 0
      ? await queries.updateFactureStatut(factureId, "payée")
      : (await queries.getFacture(factureId))!;

  console.log(
    soldeRestant <= 0
      ? `✅ Facture ${factureId} soldée`
      : `✅ Règlement enregistré — reste ${soldeRestant.toFixed(2)} €`
  );

  return { reglement, facture, soldeRestant };
}

/** Total TTC des lignes, remise appliquée, moins les règlements encaissés. */
export async function calculerSoldeFacture(factureId: Uuid): Promise<number> {
  const facture = await queries.getFactureComplete(factureId);
  if (!facture) throw new Error(`Facture ${factureId} introuvable`);

  const totalTTC = facture.lignes.reduce((total, ligne) => {
    if (ligne.type !== "ligne") return total;
    const ht = (ligne.quantite ?? 0) * (ligne.prix_unitaire ?? 0);
    return total + ht * (1 + (ligne.tva ?? 0) / 100);
  }, 0);

  const remise = totalTTC * ((facture.remise_pourcentage ?? 0) / 100);
  const reglements = await queries.listReglementsFacture(factureId);
  const encaisse = reglements.reduce((total, r) => total + (r.montant ?? 0), 0);

  return Number((totalTTC - remise - encaisse).toFixed(2));
}

// ============ RAPPORT D'INTERVENTION ============

/** Complète le rapport puis facture l'intervention. */
export async function completerRapportEtCreerFacture(
  societeId: Uuid,
  interventionId: Uuid,
  constatations: string,
  preconisations: string
): Promise<FactureComplete> {
  const intervention = await queries.updateInterventionRapport(
    interventionId,
    constatations,
    preconisations
  );

  const facture = await queries.createFacture(societeId, {
    client_nom: intervention.client_nom,
    client_id: intervention.client_id,
    interlocuteur: intervention.interlocuteur,
    conducteur: intervention.conducteur,
    date: todayISO(),
    intervention_id: interventionId,
    adresse: intervention.adresse,
    code_postal: intervention.code_postal,
    ville: intervention.ville,
    etage: intervention.etage,
    numero_logement: intervention.numero_logement,
    logement_statut: intervention.logement_statut,
    occupant: intervention.occupant,
    precision_commune: intervention.precision_commune,
  });

  console.log(`✅ Rapport ${interventionId} complété → facture ${facture.numero}`);
  return facture;
}

// ============ CHANTIER ============

/** Clôture un chantier en posant sa date de fin. */
export async function cloturerChantier(chantierId: Uuid, dateCloture: string) {
  const chantier = await queries.getChantier(chantierId);
  if (!chantier) throw new Error(`Chantier ${chantierId} introuvable`);

  const chantierClos = await queries.updateChantier(chantierId, {
    date_fin: dateCloture,
  });

  console.log(`✅ Chantier ${chantier.nom} clôturé au ${dateCloture}`);
  return chantierClos;
}

// ============ NOTIFICATIONS ============

export interface Notification {
  id: string;
  type: string;
  message: string;
  urgent: boolean;
}

function joursAvant(date?: string | null): number | null {
  if (!date) return null;
  const delta = new Date(date).getTime() - Date.now();
  return Math.ceil(delta / (1000 * 60 * 60 * 24));
}

/**
 * Échéances à moins de 30 jours.
 *
 * ⚠ Le contrôle technique des véhicules n'est pas couvert : `vehicules` n'a
 * aucune colonne de date de CT (voir docs/SCHEMA.md).
 */
export async function calculerNotifications(
  societeId: Uuid
): Promise<Notification[]> {
  const notifications: Notification[] = [];

  const pousser = (
    id: string,
    type: string,
    libelle: string,
    date?: string | null
  ) => {
    const jours = joursAvant(date);
    if (jours === null || jours > 30) return;
    notifications.push({
      id,
      type,
      urgent: jours < 0,
      message: `${libelle} — ${jours < 0 ? "expiré" : `dans ${jours} j`}`,
    });
  };

  const [vehicules, documents, salaries] = await Promise.all([
    queries.listVehicules(societeId),
    queries.listDocumentsLegaux(societeId),
    queries.listSalariesComplets(societeId),
  ]);

  for (const v of vehicules) {
    if (v.vendu) continue;
    pousser(
      `veh_carburant_${v.id}`,
      "vehicule",
      `${v.nom} — carte carburant`,
      v.carte_carburant_validite
    );
    pousser(
      `veh_telepeage_${v.id}`,
      "vehicule",
      `${v.nom} — télépéage`,
      v.telepeage_validite
    );
  }

  for (const d of documents) {
    pousser(`doc_${d.id}`, "document", d.nom, d.date_validite);
  }

  for (const s of salaries) {
    if (!s.actif) continue;
    const identite = [s.prenom, s.nom].filter(Boolean).join(" ");
    pousser(
      `btp_${s.id}`,
      "salarie",
      `${identite} — carte BTP`,
      s.carte_btp_validite
    );
    pousser(
      `visite_${s.id}`,
      "salarie",
      `${identite} — visite médicale`,
      s.visite_medicale_prochaine
    );
    for (const h of s.habilitations) {
      pousser(`hab_${h.id}`, "salarie", `${identite} — ${h.nom}`, h.date_expiration);
    }
  }

  console.log(`📢 ${notifications.length} notification(s)`);
  return notifications;
}

// ============ SAUVEGARDE ============

/** Export JSON complet d'une société, désigné par son code court. */
export async function sauvegarderSociete(codeSociete: string): Promise<Blob> {
  const data = await loadAllData(codeSociete);

  const blob = new Blob(
    [
      JSON.stringify(
        { version: 2, exportedAt: new Date().toISOString(), codeSociete, ...data },
        null,
        2
      ),
    ],
    { type: "application/json" }
  );

  console.log(`✅ Sauvegarde : ${(blob.size / 1024).toFixed(2)} Ko`);
  return blob;
}
