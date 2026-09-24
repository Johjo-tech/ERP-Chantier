/**
 * Lecture d'un export de clients venu d'un autre logiciel de gestion.
 *
 * Même doctrine que l'import d'articles, et pour les mêmes raisons : les
 * colonnes se repèrent par leur NOM et non par leur position — un export avec
 * moins de cases cochées doit passer —, une colonne connue mais absente vaut
 * un défaut NOMMÉ annoncé une fois pour le fichier, et une colonne qu'on ne
 * sait pas lire est signalée plutôt qu'ignorée en silence.
 *
 * Deux différences avec l'export d'articles, qui justifient un module à part :
 *
 * - ce fichier est un CSV VÉRITABLE. Son champ `Commentaire` est écrit par un
 *   humain (« ALERTE - ne pas confondre avec… ») et peut contenir un
 *   point-virgule, voire un retour à la ligne. Il passe donc par `lireCsv`,
 *   pas par un découpage sur `;` ;
 * - l'adresse y est ÉCLATÉE en `Rue` et `Numéro`, dans cet ordre, quand
 *   l'usage français met le numéro devant.
 *
 * ── CE QUE CE MODULE NE FAIT PAS ───────────────────────────────────────────
 * Aucun appel réseau. L'annuaire des entreprises est interrogé plus tard, par
 * le pont, et seulement sur des numéros dont la clé de contrôle est déjà
 * tombée juste : dépenser un appel sur un SIRET mal saisi, c'est consommer un
 * quota pour obtenir « introuvable ».
 *
 * Module feuille : ni base, ni DOM, ni `window`.
 */

import { lireCsv, type RejetImport, type SignalementImport } from "./regles-csv";
import { decoderTexte, libelleEncodage, type Encodage } from "./regles-encodage";
import {
  chiffres,
  sirenDuSiret,
  sirenValide,
  siretValide,
  type CadreFacturation,
  type ModeDelaiPaiement,
} from "./regles-efacture";

export type { RejetImport, SignalementImport };

/** Les colonnes de l'export, dans son ordre d'origine. Référence, non exigence. */
export const COLONNES_ATTENDUES = [
  "Vertuoza ID",
  "Nom de l'entreprise",
  "Email",
  "Email (bis)",
  "Téléphone",
  "Numéro de tva",
  "Profil",
  "Rue",
  "Numéro",
  "Code postal",
  "Localité",
  "Pays",
  "Adresse de facturation identique",
  "Rue facturation",
  "Numéro facturation",
  "Code postal facturation",
  "Localité facturation",
  "Pays facturation",
  "Source",
  "Commercial",
  "Site web",
  "BIC",
  "IBAN",
  "TVA",
  "Language",
  "Description",
  "Franco",
  "Montant franco",
  "Siren",
  "IDE",
  "Métier",
  "Conditions particulières",
  "Identifiant comptable",
  "Conditions de paiement",
  "SIREN (9)",
  "SIRET établissement (14)",
  "Confiance / source",
  "Commentaire",
] as const;

/**
 * Sans elle, une ligne n'a pas de nom — et `clients.nom` est la seule colonne
 * NOT NULL de la table hors `societe_id`. Exiger davantage rejetterait le
 * fichier entier pour une case décochée à l'export.
 */
export const COLONNES_REQUISES = ["Nom de l'entreprise"] as const;

/** Ce que devient une colonne connue mais absente. Dit une fois, pas mille. */
const DEFAUT_SI_ABSENTE: Record<string, string> = {
  "Nom de l'entreprise": "", // requise : traitée en amont, jamais par défaut
  "SIRET établissement (14)":
    "colonne « SIRET établissement (14) » absente : aucun établissement n'est identifié, l'annuaire ne sera interrogé que sur le SIREN.",
  Pays: "colonne « Pays » absente : tous les clients sont importés en France (FR).",
  "Conditions de paiement":
    "colonne « Conditions de paiement » absente : le réglage de la société s'appliquera.",
};

