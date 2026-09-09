/**
 * Assemble la charge EN 16931 d'une facture réelle.
 *
 * Les règles vivent dans `regles-en16931` — elles ne connaissent ni la base ni
 * le réseau. Ce module fait le pont : il lit la facture, ses lignes, son client
 * et la société, puis les traduit dans la sémantique de la norme.
 *
 * Un point mérite d'être dit : l'identité de l'émetteur est **figée sur la
 * facture** au moment de l'émission (`emetteur_nom`, `emetteur_siret`…). C'est
 * elle qui fait foi, pas les réglages du jour — une facture émise l'an dernier
 * doit se retransmettre avec l'adresse qu'elle portait alors. Les réglages ne
 * servent que de repli, pour un document qui n'aurait pas encore été émis.
 */

import { supabase, SupabaseError } from "../client";
import * as queries from "../queries";
import { calculerSoldeFacture } from "./workflows";
import {
  chargeEN16931,
  manquesPourEmettre,
  type EntiteEN16931,
  type FactureEN16931,
  type LigneEN16931,
  type ManqueEN16931,
} from "../regles-en16931";
import type { Facture, FactureLigne, Uuid } from "../types";

/** Lignes de commentaire ou de chapitre : elles n'ont pas de montant à facturer. */
function estLigneFacturable(l: FactureLigne): boolean {
  const type = String(l.type ?? "ligne").toLowerCase();
  return type !== "chapitre" && type !== "commentaire" && type !== "titre";
}

function versLigne(l: FactureLigne): LigneEN16931 {
  const quantite = Number(l.quantite ?? 0) || 0;
  const prix = Number(l.prix_unitaire ?? 0) || 0;
  return {
    designation: l.designation,
    quantite,
    prixUnitaire: prix,
    // `montant_ht` peut manquer sur les lignes reprises : on le recalcule.
    montantHt: l.montant_ht != null ? Number(l.montant_ht) : quantite * prix,
    tva: Number(l.tva ?? 0) || 0,
    unite: l.unite,
    uniteCode: l.unite_code,
    tvaCategorie: l.tva_categorie,
    tvaMotifExoneration: l.tva_motif_exoneration,
    articleReference: l.article_reference,
  };
}

/**
 * L'émetteur tel que la facture le fige, à défaut tel que la société le déclare.
 */
function versEmetteur(
  facture: Facture,
  societe: { nom: string; raison_sociale_legale: string | null; siret: string | null;
    siren: string | null; tva_intracom: string | null; adresse: string | null;
    code_postal: string | null; ville: string | null; pays_code: string | null;
    adresse_electronique_schema: string | null; adresse_electronique_valeur: string | null } | null
): EntiteEN16931 {
  return {
    nom: facture.emetteur_nom ?? societe?.raison_sociale_legale ?? societe?.nom ?? null,
    siren: facture.emetteur_siren ?? societe?.siren ?? null,
    siret: facture.emetteur_siret ?? societe?.siret ?? null,
    tvaIntracom: facture.emetteur_tva_intracom ?? societe?.tva_intracom ?? null,
    adresse: facture.emetteur_adresse ?? societe?.adresse ?? null,
    codePostal: facture.emetteur_code_postal ?? societe?.code_postal ?? null,
    ville: facture.emetteur_ville ?? societe?.ville ?? null,
    paysCode: facture.emetteur_pays_code ?? societe?.pays_code ?? null,
    adresseElectroniqueSchema: societe?.adresse_electronique_schema ?? null,
    adresseElectroniqueValeur: societe?.adresse_electronique_valeur ?? null,
  };
}

/** Le destinataire, figé de même sur la facture quand elle l'est. */
function versDestinataire(
  facture: Facture,
  client: {
    nom: string; siren: string | null; siret: string | null; tva_intracom: string | null;
    adresse: string | null; code_postal: string | null; ville: string | null;
    pays_code: string | null; adresse_electronique_schema: string | null;
    adresse_electronique_valeur: string | null; reference_acheteur: string | null;
  } | null
): EntiteEN16931 {
  return {
    nom: facture.client_nom ?? client?.nom ?? null,
    siren: facture.client_siren ?? client?.siren ?? null,
    siret: facture.client_siret ?? client?.siret ?? null,
    tvaIntracom: facture.client_tva_intracom ?? client?.tva_intracom ?? null,
    adresse: facture.facturation_adresse ?? facture.adresse ?? client?.adresse ?? null,
    codePostal: facture.facturation_code_postal ?? facture.code_postal ?? client?.code_postal ?? null,
    ville: facture.facturation_ville ?? facture.ville ?? client?.ville ?? null,
    paysCode: facture.facturation_pays_code ?? facture.client_pays_code ?? client?.pays_code ?? null,
    adresseElectroniqueSchema: client?.adresse_electronique_schema ?? null,
    adresseElectroniqueValeur: client?.adresse_electronique_valeur ?? null,
  };
}

