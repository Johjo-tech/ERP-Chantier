/**
 * L'import de clients : du fichier lu jusqu'à l'écriture.
 *
 * Calqué sur `catalogue.ts`, et pour les mêmes raisons : la société vient de
 * la session, l'écran n'a pas à la passer et ne peut donc pas se tromper de
 * cloisonnement ; la lecture du fichier vit dans un module de règles sans base
 * ni DOM ; l'écran ne fait que déclencher.
 *
 * ── CE QUI SE PASSE À L'APERÇU, ET POURQUOI LÀ ─────────────────────────────
 * L'annuaire est interrogé AVANT toute écriture, pas pendant. C'est ce qui
 * permet de montrer « voici ce que je vais corriger » plutôt que « voici ce
 * que j'ai corrigé » — on ne juge pas d'un écrasement qu'on ne voit pas.
 *
 * Trente-neuf appels espacés font une dizaine de secondes : sans avancement
 * l'écran paraîtrait figé, d'où `onProgress`, qui n'est pas décoratif.
 */

import * as queries from "@/api/queries";
import {
  analyserExportClients,
  cleSiret,
  rapprocher,
  type ClientImporte,
  type ClientRapprochable,
  type RapportImportClients,
} from "@/api/regles-import-clients";
import {
  adresseElectroniqueParDefaut,
  cadreSuggere,
  CADRE_DEFAUT,
  CLE_DELAI_PAR_CADRE,
  delaiDeLaCle,
  relveDeLaFactureElectronique,
  type CadreFacturation,
} from "@/api/regles-efacture";
import type { ClientInsert, ClientUpdate, Uuid } from "@/api/types";
import { societeActive } from "./session";
import { rechercherEntreprise, type EtablissementTrouve } from "./entreprise";

function societeUuid(): Uuid {
  const societe = societeActive();
  if (!societe) throw new Error("Aucune société active : impossible d'importer des clients.");
  return societe.uuid;
}

/** Une correction que l'annuaire apporte, montrée avant d'être écrite. */
export interface Correction {
  nom: string;
  champ: string;
  avant: string;
  apres: string;
}

export interface LigneApercu {
  ligne: number;
  nom: string;
  cadre: CadreFacturation;
  /** `null` pour une création. */
  idExistant: string | null;
  rapprochePar: "siret" | "nom" | null;
  ambigu: string[] | null;
  valeurs: Record<string, unknown>;
}

export interface ApercuImportClients {
  aCreer: number;
  aMettreAJour: number;
  ambigus: { nom: string; homonymes: string[] }[];
  annuaire: { interroges: number; repondus: number; muets: number; quota: boolean };
  corrections: Correction[];
  cadres: Record<string, { compte: number; noms: string[] }>;
  lignes: LigneApercu[];
}

/** Ce que l'annuaire a répondu pour une ligne, ou pourquoi il s'est tu. */
interface Reponse {
  etablissement: EtablissementTrouve | null;
  formeJuridique: string;
  quota: boolean;
  muet: boolean;
}

async function interrogerPour(c: ClientImporte): Promise<Reponse> {
  /* AUCUN appel par le nom. Le formulaire a déjà tranché ce point : « laurent
     johan » sortait cinq établissements avec leur SIRET, prêts à être choisis
     pour quelqu'un qui n'en a aucun. Pas d'immatriculation, pas d'appel. */
  const saisie = c.siret ?? c.siren;
  if (!saisie) return { etablissement: null, formeJuridique: "", quota: false, muet: false };

  const res = await rechercherEntreprise(saisie);
  if (res.type === "siret") {
    return {
      etablissement: res.etablissement,
      formeJuridique: res.formeJuridique || res.etablissement.formeJuridique,
      quota: false,
      muet: false,
    };
  }
  if (res.type === "siren") {
    /* Un SIREN peut porter plusieurs établissements ouverts. On ne retient que
       le siège : choisir un autre établissement à la place de l'utilisateur
       reviendrait à décider où il facture. */
    const siege = res.etablissements.find((e) => e.estSiege) ?? null;
    return {
      etablissement: siege,
      formeJuridique: siege?.formeJuridique ?? "",
      quota: false,
      muet: !siege,
    };
  }
  if (res.type === "erreur") {
    return {
      etablissement: null,
      formeJuridique: "",
      quota: res.code === "QUOTA",
      muet: true,
    };
  }
  return { etablissement: null, formeJuridique: "", quota: false, muet: true };
}

