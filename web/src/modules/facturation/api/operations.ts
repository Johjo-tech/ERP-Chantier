import { todayISO } from "@/lib/dates";
import { montant } from "@/lib/money";
import { supabase } from "@/lib/supabase";
import { lireClient } from "@/modules/clients/api/clients";
import { dateEcheance, delaiPaiementRetenu, libelleDelaiPaiement } from "@/modules/clients/domain/delais";
import { lireDevis } from "@/modules/devis/api/devis";
import { depuisBase, lignesPourEnregistrement, type LigneAEnregistrer } from "@/modules/documents/domain/lignes";
import { chargerReglages } from "@/modules/societes/api/reglages";
import { refusAvoir } from "../domain/avoir";
import { copieDeFacture, refusDuplication } from "../domain/duplication";
import { designationSituation, refusSituation, type LigneSituation } from "../domain/situation";
import { creerFacture, etablirAvoirEnBase, lireFacture, listerFactures } from "./factures";

/** Délai, libellé et échéance d'une nouvelle facture : client, sinon société, sinon 30 j net. */
export async function conditions(societeId: string, clientId: string | null, date: string) {
  const [client, reglages] = await Promise.all([clientId ? lireClient(clientId) : null, chargerReglages(societeId)]);
  const delai = delaiPaiementRetenu(client, { delai_paiement_jours: reglages.delaiPaiementJours, delai_paiement_mode: reglages.modeDelaiPaiement });
  return {
    delai_paiement_jours: delai.jours,
    delai_paiement_mode: delai.mode,
    conditions_reglement: libelleDelaiPaiement(delai),
    echeance: dateEcheance(date, delai) || null,
    mode_paiement: client?.mode_paiement ?? null,
    cadre_facturation: client?.cadre_facturation ?? "B2B_national",
  };
}

const copieDesLignes = (lignes: Parameters<typeof depuisBase>[0][]): LigneAEnregistrer[] =>
  lignesPourEnregistrement(lignes.map(depuisBase).map((l) => ({ ...l, id: null }))).lignes;

/** Devis → facture BROUILLON (DEV-13) ; refus si une facture porte déjà ce devis. */
export async function factureDepuisDevis(societeId: string, devisId: string): Promise<string> {
  const deja = await listerFactures(societeId, { devisId });
  if (deja.length) throw { code: "P0001", message: `Ce devis est déjà facturé (${deja[0]?.numero || "brouillon en cours"}).` };
  const d = await lireDevis(devisId);
  const date = todayISO();
  const { id: _i, societe_id: _s, numero: _n, statut: _st, lignes, conducteur: _c, telephone_locataire: _t, ...entete } = d;
  return creerFacture(societeId, { ...entete, date, devis_id: devisId, ...(await conditions(societeId, d.client_id, date)) }, copieDesLignes(lignes));
}

/** Dupliquer (FAC-07) : un nouveau brouillon daté du jour, liens d'origine coupés, échéance recalculée. */
export async function dupliquerFacture(societeId: string, factureId: string): Promise<string> {
  const f = await lireFacture(factureId);
  const refus = refusDuplication(f);
  if (refus) throw { code: "P0001", message: refus };
  return creerFacture(societeId, copieDeFacture(f, todayISO()), copieDesLignes(f.lignes));
}

/**
 * Avoir sur une facture émise : mêmes lignes (positives, le type donne le
 * sens), l'émetteur DE LA FACTURE D'ORIGINE, puis émission immédiate —
 * numéroté dans la série « AV » par la base, comme dans l'ancienne app. Le
 * refus se lit d'abord ici, pour un message sans aller-retour ; la base refait
 * les mêmes contrôles et fait le reste d'un seul geste (D-R4-04).
 */
export async function etablirAvoir(factureId: string, motif: string): Promise<string> {
  const f = await lireFacture(factureId);
  const refus = refusAvoir(f, motif);
  if (refus) throw { code: "P0001", message: refus };
  return etablirAvoirEnBase(factureId, motif.trim());
}

/**
 * Situation de travaux sur le DPGF d'un chantier.
 *
 * L'ancien écran écrivait l'avancement AVANT la facture, sans contrôle : une
 * facture refusée consommait l'avancement sans rien facturer (FAC-97). Ici :
 * la facture (brouillon) d'abord, puis la trace par ligne
 * (`chantier_avancement_factures`, jamais écrite par l'ancien écran), puis le
 * cumul du DPGF. Un échec en route laisse au pire un brouillon à supprimer,
 * jamais un avancement sans facture.
 */
