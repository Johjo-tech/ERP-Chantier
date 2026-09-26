import { z } from "zod";
import { supabase, supabasePropositions } from "@/lib/supabase";
import { analyser } from "@/lib/validation";
import { preparerDossier, type DossierEmission, type SourcesEmission } from "../domain/dossier";
import { versCII } from "../domain/cii";

const texte = z.string().nullable();
const nombre = z.number().nullable();
const cadre = z.enum(["B2C", "B2B_national", "B2G", "B2B_international"]).nullable();

const schemaFacture = z.object({
  societe_id: z.string(),
  client_id: texte,
  facture_rectifiee_id: texte,
  numero: texte,
  date: texte,
  echeance: texte,
  date_livraison: texte,
  date_fin_execution: texte,
  devise: texte,
  type_document: texte,
  cadre_facturation: cadre,
  emetteur_nom: texte,
  emetteur_siren: texte,
  emetteur_siret: texte,
  emetteur_tva_intracom: texte,
  emetteur_adresse: texte,
  emetteur_code_postal: texte,
  emetteur_ville: texte,
  emetteur_pays_code: texte,
  client_nom: texte,
  client_siren: texte,
  client_siret: texte,
  client_tva_intracom: texte,
  client_pays_code: texte,
  client_code_service: texte,
  facturation_adresse: texte,
  facturation_code_postal: texte,
  facturation_ville: texte,
  facturation_pays_code: texte,
  adresse: texte,
  code_postal: texte,
  ville: texte,
  ref_bon_commande_client: texte,
  ref_contrat: texte,
  conditions_reglement: texte,
  penalites_retard: texte,
  indemnite_recouvrement: nombre,
  escompte_pourcentage: nombre,
  remise_pourcentage: nombre,
  acomptes_deduits: nombre,
  tva_motif_exoneration: texte,
  motif_rectification: texte,
  total_ht: nombre,
  total_tva: nombre,
  total_ttc: nombre,
});

const schemaLigne = z.object({
  type: texte,
  designation: texte,
  quantite: nombre,
  prix_unitaire: nombre,
  montant_ht: nombre,
  tva: nombre,
  unite: texte,
  unite_code: texte,
  tva_categorie: texte,
  tva_motif_exoneration: texte,
  article_reference: texte,
});

const schemaSociete = z.object({
  nom: z.string(),
  raison_sociale_legale: texte,
  siret: texte,
  siren: texte,
  tva_intracom: texte,
  adresse: texte,
  code_postal: texte,
  ville: texte,
  pays_code: texte,
  iban: texte,
  bic: texte,
  indemnite_recouvrement: nombre,
  mention_penalites_retard: texte,
  adresse_electronique_schema: texte,
  adresse_electronique_valeur: texte,
});

const schemaClient = z.object({
  nom: z.string(),
  siren: texte,
  siret: texte,
  tva_intracom: texte,
  adresse: texte,
  code_postal: texte,
  ville: texte,
  pays_code: texte,
  adresse_electronique_schema: texte,
  adresse_electronique_valeur: texte,
  reference_acheteur: texte,
  cadre_facturation: cadre,
});

const colonnes = (s: z.ZodObject) => Object.keys(s.shape).join(", ");

/**
 * Tout ce que la charge d'une facture demande, lu avec les droits de
 * l'utilisateur. Les totaux et le déjà-réglé viennent des VUES de la base
 * (`v_facture_totaux`, `v_facture_solde`) : rien ne se recalcule ici (EFA-22).
 */