/** Les colonnes qu'on lit vraiment. Le reste est signalé, jamais avalé. */
const COLONNES_LUES = new Set([
  "Nom de l'entreprise",
  "Email",
  "Téléphone",
  "Numéro de tva",
  "Rue",
  "Numéro",
  "Code postal",
  "Localité",
  "Pays",
  "Adresse de facturation identique",
  "Rue facturation",
  "Numéro facturation",
  "Code postal facturation",
  "Localité facturation",
  "Siren",
  "SIREN (9)",
  "SIRET établissement (14)",
  "Conditions de paiement",
  // Reprises en notes, nommées :
  "Email (bis)",
  "Description",
  "Commentaire",
  "Métier",
  "Conditions particulières",
  "Identifiant comptable",
  "Site web",
  "Source",
  "Commercial",
  "Vertuoza ID",
  "Confiance / source",
]);

/**
 * Colonnes délibérément NON reprises, et la raison — elle sera affichée.
 *
 * `BIC` et `IBAN` méritent qu'on s'y arrête : la table n'a aucun champ
 * bancaire pour un client, et les ranger dans une zone de notes libre les
 * rendrait lisibles par tout membre de la société. Une coordonnée bancaire ne
 * se case pas « en attendant ».
 */
const COLONNES_ECARTEES: Record<string, string> = {
  BIC: "coordonnées bancaires : aucune colonne ne les accueille, et une zone de notes lisible par tous n'en est pas une.",
  IBAN: "coordonnées bancaires : aucune colonne ne les accueille, et une zone de notes lisible par tous n'en est pas une.",
  TVA: "on ne sait pas si cette colonne porte un taux, un régime ou un état : rien n'en est déduit.",
  Profil: "sans valeur distinctive dans cet export.",
  Franco: "notion absente du modèle.",
  "Montant franco": "notion absente du modèle.",
  IDE: "identifiant d'un registre étranger, sans destination ici.",
  Language: "la langue d'un client n'est pas modélisée.",
  "Pays facturation": "l'adresse de facturation ne porte pas son pays dans ce modèle.",
};

/** Libellé de pays → code ISO. Inconnu : `FR`, écrit et signalé. */
const PAYS_VERS_CODE: Record<string, string> = {
  FRANCE: "FR",
  BELGIQUE: "BE",
  BELGIUM: "BE",
  SUISSE: "CH",
  LUXEMBOURG: "LU",
  ALLEMAGNE: "DE",
  ESPAGNE: "ES",
  ITALIE: "IT",
};
const PAYS_DEFAUT = "FR";

/** Les mots qui font d'un commentaire humain un avertissement à remonter. */
const MOTS_ALERTE = ["ALERTE", "DOUBLON", "NE PAS CONFONDRE", "PERSONNE PHYSIQUE"];

export interface ClientImporte {
  /** La ligne du FICHIER, pour que le rapport désigne la bonne. */
  ligne: number;
  nom: string;
  email: string | null;
  telephone: string | null;
  adresse: string | null;
  codePostal: string | null;
  ville: string | null;
  paysCode: string;
  facturationAdresse: string | null;
  facturationCodePostal: string | null;
  facturationVille: string | null;
  siret: string | null;
  siren: string | null;
  tvaIntracom: string | null;
  delaiPaiementJours: number | null;
  delaiPaiementMode: ModeDelaiPaiement | null;
  notes: string | null;
  /** Décidé ici, jamais redéduit plus loin : c'est ce qui fait un B2C. */
  sansImmatriculation: boolean;
}

export interface RapportImportClients {
  clients: ClientImporte[];
  rejets: RejetImport[];
  signalements: SignalementImport[];
  encodage: Encodage;
}

// ============ NORMALISATION ET RAPPROCHEMENT ============