/** Le cadre de ce client, et rien d'autre ne le décide. */
function cadreDe(c: ClientImporte, formeJuridique: string): CadreFacturation {
  if (c.sansImmatriculation) return "B2C";
  const suggere = cadreSuggere({ paysCode: c.paysCode, natureJuridique: formeJuridique });
  return suggere ? suggere.cadre : CADRE_DEFAUT;
}

/**
 * Construit ce qui sera écrit, et la liste de ce que l'annuaire change.
 *
 * L'annuaire l'emporte sur l'adresse, le code postal, la ville, le SIREN et la
 * TVA — c'est la décision prise. Il ne renomme JAMAIS un client existant : le
 * nom sert de clé à neuf endroits de l'écran, et écraser une clé étrangère
 * n'est pas la même opération qu'écraser une donnée.
 */
function valeursAEcrire(
  c: ClientImporte,
  rep: Reponse,
  existant: ClientRapprochable | null,
  corrections: Correction[]
): { cadre: CadreFacturation; valeurs: Record<string, unknown> } {
  const e = rep.etablissement;
  const cadre = cadreDe(c, rep.formeJuridique);

  const noter = (champ: string, avant: string | null, apres: string | null) => {
    if (apres && avant && avant !== apres) {
      corrections.push({ nom: c.nom, champ, avant, apres });
    }
  };

  const adresse = e?.adresse || c.adresse;
  const codePostal = e?.codePostal || c.codePostal;
  const ville = e?.ville || c.ville;
  const siren = e?.siren || c.siren;
  const siret = e?.siret || c.siret;

  noter("adresse", c.adresse, adresse);
  noter("code postal", c.codePostal, codePostal);
  noter("ville", c.ville, ville);
  noter("SIREN", c.siren, siren);
  noter("SIRET", c.siret, siret);

  /* La TVA de l'annuaire n'est pas toujours une donnée légale : le module
     retombe sur un CALCUL quand l'annuaire se tait, et un calcul ne peut pas
     deviner qu'une entreprise n'est pas assujettie. Confirmée, elle écrase ;
     calculée, elle ne comble que le vide. */
  let tva = c.tvaIntracom;
  if (e?.tvaIntracom && e.tvaConfirmee) {
    noter("n° de TVA", c.tvaIntracom, e.tvaIntracom);
    tva = e.tvaIntracom;
  } else if (!tva && e?.tvaIntracom) {
    tva = e.tvaIntracom;
  }

  /* Le délai que le cadre appelle, et SEULEMENT si le fichier n'en portait
     pas : un arrangement commercial explicite survit au type de client. */
  let jours = c.delaiPaiementJours;
  let mode = c.delaiPaiementMode;
  if (jours === null) {
    const duCadre = delaiDeLaCle(CLE_DELAI_PAR_CADRE[cadre]);
    if (duCadre) {
      jours = duCadre.jours;
      mode = duCadre.mode;
    }
  }

  const routage = relveDeLaFactureElectronique(cadre)
    ? adresseElectroniqueParDefaut({ siret, siren })
    : null;

  const valeurs: Record<string, unknown> = {
    adresse,
    code_postal: codePostal,
    ville,
    pays_code: c.paysCode,
    email: c.email,
    telephone: c.telephone,
    siret,
    siren,
    tva_intracom: tva,
    cadre_facturation: cadre,
    delai_paiement_jours: jours,
    delai_paiement_mode: mode,
    facturation_adresse: c.facturationAdresse,
    facturation_code_postal: c.facturationCodePostal,
    facturation_ville: c.facturationVille,
    notes: c.notes,
    adresse_electronique_schema: routage?.schema ?? null,
    adresse_electronique_valeur: routage?.valeur ?? null,
    /* Trois colonnes que rien n'écrit encore et que personne ne lit : elles
       consignent ce que l'annuaire a dit, et quand. Utile le jour où une
       société radiée ressurgit dans un devis. */
    eligibilite_statut: e ? (e.active ? "active" : "radiee") : null,
    eligibilite_message: e && !e.active ? `Radiée le ${e.dateFermeture || "?"}` : null,
    eligibilite_verifie_le: e ? new Date().toISOString() : null,
  };

  // Le nom : celui de l'annuaire pour une création, jamais pour un existant.
  if (!existant) valeurs.nom = e?.nom || c.nom;

  return { cadre, valeurs };
}

