/**
 * Lecture automatique d'un bon de commande (PDF ou image).
 *
 * L'edge function `extraire-bc`, déjà déployée sur le projet, interroge Gemini
 * avec un schéma JSON strict ; la clé API reste dans les secrets Supabase et le
 * navigateur n'envoie que le fichier.
 *
 * Le résultat **préremplit** le formulaire : rien n'est enregistré
 * automatiquement, l'utilisateur relit et corrige avant de valider.
 */

import { supabase, todayISO } from "@/api/client";

export interface LigneExtraite {
  type: "ligne" | "chapitre" | "commentaire";
  designation: string;
  qte?: number | null;
  unite?: string | null;
  prixUnitaire?: number | null;
  tva?: number | null;
}

export interface ExtractionBC {
  client?: string | null;
  numeroBC?: string | null;
  dateBC?: string | null;
  interlocuteur?: string | null;
  adresse?: string | null;
  codePostal?: string | null;
  ville?: string | null;
  adresseIntervention?: string | null;
  numeroLogement?: string | null;
  logementStatut?: string | null;
  occupant?: string | null;
  etage?: string | null;
  notes?: string | null;
  montantTotalHT?: number | null;
  lignes: LigneExtraite[];
  avertissements: string[];
}

/** Formats que Gemini accepte tels quels. */
const MIMES_GEMINI = ["application/pdf", "image/jpeg", "image/png", "image/webp"];

/** Au-delà, l'edge function refuse la charge utile. */
const TAILLE_MAX = 14_000_000;

/** À partir d'ici, une image est recompressée avant envoi. */
const TAILLE_RECOMPRESSION = 3_000_000;

/** Côté le plus long après redimensionnement : suffisant pour lire un BC. */
const COTE_MAX = 2200;

/**
 * Ramène une image à un format et un poids acceptables.
 *
 * Deux cas courants sur le terrain : une photo HEIC prise à l'iPhone, que
 * Gemini ne lit pas, et un scan de plusieurs dizaines de méga-octets. Le
 * navigateur sait décoder les deux et les réencoder en JPEG — inutile de
 * renvoyer l'utilisateur à ses réglages.
 */
async function normaliserImage(fichier: File): Promise<File> {
  const bitmap = await createImageBitmap(fichier).catch(() => null);
  if (!bitmap) {
    throw new Error(
      `Format d'image non lisible (${fichier.type || "inconnu"}). Convertissez-le en JPEG ou PDF.`
    );
  }

  const echelle = Math.min(1, COTE_MAX / Math.max(bitmap.width, bitmap.height));
  const largeur = Math.round(bitmap.width * echelle);
  const hauteur = Math.round(bitmap.height * echelle);

  const canvas = document.createElement("canvas");
  canvas.width = largeur;
  canvas.height = hauteur;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Recompression impossible sur cet appareil.");
  ctx.drawImage(bitmap, 0, 0, largeur, hauteur);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.85)
  );
  if (!blob) throw new Error("Recompression impossible sur cet appareil.");

  return new File([blob], fichier.name.replace(/\.[^.]+$/, "") + ".jpg", {
    type: "image/jpeg",
  });
}

/** Prépare le fichier : conversion et allègement si nécessaire. */
async function preparer(fichier: File): Promise<File> {
  const estImage = fichier.type.startsWith("image/") || !fichier.type;

  if (estImage && (!MIMES_GEMINI.includes(fichier.type) || fichier.size > TAILLE_RECOMPRESSION)) {
    return normaliserImage(fichier);
  }

  if (fichier.type === "application/pdf" && fichier.size > TAILLE_MAX) {
    throw new Error(
      `PDF trop volumineux (${Math.round(fichier.size / 1_000_000)} Mo, limite 14 Mo). Réexportez-le en qualité réduite.`
    );
  }

  if (!MIMES_GEMINI.includes(fichier.type)) {
    throw new Error(
      `Format non pris en charge (${fichier.type || "inconnu"}). Utilisez un PDF ou une photo.`
    );
  }

  return fichier;
}

/** Encode par blocs : `String.fromCharCode(...)` explose la pile sur un gros PDF. */
async function fichierEnBase64(fichier: File): Promise<string> {
  const octets = new Uint8Array(await fichier.arrayBuffer());
  let binaire = "";
  const BLOC = 0x8000;
  for (let i = 0; i < octets.length; i += BLOC) {
    binaire += String.fromCharCode(...octets.subarray(i, i + BLOC));
  }
  return btoa(binaire);
}

export async function extraireBonCommande(brut: File): Promise<ExtractionBC> {
  const fichier = await preparer(brut);

  const { data, error } = await supabase.functions.invoke<{ extraction: ExtractionBC }>(
    "extraire-bc",
    { body: { fichierBase64: await fichierEnBase64(fichier), mimeType: fichier.type } }
  );

  if (error) throw new Error(`Lecture du bon impossible : ${error.message}`);
  if (!data?.extraction) throw new Error("Lecture du bon impossible : réponse vide.");

  return {
    ...data.extraction,
    lignes: data.extraction.lignes ?? [],
    avertissements: data.extraction.avertissements ?? [],
  };
}

