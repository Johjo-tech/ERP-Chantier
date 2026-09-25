/**
 * Des lignes de la base à la charge EN 16931 (port de `preparerEmission`,
 * src/api/operations/efacture.ts, sans l'accès base — `api/emission.ts` lit,
 * ce module traduit).
 *
 * L'identité de l'émetteur et du destinataire FIGÉE sur la facture fait foi :
 * une facture émise l'an dernier se retransmet avec l'adresse qu'elle portait
 * alors. Les réglages et la fiche ne servent que de repli.
 */
import Big from "big.js";
import { completerAdresse } from "./adresse";
import type { CadreFacturation } from "./cadre";
import {
  chargeEN16931,
  manquesPourEmettre,
  type ChargeEN16931,
  type EntiteEN16931,
  type FactureEN16931,
  type LigneEN16931,
  type ManqueEN16931,
} from "./norme";

export interface FactureSource {
  numero: string | null;
  date: string | null;
  echeance: string | null;
  date_livraison: string | null;
  date_fin_execution: string | null;
  devise: string | null;
  type_document: string | null;
  cadre_facturation: CadreFacturation | null;
  emetteur_nom: string | null;
  emetteur_siren: string | null;
  emetteur_siret: string | null;
  emetteur_tva_intracom: string | null;
  emetteur_adresse: string | null;
  emetteur_code_postal: string | null;
  emetteur_ville: string | null;
  emetteur_pays_code: string | null;
  client_nom: string | null;
  client_siren: string | null;
  client_siret: string | null;
  client_tva_intracom: string | null;
  client_pays_code: string | null;
  client_code_service: string | null;
  facturation_adresse: string | null;
  facturation_code_postal: string | null;
  facturation_ville: string | null;
  facturation_pays_code: string | null;
  adresse: string | null;
  code_postal: string | null;
  ville: string | null;
  ref_bon_commande_client: string | null;
  ref_contrat: string | null;
  conditions_reglement: string | null;
  penalites_retard: string | null;
  indemnite_recouvrement: number | null;
  escompte_pourcentage: number | null;
  remise_pourcentage: number | null;
  acomptes_deduits: number | null;
  tva_motif_exoneration: string | null;
  motif_rectification: string | null;
  total_ht: number | null;
  total_tva: number | null;
  total_ttc: number | null;
}

export interface LigneSource {
  type: string | null;
  designation: string | null;
  quantite: number | null;
  prix_unitaire: number | null;
  montant_ht: number | null;
  tva: number | null;
  unite: string | null;
  unite_code: string | null;
  tva_categorie: string | null;
  tva_motif_exoneration: string | null;
  article_reference: string | null;
}

export interface SocieteSource {
  nom: string;
  raison_sociale_legale: string | null;
  siret: string | null;
  siren: string | null;
  tva_intracom: string | null;
  adresse: string | null;
  code_postal: string | null;
  ville: string | null;
  pays_code: string | null;
  iban: string | null;
  bic: string | null;
  indemnite_recouvrement: number | null;
  mention_penalites_retard: string | null;
  adresse_electronique_schema: string | null;
  adresse_electronique_valeur: string | null;
}

export interface ClientSource {
  nom: string;
  siren: string | null;
  siret: string | null;
  tva_intracom: string | null;
  adresse: string | null;
  code_postal: string | null;
  ville: string | null;
  pays_code: string | null;
  adresse_electronique_schema: string | null;
  adresse_electronique_valeur: string | null;
  reference_acheteur: string | null;
  cadre_facturation: CadreFacturation | null;
}

export interface SourcesEmission {
  facture: FactureSource;
  lignes: readonly LigneSource[];
  societe: SocieteSource | null;
  client: ClientSource | null;
  /** `v_facture_totaux` : 351 factures sur 410 ont leurs colonnes `total_*` à zéro. */
  totaux: { ht: number | null; tva: number | null; ttc: number | null } | null;
  /** `v_facture_solde.paye` — les règlements, comptés PAR LA BASE (EFA-22). */
  paye: number | null;
  rectifiee: { numero: string | null; date: string | null } | null;
}

export interface DossierEmission {
  charge: ChargeEN16931;
  manques: ManqueEN16931[];
}

/** Chapitres, titres et commentaires n'ont pas de montant à facturer. */
export function estLigneFacturable(l: Pick<LigneSource, "type">): boolean {
  const type = String(l.type ?? "ligne").toLowerCase();
  return type !== "chapitre" && type !== "commentaire" && type !== "titre";
}

export function versLigne(l: LigneSource): LigneEN16931 {
  const quantite = Number(l.quantite ?? 0) || 0;
  const prix = Number(l.prix_unitaire ?? 0) || 0;
  return {
    designation: l.designation,
    quantite,
    prixUnitaire: prix,
    // `montant_ht` peut manquer sur les lignes reprises : il se recalcule.
    montantHt: l.montant_ht != null ? Number(l.montant_ht) : Number(new Big(quantite).times(prix)),
    tva: Number(l.tva ?? 0) || 0,
    unite: l.unite,
    uniteCode: l.unite_code,
    tvaCategorie: l.tva_categorie,
    tvaMotifExoneration: l.tva_motif_exoneration,
    articleReference: l.article_reference,
  };
}

