/**
 * Lecture d'un export de clients venu d'un autre logiciel (IMP-10 à IMP-13) —
 * port de src/api/regles-import-clients.ts, à comportement identique
 * (`tests/parite/import-clients.essai.ts`).
 *
 * Même doctrine que l'import d'articles : colonnes repérées par leur NOM (un
 * export avec moins de cases cochées doit passer), une colonne connue et
 * absente vaut un défaut NOMMÉ dit une fois, une colonne qu'on ne sait pas
 * lire est signalée plutôt qu'ignorée. Deux différences : c'est un CSV
 * VÉRITABLE (le `Commentaire` humain peut contenir `;` et retours à la ligne),
 * et l'adresse y est éclatée en `Rue` puis `Numéro`, à l'envers de l'usage.
 */
import { decoderTexte, libelleEncodage, type Encodage, type RejetImport, type SignalementImport } from "@/modules/articles/domain/import";
import type { ModeDelaiPaiement } from "@/modules/clients/domain/delais";
import { chiffres, sirenDuSiret, sirenValide, siretValide } from "@/modules/clients/domain/identifiants";
import { lireCsv } from "./csv";

export type { Encodage, RejetImport, SignalementImport };

/** Les colonnes de l'export Vertuoza, dans son ordre. Référence, non exigence. */
export const COLONNES_ATTENDUES = [
  "Vertuoza ID", "Nom de l'entreprise", "Email", "Email (bis)", "Téléphone", "Numéro de tva", "Profil", "Rue", "Numéro", "Code postal",
  "Localité", "Pays", "Adresse de facturation identique", "Rue facturation", "Numéro facturation", "Code postal facturation",
  "Localité facturation", "Pays facturation", "Source", "Commercial", "Site web", "BIC", "IBAN", "TVA", "Language", "Description",
  "Franco", "Montant franco", "Siren", "IDE", "Métier", "Conditions particulières", "Identifiant comptable", "Conditions de paiement",
  "SIREN (9)", "SIRET établissement (14)", "Confiance / source", "Commentaire",
] as const;

/** Sans nom, pas de client : `clients.nom` est la seule colonne NOT NULL hors société. */
export const COLONNES_REQUISES = ["Nom de l'entreprise"] as const;

const DEFAUT_SI_ABSENTE: Readonly<Record<string, string>> = {
  "Nom de l'entreprise": "",
  "SIRET établissement (14)":
    "colonne « SIRET établissement (14) » absente : aucun établissement n'est identifié, l'annuaire ne sera interrogé que sur le SIREN.",
  Pays: "colonne « Pays » absente : tous les clients sont importés en France (FR).",
  "Conditions de paiement": "colonne « Conditions de paiement » absente : le réglage de la société s'appliquera.",
};

/**
 * Colonnes NON reprises, et pourquoi — affiché. BIC et IBAN : aucune colonne
 * bancaire côté client, et une zone de notes lisible par tous n'en est pas une.
 */