export async function lireSourcesEmission(factureId: string): Promise<SourcesEmission> {
  const db = supabase();
  const brute = await db.from("factures").select(colonnes(schemaFacture)).eq("id", factureId).single();
  if (brute.error) throw brute.error;
  const f = analyser(schemaFacture, brute.data, "facture à émettre");

  const [lignes, societe, client, totaux, solde, rectifiee] = await Promise.all([
    db.from("facture_lignes").select(colonnes(schemaLigne)).eq("facture_id", factureId).order("position"),
    db.from("societes").select(colonnes(schemaSociete)).eq("id", f.societe_id).maybeSingle(),
    f.client_id ? db.from("clients").select(colonnes(schemaClient)).eq("id", f.client_id).maybeSingle() : Promise.resolve({ data: null, error: null }),
    db.from("v_facture_totaux").select("ht, tva, ttc").eq("facture_id", factureId).maybeSingle(),
    supabasePropositions().from("v_facture_solde").select("paye").eq("facture_id", factureId).maybeSingle(),
    f.facture_rectifiee_id ? db.from("factures").select("numero, date").eq("id", f.facture_rectifiee_id).maybeSingle() : Promise.resolve({ data: null, error: null }),
  ]);
  for (const r of [lignes, societe, client, totaux, solde, rectifiee]) if (r.error) throw r.error;

  return {
    facture: f,
    lignes: analyser(z.array(schemaLigne), lignes.data, "lignes de la facture"),
    societe: societe.data ? analyser(schemaSociete, societe.data, "société émettrice") : null,
    client: client.data ? analyser(schemaClient, client.data, "fiche client") : null,
    totaux: totaux.data ? analyser(z.object({ ht: nombre, tva: nombre, ttc: nombre }), totaux.data, "totaux de la facture") : null,
    paye: solde.data ? analyser(z.object({ paye: nombre }), solde.data, "solde de la facture").paye : null,
    rectifiee: rectifiee.data ? analyser(z.object({ numero: texte, date: texte }), rectifiee.data, "facture rectifiée") : null,
  };
}

export async function preparerEmission(factureId: string): Promise<DossierEmission> {
  return preparerDossier(await lireSourcesEmission(factureId));
}

/** Le dépôt peut prendre du temps côté plateforme, mais l'écran doit rendre la main. */
const DELAI_DEPOT_MS = 60_000;

const schemaReponseDepot = z.object({ depose: z.boolean().optional(), identifiant: z.string().optional(), error: z.string().optional() });

/** Un refus déjà rédigé pour l'écran : son message se montre tel quel. */
export class DepotImpossible extends Error {
  override readonly name = "DepotImpossible";
}

async function motifDuRefus(error: unknown): Promise<string | null> {
  const corps: unknown = await (error as { context?: Response }).context?.json?.().catch((e: unknown) => {
    console.warn("Réponse d'erreur de la plateforme illisible :", e);
    return null;
  });
  return typeof corps === "object" && corps && "error" in corps ? String((corps as { error: unknown }).error) : null;
}

/**
 * Dépose la facture par l'Edge Function historique `pdp-emit-invoice`, INCHANGÉE
 * (D-EFA-04) : le document est fabriqué ici — charge puis CII, sous les tests
 * de parité — et la fonction le confronte à la base (numéro, total) avant tout
 * envoi. Rien ne part s'il manque quelque chose : une facture rejetée porte
 * déjà un numéro, mieux vaut la retenir que devoir l'annuler.
 */
export async function deposerFacture(factureId: string): Promise<{ identifiant: string | null }> {
  const { charge, manques } = await preparerEmission(factureId);
  if (manques.length) throw new DepotImpossible(`Transmission impossible : ${manques.map((m) => m.libelle).join(" ")}`);
  const delai = AbortSignal.timeout(DELAI_DEPOT_MS);
  const { data, error } = await supabase().functions.invoke("pdp-emit-invoice", { body: { facture_id: factureId, xml: versCII(charge) }, signal: delai });
  if (error) {
    if (delai.aborted) throw new DepotImpossible("La plateforme n'a pas répondu. Vérifiez dans quelques minutes si la facture a été déposée avant de réessayer.");
    throw new DepotImpossible(`Transmission refusée : ${(await motifDuRefus(error)) ?? "la plateforme n'est pas joignable."}`);
  }
  const reponse = analyser(schemaReponseDepot, data, "réponse de la plateforme");
  if (reponse.error) throw new DepotImpossible(reponse.error);
  if (!reponse.depose) throw new DepotImpossible("La plateforme n'a pas confirmé le dépôt.");
  return { identifiant: reponse.identifiant ?? null };
}