/** Convertit l'extraction en brouillon pour le formulaire de bon de commande. */
export function versSaisieBonCommande(e: ExtractionBC): Record<string, unknown> {
  const statutsValides = ["occupé", "vacant", "commune"];
  const logementStatut = statutsValides.includes(e.logementStatut ?? "")
    ? e.logementStatut
    : undefined;

  return {
    client: e.client ?? "",
    interlocuteur: e.interlocuteur ?? "",
    numeroBC: e.numeroBC ?? "",
    sansBC: !e.numeroBC,
    dateReception: e.dateBC ?? todayISO(),
    adresse: e.adresse ?? "",
    adresseLocataire: e.adresseIntervention ?? "",
    codePostal: e.codePostal ?? "",
    ville: e.ville ?? "",
    logementStatut,
    numeroLogement: e.numeroLogement ?? "",
    occupant: e.occupant ?? "",
    etage: e.etage ?? "",
    notes: e.notes ?? "",
    montant: e.montantTotalHT ?? undefined,
    lignes: e.lignes.map((l, i) => ({
      id: `ocr-${Date.now()}-${i}`,
      type: l.type,
      designation: l.designation,
      qte: l.qte ?? undefined,
      unite: l.unite ?? undefined,
      prixUnitaire: l.prixUnitaire ?? undefined,
      tva: l.tva ?? undefined,
    })),
  };
}

// ============ RAPPROCHEMENT AVEC LES CLIENTS CONNUS ============

/**
 * Le nom lu sur un bon de commande est rarement identique à celui enregistré :
 * accents absents, forme juridique accolée, casse différente, mention d'agence.
 * On rapproche donc l'extraction du fichier clients plutôt que de créer un
 * doublon ou de laisser le champ vide.
 */
function normaliser(nom: string): string {
  return nom
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/\b(SA|SAS|SASU|SARL|EURL|SCI|OPH|HLM|SA HLM|OFFICE PUBLIC DE L HABITAT)\b/g, " ")
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
}

/** Mots significatifs, hors termes trop courants pour discriminer. */
function motsCles(nom: string): string[] {
  const vides = new Set(["DE", "DU", "DES", "LA", "LE", "LES", "ET", "L", "D"]);
  return normaliser(nom)
    .split(" ")
    .filter((m) => m.length > 2 && !vides.has(m));
}

export interface RapprochementClient {
  /** Nom retenu : celui du fichier clients si une correspondance est sûre. */
  nom: string;
  /** Vrai si le nom vient du fichier clients et non de la lecture brute. */
  reconnu: boolean;
  /** Candidats à proposer quand aucune correspondance n'est certaine. */
  suggestions: string[];
}

/**
 * Rapproche un nom lu d'une liste de clients existants.
 *
 * Prudent par construction : en dessous d'une correspondance nette, on ne
 * choisit pas à la place de l'utilisateur, on propose.
 */
export function rapprocherClient(
  nomLu: string | null | undefined,
  clientsConnus: string[]
): RapprochementClient {
  const lu = (nomLu ?? "").trim();
  if (!lu) return { nom: "", reconnu: false, suggestions: clientsConnus.slice(0, 8) };

  const cible = normaliser(lu);

  const exact = clientsConnus.find((c) => normaliser(c) === cible);
  if (exact) return { nom: exact, reconnu: true, suggestions: [] };

  // Inclusion : « ALPES ISERE HABITAT » lu pour « ALPES ISERE HABITAT (AIH) »
  const inclus = clientsConnus.filter((c) => {
    const n = normaliser(c);
    return n.includes(cible) || cible.includes(n);
  });
  if (inclus.length === 1) return { nom: inclus[0], reconnu: true, suggestions: [] };

  // Sinon, score par mots-clés partagés
  const motsLus = motsCles(lu);
  const scores = clientsConnus
    .map((c) => {
      const mots = motsCles(c);
      const communs = motsLus.filter((m) => mots.includes(m)).length;
      return { nom: c, score: communs / Math.max(1, Math.min(motsLus.length, mots.length)) };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);

  const meilleur = scores[0];
  if (meilleur && meilleur.score >= 0.8 && (!scores[1] || scores[1].score < meilleur.score)) {
    return { nom: meilleur.nom, reconnu: true, suggestions: [] };
  }

  return {
    nom: lu,
    reconnu: false,
    suggestions: [...inclus, ...scores.map((s) => s.nom)]
      .filter((v, i, t) => t.indexOf(v) === i)
      .slice(0, 8),
  };
}
