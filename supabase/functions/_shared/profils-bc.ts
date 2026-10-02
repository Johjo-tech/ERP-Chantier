/**
 * Ce que chaque bailleur range à sa façon sur ses bons de commande.
 *
 * Le prompt général dit où se trouve d'habitude chaque information. Les retours
 * des utilisateurs, bon par bon, montrent que « d'habitude » ne suffit pas :
 * chez SDH, « Client : » désigne le locataire ; chez Léman Habitat, la
 * « Référence » de l'en-tête est notre propre code fournisseur ; chez SEM4V,
 * l'interlocuteur utile est l'agent de l'état des lieux, pas le gardien.
 * Écrites dans le prompt commun, ces règles se contrediraient d'un bailleur à
 * l'autre : elles ne s'ajoutent donc qu'au bon de l'émetteur reconnu.
 *
 * Module pur, sans Deno ni réseau : la fonction edge l'emploie, et Vitest
 * l'éprouve tel quel. Les exemples cités dans les consignes sont inventés — le
 * dépôt est public, et un bon porte le nom et le téléphone d'un locataire.
 */

import type { ChampTexte } from "./contrat-bc.ts";

export interface ProfilEmetteur {
  /** Nom court, pour les traces et l'en-tête des consignes. */
  nom: string;
  /** Ce qui, dans le texte du bon, désigne cet émetteur. */
  reconnaitre: RegExp[];
  /**
   * Le nom à rendre dans `client`, quand celui écrit sur le bon n'est pas
   * celui de la fiche — « Sté Habitation des Alpes » pour PLURALIS — ou n'est
   * écrit nulle part ailleurs que dans le logo.
   */
  client?: string;
  /** Ajoutées au prompt ; elles priment sur les règles générales. */
  consignes: string[];
  /** Champs que ce bailleur ne remplit jamais à bon escient : forcés à null. */
  ignorer?: ChampTexte[];
}