export async function facturerSituation(
  societeId: string,
  chantier: { id: string; nom: string; client_id: string | null; client_nom: string | null; adresse: string | null; code_postal: string | null; ville: string | null },
  lignes: readonly LigneSituation[],
  tvaDefaut: number
): Promise<string> {
  const refus = refusSituation(lignes);
  if (refus) throw { code: "P0001", message: refus };
  const utiles = lignes.filter((l) => l.aFacturer.gt(0));
  const date = todayISO();
  const client = chantier.client_id ? await lireClient(chantier.client_id) : null;
  const lignesFacture: LigneAEnregistrer[] = utiles.map((l, position) => ({
    id: null,
    position,
    type: "ligne",
    designation: designationSituation(l.designation, l.avant, l.apres),
    quantite: 1,
    prix_unitaire: Number(l.aFacturer.toString()),
    unite: null,
    tva: tvaDefaut,
    article_reference: null,
    commentaire: null,
    metier: null,
    montant_ht: Number(l.aFacturer.toString()),
  }));
  const factureId = await creerFacture(
    societeId,
    {
      client_id: chantier.client_id,
      client_nom: client?.nom ?? chantier.client_nom ?? chantier.nom,
      adresse: client?.adresse ?? null,
      chantier_id: chantier.id,
      adresse_locataire: chantier.adresse,
      code_postal: chantier.code_postal,
      ville: chantier.ville,
      date,
      remise_pourcentage: 0,
      ...(await conditions(societeId, chantier.client_id, date)),
    },
    lignesFacture
  );
  const db = supabase();
  // Cumul du DPGF, ligne par ligne, CONDITIONNÉ à l'avancement lu : si un autre
  // onglet a facturé entre-temps, la ligne ne correspond plus et rien n'est
  // écrit deux fois (relecture 2, I-2). Un refus défait ce qui précède.
  const faits: LigneSituation[] = [];
  for (const l of utiles) {
    const { data, error } = await db
      .from("chantier_dpgf_lignes")
      .update({ avancement_cumule: Number(l.apres.toString()) })
      .eq("id", l.dpgfId)
      .eq("avancement_cumule", Number(l.avant.toString()))
      .select("id");
    if (error || !data?.length) {
      await defaireSituation(factureId, faits);
      throw error ?? (await motifAvancementRefuse(l));
    }
    faits.push(l);
  }
  const trace = await db.from("chantier_avancement_factures").insert(
    utiles.map((l) => ({
      facture_id: factureId,
      dpgf_ligne_id: l.dpgfId,
      avancement_avant: Number(l.avant.toString()),
      avancement_apres: Number(l.apres.toString()),
      montant_facture: Number(montant(l.aFacturer).toString()),
    }))
  );
  if (trace.error) {
    await defaireSituation(factureId, faits);
    throw trace.error;
  }
  return factureId;
}

/**
 * Zéro ligne touchée ne veut pas toujours dire « facturée entre-temps » : sans
 * « chantiers / modifier », la RLS cache la ligne du DPGF — la secrétaire se
 * voyait annoncer une course qui n'avait pas eu lieu (relecture 4, I2).
 */
async function motifAvancementRefuse(l: LigneSituation): Promise<{ code: string; message: string }> {
  const { data, error } = await supabase().from("chantier_dpgf_lignes").select("id").eq("id", l.dpgfId).maybeSingle();
  if (error) throw error;
  if (!data) return { code: "42501", message: "Vous n'avez pas le droit de modifier l'avancement du chantier : la situation n'est pas facturée. Demandez-la à un administrateur ou au conducteur." };
  return { code: "P0001", message: `« ${l.designation} » a été facturée entre-temps : rechargez la page avant de recommencer.` };
}

/** Remet le DPGF où il était et supprime le brouillon : une situation ne reste jamais à moitié écrite. */
async function defaireSituation(factureId: string, faits: readonly LigneSituation[]) {
  const db = supabase();
  for (const l of faits) {
    const { error } = await db
      .from("chantier_dpgf_lignes")
      .update({ avancement_cumule: Number(l.avant.toString()) })
      .eq("id", l.dpgfId)
      .eq("avancement_cumule", Number(l.apres.toString()));
    if (error) console.error("Situation : avancement non rétabli", l.dpgfId, error);
  }
  const { error } = await db.from("factures").delete().eq("id", factureId).is("numero", null);
  if (error) console.error("Situation : brouillon non supprimé", factureId, error);
}