export interface DossierEmission {
  charge: ReturnType<typeof chargeEN16931>;
  manques: ManqueEN16931[];
}

/**
 * Prépare l'émission d'une facture : la charge, et ce qui l'empêche.
 *
 * Les deux sont rendus ensemble à dessein. L'écran doit pouvoir montrer le
 * document tel qu'il partirait *et* la liste de ce qui manque : refuser sans
 * montrer oblige à deviner.
 */
export async function preparerEmission(factureId: Uuid): Promise<DossierEmission> {
  const facture = await queries.getFacture(factureId);
  if (!facture) throw new Error("Facture introuvable.");

  const lignes = (await queries.listFactureLignes(factureId)).filter(estLigneFacturable);

  const { data: societe, error: errSociete } = await supabase
    .from("societes")
    .select(
      "nom, raison_sociale_legale, siret, siren, tva_intracom, adresse, code_postal, ville, pays_code, iban, bic, indemnite_recouvrement, mention_penalites_retard, adresse_electronique_schema, adresse_electronique_valeur"
    )
    .eq("id", facture.societe_id)
    .maybeSingle();
  if (errSociete) throw new SupabaseError("Société indisponible", errSociete.code, errSociete);

  let client = null;
  if (facture.client_id) {
    const { data } = await supabase
      .from("clients")
      .select(
        "nom, siren, siret, tva_intracom, adresse, code_postal, ville, pays_code, adresse_electronique_schema, adresse_electronique_valeur, reference_acheteur"
      )
      .eq("id", facture.client_id)
      .maybeSingle();
    client = data;
  }

  const emetteur = versEmetteur(facture, societe);
  const destinataire = versDestinataire(facture, client);
  const lignesEN = lignes.map(versLigne);

  /* Les totaux vivent dans `v_facture_totaux`, pas dans les colonnes : sur 410
     factures, 351 ont leurs colonnes à zéro alors que la vue calcule le vrai
     montant. Les lire là où ils ne sont pas aurait transmis des factures à
     0,00 € — c'est la base qui fait autorité sur ce qui engage. */
  const totaux = await queries.getFactureTotaux(factureId);
  const totalHt = Number(totaux?.ht ?? facture.total_ht ?? 0) || 0;
  const totalTva = Number(totaux?.tva ?? facture.total_tva ?? 0) || 0;
  const totalTtc = Number(totaux?.ttc ?? facture.total_ttc ?? 0) || 0;

  const solde = await calculerSoldeFacture(factureId).catch(() => null);

  const donnees: FactureEN16931 = {
    numero: facture.numero,
    date: facture.date,
    echeance: facture.echeance,
    dateLivraison: facture.date_livraison ?? facture.date_fin_execution ?? facture.date,
    devise: facture.devise,
    typeDocument: facture.type_document,
    // BT-10 : la référence que l'acheteur exige de voir sur ses factures.
    referenceAcheteur: client?.reference_acheteur ?? facture.client_code_service ?? null,
    refBonCommandeClient: facture.ref_bon_commande_client,
    refContrat: facture.ref_contrat,
    conditionsReglement: facture.conditions_reglement,
    penalitesRetard: facture.penalites_retard,
    indemniteRecouvrement: facture.indemnite_recouvrement ?? societe?.indemnite_recouvrement,
    escomptePourcentage: facture.escompte_pourcentage,
    acomptesDeduits: facture.acomptes_deduits,
    // Le solde dit ce qui reste dû ; l'écart au total dit ce qui a été encaissé.
    montantRegle: solde == null ? 0 : Math.max(0, totalTtc - Number(solde)),
    totalHt,
    totalTva,
    totalTtc,
    mentionsComplementaires: [facture.tva_motif_exoneration, societe?.mention_penalites_retard]
      .filter((m): m is string => !!m && !!m.trim()),
  };

  return {
    charge: chargeEN16931(donnees, emetteur, destinataire, lignesEN, {
      iban: societe?.iban,
      bic: societe?.bic,
      titulaire: emetteur.nom,
    }),
    manques: manquesPourEmettre(donnees, emetteur, destinataire, lignesEN),
  };
}