/**
 * Lit le fichier, interroge l'annuaire, et rend ce qui sera écrit.
 *
 * Rien n'est écrit ici. `onProgress` suit les appels réseau, pas les lignes :
 * c'est lui qui prend du temps.
 */
export async function previsualiserImportClients(
  rapport: RapportImportClients,
  onProgress?: (fait: number, total: number) => void
): Promise<ApercuImportClients> {
  const existants = (await queries.clientsRapprochables(societeUuid())) as ClientRapprochable[];

  const corrections: Correction[] = [];
  const lignes: LigneApercu[] = [];
  const ambigus: { nom: string; homonymes: string[] }[] = [];
  const cadres: Record<string, { compte: number; noms: string[] }> = {};
  let interroges = 0;
  let repondus = 0;
  let muets = 0;
  let quota = false;

  const aInterroger = rapport.clients.filter((c) => c.siret || c.siren).length;
  let faits = 0;

  for (const c of rapport.clients) {
    let rep: Reponse = { etablissement: null, formeJuridique: "", quota: false, muet: false };
    if (c.siret || c.siren) {
      interroges++;
      rep = await interrogerPour(c);
      if (rep.etablissement) repondus++;
      else muets++;
      if (rep.quota) quota = true;
      faits++;
      onProgress?.(faits, aInterroger);
    }

    const r = rapprocher(c, existants);
    if (r.type === "ambigu") {
      ambigus.push({ nom: c.nom, homonymes: r.homonymes.map((h) => h.nom) });
      lignes.push({
        ligne: c.ligne,
        nom: c.nom,
        cadre: cadreDe(c, rep.formeJuridique),
        idExistant: null,
        rapprochePar: null,
        ambigu: r.homonymes.map((h) => h.nom),
        valeurs: {},
      });
      continue;
    }

    const existant = r.type === "miseAJour" ? r.existant : null;
    const { cadre, valeurs } = valeursAEcrire(c, rep, existant, corrections);

    const seau = (cadres[cadre] ??= { compte: 0, noms: [] });
    seau.compte++;
    seau.noms.push(c.nom);

    lignes.push({
      ligne: c.ligne,
      nom: c.nom,
      cadre,
      idExistant: existant?.id ?? null,
      rapprochePar: r.type === "miseAJour" ? r.par : null,
      ambigu: null,
      valeurs,
    });
  }

  return {
    aCreer: lignes.filter((l) => !l.idExistant && !l.ambigu).length,
    aMettreAJour: lignes.filter((l) => l.idExistant).length,
    ambigus,
    annuaire: { interroges, repondus, muets, quota },
    corrections,
    cadres,
    lignes,
  };
}

/** Écrit ce que l'aperçu a montré. Les lignes ambiguës sont laissées de côté. */
export function importerClients(apercu: ApercuImportClients) {
  const aCreer = apercu.lignes
    .filter((l) => !l.idExistant && !l.ambigu)
    .map((l) => l.valeurs as Omit<ClientInsert, "societe_id">);
  const aMettreAJour = apercu.lignes
    .filter((l) => l.idExistant)
    .map((l) => ({ id: l.idExistant as Uuid, valeurs: l.valeurs as ClientUpdate }));

  return queries.importerClients(societeUuid(), aCreer, aMettreAJour);
}

export function injecterImportClients() {
  const w = window as unknown as Record<string, unknown>;
  w.lireExportClients = (donnees: ArrayBuffer | Uint8Array) => analyserExportClients(donnees);
  w.previsualiserImportClients = previsualiserImportClients;
  w.ecrireImportClients = importerClients;
  /* `cleSiret` sert à l'écran pour afficher un numéro normalisé sans en
     redéfinir la règle. */
  w.cleSiret = cleSiret;
}