/**
 * La clé d'un nom : sans casse, sans accents, espaces réduits.
 *
 * « CDC Habitat » et « CDC HABITAT » désignent le même client ;
 * « CDC HABITAT SOCIAL » n'en est pas un — et le fichier le dit lui-même.
 *
 * Écrite ici plutôt qu'empruntée à `integrations/recherche.ts` : une feuille
 * ne peut pas importer un module `integrations` sans inverser le sens des
 * dépendances.
 */
export function cleNom(nom: string | null | undefined): string {
  return (nom ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** La clé d'un SIRET : ses chiffres seuls. */
export function cleSiret(siret: string | null | undefined): string {
  return chiffres(siret);
}

/** Le minimum qu'un client existant doit porter pour être reconnu. */
export interface ClientRapprochable {
  id: string;
  nom: string;
  siret: string | null;
}

export type Rapprochement =
  | { type: "creation" }
  | { type: "miseAJour"; existant: ClientRapprochable; par: "siret" | "nom" }
  | { type: "ambigu"; homonymes: ClientRapprochable[] };

/**
 * Ce client existe-t-il déjà ?
 *
 * Le SIRET d'abord — exact, et comparé sur ses chiffres seuls, donc immunisé à
 * la façon dont il a été tapé dans la fiche. Le nom ensuite, normalisé.
 *
 * DEUX EXISTANTS AU MÊME NOM : on ne tranche pas. Ni mise à jour — laquelle ? —
 * ni création, qui ferait un troisième homonyme. La ligne est nommée et montrée,
 * l'utilisateur décide dans la fiche. Une décision qu'on ne saurait pas
 * justifier ne se prend pas à sa place.
 */
export function rapprocher(
  client: Pick<ClientImporte, "nom" | "siret">,
  existants: ClientRapprochable[]
): Rapprochement {
  const siret = cleSiret(client.siret);
  if (siret) {
    const parSiret = existants.filter((e) => cleSiret(e.siret) === siret);
    if (parSiret.length === 1) return { type: "miseAJour", existant: parSiret[0], par: "siret" };
    if (parSiret.length > 1) return { type: "ambigu", homonymes: parSiret };
  }

  const nom = cleNom(client.nom);
  const parNom = existants.filter((e) => cleNom(e.nom) === nom);
  if (parNom.length === 1) return { type: "miseAJour", existant: parNom[0], par: "nom" };
  if (parNom.length > 1) return { type: "ambigu", homonymes: parNom };

  return { type: "creation" };
}

// ============ LECTURE DU FICHIER ============

/**
 * « Avenue Grugliasco » + « 34 » → « 34 Avenue Grugliasco ».
 *
 * L'ordre français met le numéro devant, et le fichier les range à l'envers.
 * « 32Bis » est un numéro comme un autre : on ne le découpe pas.
 */
export function adresseRecomposee(numero: string, rue: string): string {
  const n = (numero ?? "").trim();
  const r = (rue ?? "").trim();
  return [n, r].filter(Boolean).join(" ");
}

/**
 * « 30 jours fin de mois », « à réception »… → un délai.
 *
 * Rend `null` pour ce qu'on ne sait pas lire — et `null` veut dire « pas
 * paramétré », jamais « zéro » : un client à zéro jour paie comptant, ce qui
 * n'est pas du tout la même chose que n'avoir rien convenu.
 */
export function delaiDesConditions(
  texte: string | null | undefined
): { jours: number; mode: ModeDelaiPaiement } | null {
  const t = (texte ?? "").toLowerCase().trim();
  if (!t) return null;
  if (/r[ée]ception|comptant|immédiat|immediat/.test(t)) return { jours: 0, mode: "net" };

  const m = t.match(/(\d{1,3})\s*(?:jours?|j\b)?/);
  if (!m) return null;
  const jours = Number(m[1]);
  if (!Number.isFinite(jours) || jours < 0) return null;
  return { jours, mode: /fin\s*de\s*mois|fdm/.test(t) ? "fin_de_mois" : "net" };
}

/** Ce que l'en-tête nous apprend du fichier. */
export interface EnteteClients {
  largeur: number;
  position: Record<string, number>;
  manquantes: string[];
  absentes: string[];
  inconnues: string[];
}

export function analyserEnteteClients(champs: string[]): EnteteClients {
  const propres = champs.map((c) => c.trim().replace(/^﻿/, ""));
  const position: Record<string, number> = {};
  const inconnues: string[] = [];

  propres.forEach((nom, i) => {
    if (!nom) return;
    if ((COLONNES_ATTENDUES as readonly string[]).includes(nom)) {
      if (position[nom] === undefined) position[nom] = i;
      else inconnues.push(`${nom} (en double)`);
    } else {
      inconnues.push(nom);
    }
  });

  return {
    largeur: propres.length,
    position,
    manquantes: COLONNES_REQUISES.filter((c) => position[c] === undefined),
    absentes: Object.keys(DEFAUT_SI_ABSENTE).filter(
      (c) => DEFAUT_SI_ABSENTE[c] && position[c] === undefined
    ),
    inconnues,
  };
}

/**
 * L'immatriculation d'une ligne : ce qu'on retient, et ce qu'on écarte.
 *
 * L'ORDRE EST IMPÉRATIF, et c'est là que se joue l'économie d'appels réseau :
 * un SIRET dont la clé de contrôle ne tombe pas juste n'est jamais écrit et
 * n'est jamais interrogé. `siretValide` porte déjà l'exception de La Poste —
 * la reprendre ici en ferait une seconde définition.
 */
function immatriculation(
  siretBrut: string,
  sirenA: string,
  sirenB: string,
  signaler: (motif: string) => void
): { siret: string | null; siren: string | null } {
  const siret = chiffres(siretBrut);
  const a = chiffres(sirenA);
  const b = chiffres(sirenB);

  if (siret && siretValide(siret)) {
    const attendu = sirenDuSiret(siret);
    for (const [valeur, colonne] of [
      [a, "Siren"],
      [b, "SIREN (9)"],
    ] as const) {
      if (valeur && attendu && valeur !== attendu) {
        signaler(
          `Le SIREN ${valeur} de « ${colonne} » contredit le SIRET, qui commence par ${attendu}. C'est le SIRET qui tranche.`
        );
      }
    }
    return { siret, siren: attendu };
  }

  if (siret) {
    signaler(
      `SIRET ${siret} : sa clé de contrôle ne tombe pas juste. Écarté, et l'annuaire ne sera pas interrogé dessus.`
    );
  }

  const valides = [
    { v: a, c: "Siren" },
    { v: b, c: "SIREN (9)" },
  ].filter((x) => x.v && sirenValide(x.v));
  const uniques = [...new Set(valides.map((x) => x.v))];

  if (uniques.length === 1) {
    const perdus = [a, b].filter((v) => v && v !== uniques[0]);
    if (perdus.length) signaler(`SIREN ${perdus.join(" et ")} écarté : clé de contrôle fausse.`);
    return { siret: null, siren: uniques[0] };
  }
  if (uniques.length > 1) {
    /* Deux numéros également plausibles : choisir en silence est le seul geste
       dont on ne pourrait pas rendre compte. On n'en retient aucun. */
    signaler(
      `Deux SIREN valides et différents (${uniques.join(" et ")}) : aucun n'est retenu, à trancher dans la fiche.`
    );
    return { siret: null, siren: null };
  }

  const renseignes = [a, b].filter(Boolean);
  if (renseignes.length) {
    signaler(`SIREN ${renseignes.join(" et ")} écarté : clé de contrôle fausse.`);
  }
  return { siret: null, siren: null };
}

/** Les notes, construites de lignes NOMMÉES : une valeur nue n'apprend rien. */
function notesDuFichier(paires: [string, string][]): string | null {
  const lignes = paires
    .filter(([, v]) => (v ?? "").trim())
    .map(([libelle, v]) => `${libelle} : ${v.trim()}`);
  return lignes.length ? lignes.join("\n") : null;
}

/**
 * Lit le fichier entier et rend ce qui est importable, ce qui ne l'est pas, et
 * ce sur quoi on a tranché à sa place.
 */
export function analyserExportClients(donnees: ArrayBuffer | Uint8Array): RapportImportClients {
  const { texte, encodage } = decoderTexte(donnees);
  const lignes = lireCsv(texte, ";");
  const clients: ClientImporte[] = [];
  const rejets: RejetImport[] = [];
  const signalements: SignalementImport[] = [];

  if (!lignes.length) {
    return {
      clients: [],
      rejets: [{ ligne: 1, motif: "Fichier vide.", contenu: "" }],
      signalements: [],
      encodage,
    };
  }

  const entete = analyserEnteteClients(lignes[0].champs);

  if (entete.manquantes.length) {
    return {
      clients: [],
      rejets: [
        {
          ligne: 1,
          motif:
            `En-tête inexploitable : ${entete.manquantes.map((c) => `« ${c} »`).join(" et ")} introuvable. ` +
            `Colonnes reconnues dans ce fichier : ${Object.keys(entete.position).join(", ") || "aucune"}.`,
          contenu: lignes[0].champs.join(";").slice(0, 200),
        },
      ],
      signalements: [],
      encodage,
    };
  }

  // Tout ce qui se décide pour LE FICHIER se dit ici, une fois.
  signalements.push({ ligne: 1, motif: `Fichier lu en ${libelleEncodage(encodage)}.` });
  entete.absentes.forEach((c) => signalements.push({ ligne: 1, motif: DEFAUT_SI_ABSENTE[c] }));

  const ecartees = Object.keys(COLONNES_ECARTEES).filter((c) => entete.position[c] !== undefined);
  ecartees.forEach((c) =>
    signalements.push({ ligne: 1, motif: `Colonne « ${c} » non reprise — ${COLONNES_ECARTEES[c]}` })
  );
  if (entete.inconnues.length) {
    signalements.push({
      ligne: 1,
      motif: `Colonne${entete.inconnues.length > 1 ? "s" : ""} non reconnue${
        entete.inconnues.length > 1 ? "s" : ""
      }, donc ignorée${entete.inconnues.length > 1 ? "s" : ""} : ${entete.inconnues.map((c) => `« ${c} »`).join(", ")}.`,
    });
  }

  const clesVues = new Map<string, string>();

  for (const ligne of lignes.slice(1)) {
    const numero = ligne.numero;
    if (ligne.champs.every((c) => !c.trim())) continue;

    if (ligne.champs.length !== entete.largeur) {
      rejets.push({
        ligne: numero,
        motif: `${ligne.champs.length} champs au lieu de ${entete.largeur} : les colonnes seraient décalées.`,
        contenu: ligne.champs.join(";").slice(0, 200),
      });
      continue;
    }

    const champ = (nom: string): string => {
      const i = entete.position[nom];
      return i === undefined ? "" : (ligne.champs[i] ?? "");
    };
    const vide = (v: string) => (v.trim() ? v.trim() : null);

    const nom = champ("Nom de l'entreprise").trim();
    if (!nom) {
      rejets.push({
        ligne: numero,
        motif: "Nom absent : un client sans nom ne peut pas être enregistré.",
        contenu: ligne.champs.join(";").slice(0, 200),
      });
      continue;
    }

    const signaler = (motif: string) => signalements.push({ ligne: numero, code: nom, motif });

    const { siret, siren } = immatriculation(
      champ("SIRET établissement (14)"),
      champ("Siren"),
      champ("SIREN (9)"),
      signaler
    );
    const sansImmatriculation = !siret && !siren;
    if (sansImmatriculation) {
      signaler(
        "Aucune immatriculation : traité comme un particulier, sans interrogation de l'annuaire."
      );
    }

    /* L'avertissement écrit à la main par quelqu'un qui connaissait le dossier.
       Enterré dans les notes, il ne serait vu par personne au moment où il
       compte — c'est-à-dire avant d'écrire. */
    const commentaire = champ("Commentaire").trim();
    if (commentaire && MOTS_ALERTE.some((m) => commentaire.toUpperCase().includes(m))) {
      signaler(`Le fichier porte un avertissement : « ${commentaire.slice(0, 160)} »`);
    }

    const adresse = adresseRecomposee(champ("Numéro"), champ("Rue"));
    if (adresse && !champ("Rue").trim()) {
      signaler("Adresse réduite au numéro de voie : la rue est absente du fichier.");
    }

    const paysBrut = champ("Pays").trim().toUpperCase();
    const paysCode = paysBrut ? (PAYS_VERS_CODE[paysBrut] ?? PAYS_DEFAUT) : PAYS_DEFAUT;
    if (paysBrut && !PAYS_VERS_CODE[paysBrut]) {
      signaler(`Pays « ${champ("Pays").trim()} » inconnu : ${PAYS_DEFAUT} appliqué.`);
    }

    /* On ne code pas que la colonne vaut toujours « Oui » : on traite les deux
       cas, et l'adresse de facturation ne part que si elle diffère. */
    const memeAdresse = /^oui$/i.test(champ("Adresse de facturation identique").trim());
    const factAdresse = memeAdresse
      ? ""
      : adresseRecomposee(champ("Numéro facturation"), champ("Rue facturation"));

    const conditions = champ("Conditions de paiement").trim();
    const delai = delaiDesConditions(conditions);
    if (conditions && !delai) {
      signaler(`Conditions de paiement « ${conditions} » illisibles : aucun délai posé.`);
    }

    const client: ClientImporte = {
      ligne: numero,
      nom,
      email: vide(champ("Email")),
      telephone: vide(champ("Téléphone")),
      adresse: vide(adresse),
      codePostal: vide(champ("Code postal")),
      ville: vide(champ("Localité")),
      paysCode,
      facturationAdresse: vide(factAdresse),
      facturationCodePostal: memeAdresse ? null : vide(champ("Code postal facturation")),
      facturationVille: memeAdresse ? null : vide(champ("Localité facturation")),
      siret,
      siren,
      tvaIntracom: vide(champ("Numéro de tva")),
      delaiPaiementJours: delai ? delai.jours : null,
      delaiPaiementMode: delai ? delai.mode : null,
      notes: notesDuFichier([
        ["Identifiant d'origine", champ("Vertuoza ID")],
        ["Métier", champ("Métier")],
        ["Second courriel", champ("Email (bis)")],
        ["Site web", champ("Site web")],
        ["Source", champ("Source")],
        ["Commercial", champ("Commercial")],
        ["Identifiant comptable", champ("Identifiant comptable")],
        ["Conditions particulières", champ("Conditions particulières")],
        ["Description", champ("Description")],
        ["Confiance / source", champ("Confiance / source")],
        ["Commentaire", commentaire],
      ]),
      sansImmatriculation,
    };

    /* Deux lignes du MÊME fichier qui désignent le même client : la seconde
       écraserait la première sans rien dire. Le SIRET prime sur le nom, comme
       au rapprochement — sinon deux établissements d'un même groupe se
       confondraient. */
    const cle = siret ? `siret:${siret}` : `nom:${cleNom(nom)}`;
    const deja = clesVues.get(cle);
    if (deja) {
      rejets.push({
        ligne: numero,
        motif: `Déjà présent plus haut dans le fichier, sous « ${deja} ».`,
        contenu: ligne.champs.join(";").slice(0, 200),
      });
      continue;
    }
    clesVues.set(cle, nom);

    clients.push(client);
  }

  return { clients, rejets, signalements, encodage };
}