const COLONNES_ECARTEES: Readonly<Record<string, string>> = {
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

/** Libellé de pays → code ISO (IMP-11). Inconnu : FR, écrit et signalé. */
export const PAYS_VERS_CODE: Readonly<Record<string, string>> = {
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

/** Les mots qui font d'un commentaire humain un avertissement à remonter AVANT d'écrire. */
const MOTS_ALERTE = ["ALERTE", "DOUBLON", "NE PAS CONFONDRE", "PERSONNE PHYSIQUE"];

export interface ClientImporte {
  ligne: number;
  nom: string;
  email: string | null;
  telephone: string | null;
  adresse: string | null;
  codePostal: string | null;
  ville: string | null;
  paysCode: string;
  /** Le pays vient du fichier et y est reconnu — pas le « FR » par défaut (propre à web/, D-EFA-07). */
  paysExplicite: boolean;
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

/** Sans casse, sans accents, espaces réduits : « CDC Habitat » = « CDC HABITAT ». */
export function cleNom(nom: string | null | undefined): string {
  return (nom ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function cleSiret(siret: string | null | undefined): string {
  return chiffres(siret);
}

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
 * Ce client existe-t-il déjà (IMP-13) ? Le SIRET d'abord, exact sur ses
 * chiffres ; le nom ensuite, normalisé. Deux existants au même nom : on ne
 * tranche pas — ni mise à jour (laquelle ?), ni création (un troisième homonyme).
 */
export function rapprocher(client: Pick<ClientImporte, "nom" | "siret">, existants: readonly ClientRapprochable[]): Rapprochement {
  const siret = cleSiret(client.siret);
  if (siret) {
    const parSiret = existants.filter((e) => cleSiret(e.siret) === siret);
    if (parSiret.length === 1 && parSiret[0]) return { type: "miseAJour", existant: parSiret[0], par: "siret" };
    if (parSiret.length > 1) return { type: "ambigu", homonymes: parSiret };
  }
  const nom = cleNom(client.nom);
  const parNom = existants.filter((e) => cleNom(e.nom) === nom);
  if (parNom.length === 1 && parNom[0]) return { type: "miseAJour", existant: parNom[0], par: "nom" };
  if (parNom.length > 1) return { type: "ambigu", homonymes: parNom };
  return { type: "creation" };
}

/** « Avenue Grugliasco » + « 34 » → « 34 Avenue Grugliasco » ; « 32Bis » ne se découpe pas. */
export function adresseRecomposee(numero: string, rue: string): string {
  return [(numero ?? "").trim(), (rue ?? "").trim()].filter(Boolean).join(" ");
}

/**
 * « 30 jours fin de mois », « à réception »… → un délai (IMP-12). `null` pour
 * l'illisible, et `null` veut dire « non paramétré », jamais « zéro » : payer
 * comptant n'est pas n'avoir rien convenu.
 */
export function delaiDesConditions(texte: string | null | undefined): { jours: number; mode: ModeDelaiPaiement } | null {
  const t = (texte ?? "").toLowerCase().trim();
  if (!t) return null;
  if (/r[ée]ception|comptant|immédiat|immediat/.test(t)) return { jours: 0, mode: "net" };
  const m = t.match(/(\d{1,3})\s*(?:jours?|j\b)?/);
  if (!m) return null;
  const jours = Number(m[1]);
  if (!Number.isFinite(jours) || jours < 0) return null;
  return { jours, mode: /fin\s*de\s*mois|fdm/.test(t) ? "fin_de_mois" : "net" };
}

export interface EnteteClients {
  largeur: number;
  position: Record<string, number>;
  manquantes: string[];
  absentes: string[];
  inconnues: string[];
}

export function analyserEnteteClients(champs: readonly string[]): EnteteClients {
  const propres = champs.map((c) => c.trim().replace(/^\uFEFF/, ""));
  const position: Record<string, number> = {};
  const inconnues: string[] = [];
  propres.forEach((nom, i) => {
    if (!nom) return;
    if ((COLONNES_ATTENDUES as readonly string[]).includes(nom)) {
      if (position[nom] === undefined) position[nom] = i;
      else inconnues.push(`${nom} (en double)`);
    } else inconnues.push(nom);
  });
  return {
    largeur: propres.length,
    position,
    manquantes: COLONNES_REQUISES.filter((c) => position[c] === undefined),
    absentes: Object.keys(DEFAUT_SI_ABSENTE).filter((c) => DEFAUT_SI_ABSENTE[c] && position[c] === undefined),
    inconnues,
  };
}

/**
 * L'ORDRE est impératif : un SIRET dont la clé ne tombe pas juste n'est ni
 * écrit ni interrogé. `siretValide` porte déjà l'exception de La Poste.
 */
function immatriculation(siretBrut: string, sirenA: string, sirenB: string, signaler: (motif: string) => void): { siret: string | null; siren: string | null } {
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
        signaler(`Le SIREN ${valeur} de « ${colonne} » contredit le SIRET, qui commence par ${attendu}. C'est le SIRET qui tranche.`);
      }
    }
    return { siret, siren: attendu };
  }
  if (siret) signaler(`SIRET ${siret} : sa clé de contrôle ne tombe pas juste. Écarté, et l'annuaire ne sera pas interrogé dessus.`);

  const uniques = [...new Set([a, b].filter((v) => v && sirenValide(v)))];
  if (uniques.length === 1) {
    const perdus = [a, b].filter((v) => v && v !== uniques[0]);
    if (perdus.length) signaler(`SIREN ${perdus.join(" et ")} écarté : clé de contrôle fausse.`);
    return { siret: null, siren: uniques[0] ?? null };
  }
  if (uniques.length > 1) {
    // Deux numéros également plausibles : choisir en silence est le seul geste dont on ne pourrait pas rendre compte.
    signaler(`Deux SIREN valides et différents (${uniques.join(" et ")}) : aucun n'est retenu, à trancher dans la fiche.`);
    return { siret: null, siren: null };
  }
  const renseignes = [a, b].filter(Boolean);
  if (renseignes.length) signaler(`SIREN ${renseignes.join(" et ")} écarté : clé de contrôle fausse.`);
  return { siret: null, siren: null };
}

/** Des lignes NOMMÉES : une valeur nue dans des notes n'apprend rien. */
function notesDuFichier(paires: [string, string][]): string | null {
  const lignes = paires.filter(([, v]) => (v ?? "").trim()).map(([libelle, v]) => `${libelle} : ${v.trim()}`);
  return lignes.length ? lignes.join("\n") : null;
}

/** L'avertissement cité en tête d'alerte : assez pour être compris, le reste est dans les notes. */
const LONGUEUR_AVERTISSEMENT = 160;
/** L'extrait d'une ligne rejetée, pour que le rapport la fasse reconnaître sans la recopier entière. */
const LONGUEUR_EXTRAIT = 200;
const extrait = (champs: readonly string[]) => champs.join(";").slice(0, LONGUEUR_EXTRAIT);

function signalementsDuFichier(entete: EnteteClients, encodage: Encodage): SignalementImport[] {
  const s: SignalementImport[] = [{ ligne: 1, motif: `Fichier lu en ${libelleEncodage(encodage)}.` }];
  entete.absentes.forEach((c) => s.push({ ligne: 1, motif: DEFAUT_SI_ABSENTE[c] ?? "" }));
  Object.keys(COLONNES_ECARTEES)
    .filter((c) => entete.position[c] !== undefined)
    .forEach((c) => s.push({ ligne: 1, motif: `Colonne « ${c} » non reprise — ${COLONNES_ECARTEES[c]}` }));
  if (entete.inconnues.length) {
    const pl = entete.inconnues.length > 1 ? "s" : "";
    s.push({ ligne: 1, motif: `Colonne${pl} non reconnue${pl}, donc ignorée${pl} : ${entete.inconnues.map((c) => `« ${c} »`).join(", ")}.` });
  }
  return s;
}

function lireClient(champ: (nom: string) => string, signaler: (motif: string) => void, ligne: number, nom: string): ClientImporte {
  const vide = (v: string) => (v.trim() ? v.trim() : null);
  const { siret, siren } = immatriculation(champ("SIRET établissement (14)"), champ("Siren"), champ("SIREN (9)"), signaler);
  const sansImmatriculation = !siret && !siren;
  if (sansImmatriculation) signaler("Aucune immatriculation : traité comme un particulier, sans interrogation de l'annuaire.");

  // L'avertissement écrit par quelqu'un qui connaissait le dossier : enterré dans les notes, personne ne le verrait à temps.
  const commentaire = champ("Commentaire").trim();
  if (commentaire && MOTS_ALERTE.some((m) => commentaire.toUpperCase().includes(m))) signaler(`Le fichier porte un avertissement : « ${commentaire.slice(0, LONGUEUR_AVERTISSEMENT)} »`);

  const adresse = adresseRecomposee(champ("Numéro"), champ("Rue"));
  if (adresse && !champ("Rue").trim()) signaler("Adresse réduite au numéro de voie : la rue est absente du fichier.");

  const paysBrut = champ("Pays").trim().toUpperCase();
  const paysCode = paysBrut ? (PAYS_VERS_CODE[paysBrut] ?? PAYS_DEFAUT) : PAYS_DEFAUT;
  if (paysBrut && !PAYS_VERS_CODE[paysBrut]) signaler(`Pays « ${champ("Pays").trim()} » inconnu : ${PAYS_DEFAUT} appliqué.`);

  // L'adresse de facturation ne part que si elle diffère.
  const memeAdresse = /^oui$/i.test(champ("Adresse de facturation identique").trim());
  const factAdresse = memeAdresse ? "" : adresseRecomposee(champ("Numéro facturation"), champ("Rue facturation"));

  const conditions = champ("Conditions de paiement").trim();
  const delai = delaiDesConditions(conditions);
  if (conditions && !delai) signaler(`Conditions de paiement « ${conditions} » illisibles : aucun délai posé.`);

  return {
    ligne,
    nom,
    email: vide(champ("Email")),
    telephone: vide(champ("Téléphone")),
    adresse: vide(adresse),
    codePostal: vide(champ("Code postal")),
    ville: vide(champ("Localité")),
    paysCode,
    paysExplicite: !!paysBrut && !!PAYS_VERS_CODE[paysBrut],
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
}

/** Le fichier entier : ce qui est importable, ce qui ne l'est pas, ce qu'on a tranché à sa place. */
export function analyserExportClients(donnees: ArrayBuffer | Uint8Array): RapportImportClients {
  const { texte, encodage } = decoderTexte(donnees);
  const lignes = lireCsv(texte, ";");
  const clients: ClientImporte[] = [];
  const rejets: RejetImport[] = [];
  const premiere = lignes[0];
  if (!premiere) return { clients, rejets: [{ ligne: 1, motif: "Fichier vide.", contenu: "" }], signalements: [], encodage };

  const entete = analyserEnteteClients(premiere.champs);
  if (entete.manquantes.length) {
    const motif =
      `En-tête inexploitable : ${entete.manquantes.map((c) => `« ${c} »`).join(" et ")} introuvable. ` +
      `Colonnes reconnues dans ce fichier : ${Object.keys(entete.position).join(", ") || "aucune"}.`;
    return { clients, rejets: [{ ligne: 1, motif, contenu: extrait(premiere.champs) }], signalements: [], encodage };
  }

  const signalements = signalementsDuFichier(entete, encodage);
  const clesVues = new Map<string, string>();

  for (const ligne of lignes.slice(1)) {
    if (ligne.champs.every((c) => !c.trim())) continue;
    const rejeter = (motif: string) => rejets.push({ ligne: ligne.numero, motif, contenu: extrait(ligne.champs) });
    if (ligne.champs.length !== entete.largeur) {
      rejeter(`${ligne.champs.length} champs au lieu de ${entete.largeur} : les colonnes seraient décalées.`);
      continue;
    }
    const champ = (nom: string): string => {
      const i = entete.position[nom];
      return i === undefined ? "" : (ligne.champs[i] ?? "");
    };
    const nom = champ("Nom de l'entreprise").trim();
    if (!nom) {
      rejeter("Nom absent : un client sans nom ne peut pas être enregistré.");
      continue;
    }
    const client = lireClient(champ, (motif) => signalements.push({ ligne: ligne.numero, code: nom, motif }), ligne.numero, nom);

    /* Deux lignes du MÊME fichier pour le même client : la seconde écraserait
       la première sans rien dire. Le SIRET prime sur le nom, sans quoi deux
       établissements d'un même groupe se confondraient. */
    const cle = client.siret ? `siret:${client.siret}` : `nom:${cleNom(nom)}`;
    const deja = clesVues.get(cle);
    if (deja) {
      rejeter(`Déjà présent plus haut dans le fichier, sous « ${deja} ».`);
      continue;
    }
    clesVues.set(cle, nom);
    clients.push(client);
  }
  return { clients, rejets, signalements, encodage };
}