export const PROFILS: ProfilEmetteur[] = [
  {
    nom: "CDC Habitat",
    reconnaitre: [/CDC\s+HABITAT/i],
    consignes: [
      "notes : le texte libre placé AU-DESSUS du bloc « Prestation Parties Privatives », entre les lignes « Travaux à réaliser… / Marché n°… » et ce bloc (clé à récupérer, code immeuble, description de la demande). Recopie-le en entier s'il existe, puis les consignes d'accès.",
      "telephoneLocataire : les numéros de la ligne « Tél. : … - Portable : … » qui suit « Occupant actuel ».",
    ],
  },
  {
    nom: "SEM4V",
    reconnaitre: [/\bSEM\s?4\s?V\b/i, /\b4\s+VALL[ÉE]ES\b/i],
    consignes: [
      "interlocuteur : la personne qui a fait l'EDL (état des lieux), indiquée en bas de page, avec son téléphone. JAMAIS le gardien, même s'il est nommé plus haut.",
      "notes : UNIQUEMENT le texte de la rubrique « Observation » (ou « Observations »). Rien d'autre : ni consignes d'accès, ni description des travaux.",
      "telephoneLocataire : le téléphone du locataire, dans le bloc qui le nomme.",
      "referenceChantier : null. Le numéro que ce bailleur imprime à cet endroit n'est pas une référence de chantier.",
    ],
    ignorer: ["referenceChantier"],
  },
  {
    nom: "Département de la Haute-Savoie",
    reconnaitre: [
      /D[ÉE]PARTEMENT\s+DE\s+LA\s+HAUTE[\s-]+SAVOIE/i,
      /CONSEIL\s+D[ÉE]PARTEMENTAL\s+DE\s+LA\s+HAUTE[\s-]+SAVOIE/i,
    ],
    consignes: [
      "notes : le contenu de l'encadré qui porte le Code CHORUS (service exécutant), l'EFI et le numéro d'engagement, recopié sous la forme « libellé : valeur », un par ligne.",
      "lignes : les prestations commencent en page 2 et peuvent courir jusqu'à la dernière page. Rends une ligne par article de CHAQUE page, dans l'ordre ; ne t'arrête pas à la première page et ne résume pas.",
    ],
  },
  {
    nom: "Léman Habitat",
    reconnaitre: [/L[ÉE]MAN[\s-]*HABITAT/i],
    consignes: [
      "referenceChantier : le numéro du MARCHÉ, écrit sous « Type de Règle de marché » (de la forme « 2024000000 - 0000001 »). La « Référence » du bloc « Entreprise » est NOTRE code fournisseur chez ce bailleur : ne la prends jamais.",
      "adresse / codePostal / ville : la ligne de l'encadré « Adresse de l'intervention » — logement, voie, entrée, puis code postal et ville. Ni l'en-tête, ni le pied de page, ni la ligne en capitales qui résume les travaux juste au-dessus de l'encadré.",
      "interlocuteur : la personne de la colonne « Interlocuteur » de ce même encadré. Son téléphone est dans la colonne « Téléphone » du même encadré (Fixe / Port. / Prof.) — jamais le « Téléphone » du bloc « Entreprise », ni le standard du pied de page.",
      "notes : le texte de la rubrique « OBSERVATIONS ».",
    ],
  },
  {
    nom: "SDH",
    reconnaitre: [
      /SOCI[ÉE]T[ÉE]\s+DAUPHINOISE\s+POUR\s+L['’\s]*HABITAT/i,
      /sdh\.fr/i,
      // Sensible à la casse : le sigle s'écrit en capitales, « sdh » n'est pas lui.
      /\bSDH\b/,
    ],
    client: "SDH",
    consignes: [
      "client : « SDH ». Sur ce bon, la rubrique « Client : » ne désigne PAS l'émetteur.",
      "occupant : la rubrique « Client : » désigne le LOCATAIRE. Son nom va dans occupant, sans le numéro de compte qui le précède ; ses numéros (après « Tél: » et sur la ligne suivante) vont dans telephoneLocataire. logementStatut : 'occupé'.",
      "adresse / ville : la ligne « ESI : » — après le code ESI (chiffres et tirets), la résidence, le numéro de logement et la voie ; ville = la commune écrite sur cette ligne. Jamais le « Siège social » de l'en-tête.",
      "dateBC : la date « le JJ.MM.AAAA » à côté de « BC saisie par ». dateFinTravaux : la date « Fin d'exécution ». La « Date de fin de travaux » du cadre QUITUS est à remplir par l'entreprise : ignore-la.",
      "notes : le texte de « OBJET DE LA COMMANDE ». interlocuteur : la rubrique « Interlocuteur » (fonction et nom).",
    ],
  },
  {
    nom: "Alpes Isère Habitat",
    reconnaitre: [/ALPES\s+IS[ÈE]RE\s+HABITAT/i],
    consignes: [
      "referenceChantier : le numéro « PL/… » (ligne « Réclamation PL/… ») et le numéro « APPROCHE … », joints par « - » quand les deux figurent : « PL/000000 - APPROCHE 00000 ». Ni le N° de marché, ni le N° fournisseur.",
      "notes : le contenu ENTIER du premier encadré de la colonne « Objet de la commande » (réclamation, demande, accès au lot, dates, liste des codes), avant le tableau des prestations.",
      "lignes : une ligne par rangée du tableau qui porte un code article dans la colonne « Prestations ». designation = code + libellé de « Objet de la commande ». La colonne « Unité ou forfait » porte le PRIX UNITAIRE HT, pas une unité : elle va dans prixUnitaire.",
      "interlocuteur : « Interlocuteur commande ». dateFinTravaux : « Date fin intervention ».",
      "Les pages « Attestation simplifiée » (TVA) sont une annexe fiscale : n'en tire ni adresse, ni ligne, ni date.",
    ],
  },
  {
    nom: "PLURALIS",
    reconnaitre: [/PLURALIS/i, /HABITATION\s+DES\s+ALPES/i],
    client: "PLURALIS",
    consignes: [
      "client : « PLURALIS ». « Sté Habitation des Alpes » est son ancien nom.",
      "adresse / codePostal / ville : la colonne GAUCHE du bloc « Prestation Parties Privatives » — résidence (sans le code entre parenthèses), voie, code postal et ville ; numeroLogement et etage sur la ligne « logement n°…, porte n°…, …ÈME ÉTAGE ». Ni le bloc de l'agence en haut à gauche, ni l'adresse du chargé de proximité à droite.",
      "interlocuteur : le « Chargé de proximité », avec son portable. occupant : l'« Occupant actuel », sans le numéro de compte ; telephoneLocataire : les numéros de la ligne « domicile / bureau / portable » qui le suit.",
      "dateFinTravaux : « Travaux à réaliser pour le … ». notes : la rubrique « OBSERVATIONS » si elle n'est pas vide.",
    ],
  },
];

/**
 * L'émetteur du bon, s'il fait partie des bailleurs connus.
 *
 * Un bon nomme souvent d'autres organismes que le sien — un ancien nom en pied
 * de page, un partenaire, un gestionnaire. Celui qui l'émet se nomme en
 * premier, dans l'en-tête : on retient donc le profil dont un motif apparaît le
 * plus tôt dans le texte.
 */
export function profilDe(markdown: string): ProfilEmetteur | null {
  let retenu: ProfilEmetteur | null = null;
  let premier = Infinity;
  for (const profil of PROFILS) {
    for (const motif of profil.reconnaitre) {
      const position = markdown.search(motif);
      if (position >= 0 && position < premier) {
        premier = position;
        retenu = profil;
      }
    }
  }
  return retenu;
}

export function consignesDe(profil: ProfilEmetteur): string {
  return (
    `\nConsignes propres à ce bon, émis par ${profil.nom} — elles PRIMENT sur les règles générales :\n` +
    profil.consignes.map((c) => `- ${c}`).join("\n") +
    "\n"
  );
}

/**
 * « Logement sur passe » : le bailleur a remis la clé passe-partout, personne
 * n'habite les lieux. Léman Habitat l'écrit « LOGT SUR PASSE », Alpes Isère
 * Habitat « Logement sur pass ». Le modèle hésitait quand un nom de personne
 * figurait ailleurs sur le bon ; la mention est sans ambiguïté, elle tranche.
 */
const SUR_PASSE = /\b(?:logement|logt|lgt)\.?\s+sur\s+passe?\b/i;

/** Ce qui se décide sur le texte du bon, quoi qu'en ait dit le modèle. */
export function corrigerLecture(lu: Record<string, unknown>, markdown: string): void {
  if (SUR_PASSE.test(markdown)) lu.logementStatut = "vacant";

  const profil = profilDe(markdown);
  if (!profil) return;
  if (profil.client) lu.client = profil.client;
  for (const champ of profil.ignorer ?? []) lu[champ] = null;
}