export function versEmetteur(f: FactureSource, s: SocieteSource | null): EntiteEN16931 {
  return {
    nom: f.emetteur_nom ?? s?.raison_sociale_legale ?? s?.nom ?? null,
    siren: f.emetteur_siren ?? s?.siren ?? null,
    siret: f.emetteur_siret ?? s?.siret ?? null,
    tvaIntracom: f.emetteur_tva_intracom ?? s?.tva_intracom ?? null,
    adresse: f.emetteur_adresse ?? s?.adresse ?? null,
    codePostal: f.emetteur_code_postal ?? s?.code_postal ?? null,
    ville: f.emetteur_ville ?? s?.ville ?? null,
    paysCode: f.emetteur_pays_code ?? s?.pays_code ?? null,
    adresseElectroniqueSchema: s?.adresse_electronique_schema ?? null,
    adresseElectroniqueValeur: s?.adresse_electronique_valeur ?? null,
  };
}

export function versDestinataire(f: FactureSource, c: ClientSource | null): EntiteEN16931 {
  const adresse = completerAdresse({
    adresse: f.facturation_adresse ?? f.adresse ?? c?.adresse ?? null,
    codePostal: f.facturation_code_postal ?? f.code_postal ?? c?.code_postal ?? null,
    ville: f.facturation_ville ?? f.ville ?? c?.ville ?? null,
  });
  return {
    nom: f.client_nom ?? c?.nom ?? null,
    siren: f.client_siren ?? c?.siren ?? null,
    siret: f.client_siret ?? c?.siret ?? null,
    tvaIntracom: f.client_tva_intracom ?? c?.tva_intracom ?? null,
    adresse: adresse.rue,
    codePostal: adresse.codePostal,
    ville: adresse.ville,
    paysCode: f.facturation_pays_code ?? f.client_pays_code ?? c?.pays_code ?? null,
    adresseElectroniqueSchema: c?.adresse_electronique_schema ?? null,
    adresseElectroniqueValeur: c?.adresse_electronique_valeur ?? null,
    /* La FICHE d'abord : `factures.cadre_facturation` vaut « entreprise » par
       défaut sur toutes les factures antérieures au jour où on l'a écrit, et ne
       distingue pas « enregistré comme entreprise » de « jamais renseigné ». */
    cadreFacturation: c?.cadre_facturation ?? f.cadre_facturation ?? null,
  };
}

function donneesFacture(src: SourcesEmission): FactureEN16931 {
  const { facture: f, societe: s, client: c, totaux: t } = src;
  return {
    numero: f.numero,
    date: f.date,
    echeance: f.echeance,
    dateLivraison: f.date_livraison ?? f.date_fin_execution ?? f.date,
    devise: f.devise,
    typeDocument: f.type_document,
    factureRectifieeNumero: src.rectifiee?.numero ?? null,
    factureRectifieeDate: src.rectifiee?.date ?? null,
    // BT-10 : la référence que l'acheteur exige de voir sur ses factures.
    referenceAcheteur: c?.reference_acheteur ?? f.client_code_service ?? null,
    refBonCommandeClient: f.ref_bon_commande_client,
    refContrat: f.ref_contrat,
    conditionsReglement: f.conditions_reglement,
    penalitesRetard: f.penalites_retard,
    indemniteRecouvrement: f.indemnite_recouvrement ?? s?.indemnite_recouvrement ?? null,
    escomptePourcentage: f.escompte_pourcentage,
    remisePourcentage: f.remise_pourcentage,
    acomptesDeduits: f.acomptes_deduits,
    montantRegle: Math.max(0, Number(src.paye ?? 0) || 0),
    totalHt: Number(t?.ht ?? f.total_ht ?? 0) || 0,
    totalTva: Number(t?.tva ?? f.total_tva ?? 0) || 0,
    totalTtc: Number(t?.ttc ?? f.total_ttc ?? 0) || 0,
    // Le motif de rectification justifie l'avoir ; la norme ne lui donne pas de champ.
    mentionsComplementaires: [f.tva_motif_exoneration, f.motif_rectification, s?.mention_penalites_retard].filter(
      (m): m is string => !!m && !!m.trim()
    ),
  };
}

/** La charge ET ce qui l'empêche : refuser sans montrer oblige à deviner. */
export function preparerDossier(src: SourcesEmission): DossierEmission {
  const emetteur = versEmetteur(src.facture, src.societe);
  const destinataire = versDestinataire(src.facture, src.client);
  const lignes = src.lignes.filter(estLigneFacturable).map(versLigne);
  const donnees = donneesFacture(src);
  return {
    charge: chargeEN16931(donnees, emetteur, destinataire, lignes, { iban: src.societe?.iban, bic: src.societe?.bic, titulaire: emetteur.nom }),
    manques: manquesPourEmettre(donnees, emetteur, destinataire, lignes),
  };
}
