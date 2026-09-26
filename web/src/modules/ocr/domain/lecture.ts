import type { ExtractionBC } from "./contrat";

/**
 * Ce que la lecture n'a pas trouvé et dont tout l'aval dépend (port de
 * `essentielsDeLecture`, src/api/regles-bc.ts) : le numéro du bon, l'adresse du
 * chantier, au moins une ligne de travaux. Dit, jamais bloquant.
 */
export function essentielsManquants(e: Pick<ExtractionBC, "numeroBC" | "adresse" | "lignes">): string[] {
  const manques: string[] = [];
  if ((e.numeroBC ?? "").trim() === "") {
    manques.push("numéro de bon non lu — vérifiez-le sur le document, ou cochez « Sans BC » / « En attente de BC »");
  }
  if ((e.adresse ?? "").trim() === "") {
    manques.push("adresse du chantier non lue — c'est elle qui devient le « Lieu d'intervention » de la facture");
  }
  if (!e.lignes.some((l) => l.type === "ligne" && l.designation.trim() !== "")) {
    manques.push("aucune ligne de travaux lue — décrivez en gros ce qu'il y a à faire");
  }
  return manques;
}

/** Le délai au-delà duquel on rend la main (l'ancien écran : 120 s). */
export const DELAI_LECTURE_MS = 120_000;

/*
 * Ce que l'écran dit pendant la lecture (port de `src/api/regles-ocr.ts`,
 * OCR-02, OCR-11 ; parité : tests/parite/ocr.essai.ts). Rien, dans le
 * navigateur, ne dit où en est la lecture : les étapes et les seuils le disent
 * pour lui, et une lecture morte côté serveur ne laisse plus une phrase figée.
 */
export const ETAPES_LECTURE = ["preparation", "encodage", "envoi", "analyse"] as const;
export type EtapeLecture = (typeof ETAPES_LECTURE)[number];

export const DUREE_HABITUELLE_MS = 30_000;
export const SEUIL_PLUS_LONG_QUE_DHABITUDE_MS = 45_000;
/** `fetch` ne rapporte pas l'envoi : passé deux secondes, ce qu'on attend est le modèle, plus l'envoi. */
export const DELAI_BASCULE_ANALYSE_MS = 2_000;

const MS_PAR_S = 1000;
const S_PAR_MIN = 60;

export const LIBELLES_ETAPE: Record<EtapeLecture, string> = {
  preparation: "Préparation du document",
  encodage: "Préparation du document",
  envoi: "Envoi du document",
  analyse: "Lecture par le modèle",
};

/** Les étapes telles que l'écran les montre : trois, l'encodage se confondant avec la préparation. */
export const ETAPES_AFFICHEES: readonly EtapeLecture[] = ["preparation", "envoi", "analyse"];

/** « 1 min 05 » se lit mieux que « 65 s » passé la minute. */
export function formaterDuree(ms: number): string {
  const total = Math.max(0, Math.floor(ms / MS_PAR_S));
  if (total < S_PAR_MIN) return `${total} s`;
  return `${Math.floor(total / S_PAR_MIN)} min ${String(total % S_PAR_MIN).padStart(2, "0")}`;
}

export const attenteAnnoncee = () => `Cela prend habituellement ${formaterDuree(DUREE_HABITUELLE_MS)}.`;

export interface EtatLecture {
  libelle: string;
  ton: "neutre" | "attention" | "erreur";
  alerte: string | null;
  enCours: boolean;
}

/** L'état à afficher pendant la lecture, d'après l'étape et le temps écoulé (etatLecture, sans évènements serveur). */
export function etatLecture(etape: EtapeLecture, msEcoules: number): EtatLecture {
  if (msEcoules >= SEUIL_PLUS_LONG_QUE_DHABITUDE_MS) {
    return { libelle: LIBELLES_ETAPE[etape], ton: "attention", alerte: "C'est plus long que d'habitude. La lecture est toujours en cours.", enCours: true };
  }
  return { libelle: LIBELLES_ETAPE[etape], ton: "neutre", alerte: null, enCours: true };
}

/** Les trois issues d'une lecture qui n'aboutit pas : chacune a son écran (OCR-03). */
export function etatAnnule(msEcoules: number): EtatLecture {
  return { libelle: `Lecture interrompue après ${formaterDuree(msEcoules)}`, ton: "neutre", alerte: "Le formulaire reste tel quel — vous pouvez saisir le bon à la main.", enCours: false };
}

export function etatDelaiDepasse(msEcoules: number): EtatLecture {
  return { libelle: `Aucune réponse après ${formaterDuree(msEcoules)}`, ton: "erreur", alerte: "Le service de lecture n'a pas répondu. Réessayez, ou saisissez le bon à la main.", enCours: false };
}

/**
 * Ce que dit le bloc `#ocrStatut` sous le bouton de lecture, une fois le
 * formulaire prérempli (`lireBonCommande`) : ce qu'il reste à vérifier — le
 * client quand il n'est pas reconnu, les avertissements de la lecture — ou
 * rien que la relecture d'usage.
 */
export function compteRenduLecture(avertissements: readonly string[], client: { nom: string; reconnu: boolean }): { texte: string; aVerifier: boolean } {
  const messages: string[] = [];
  if (!client.nom) messages.push("client non détecté");
  else if (!client.reconnu) messages.push(`client « ${client.nom} » à confirmer`);
  messages.push(...avertissements);
  return messages.length
    ? { texte: `Document lu — à vérifier : ${messages.join(" · ")}`, aVerifier: true }
    : { texte: "Document lu — vérifiez les champs avant d'enregistrer.", aVerifier: false };
}

export function etatEchec(message: string): EtatLecture {
  return { libelle: "Lecture impossible", ton: "erreur", alerte: message, enCours: false };
}
