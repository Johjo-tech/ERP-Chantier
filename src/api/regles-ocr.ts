/**
 * Ce que l'écran dit pendant la lecture automatique d'un bon de commande.
 *
 * La lecture passe par deux appels distants — un OCR, puis une structuration :
 * elle dure entre quelques secondes et deux minutes, et rien, dans le
 * navigateur, ne permet de deviner où elle en est. Jusqu'ici l'écran affichait une phrase figée. Le 14/09/2026,
 * une lecture est morte côté serveur sans émettre de réponse : cette phrase
 * serait restée à l'écran indéfiniment, sans moyen de savoir s'il fallait
 * attendre ou recommencer.
 *
 * Les seuils et les formulations vivent ici, et pas dans `index.html` qui n'a
 * aucun test. C'est aussi ce qui permet à l'écran d'être écrit une seule fois :
 * il sait déjà nommer un réessai du serveur, que cet évènement lui parvienne
 * ou non.
 */

/** Les étapes, dans l'ordre où elles surviennent. */
export const ETAPES_LECTURE = [
  "preparation",
  "encodage",
  "envoi",
  "analyse",
] as const;

export type EtapeLecture = (typeof ETAPES_LECTURE)[number];

/** Ce que le serveur peut signaler en cours de route. */
export type EvenementLecture =
  | { type: "saturation"; modele: string }
  | { type: "bascule"; modele: string };

/** Ce qu'une lecture met d'ordinaire : sert à annoncer l'attente, pas à la borner. */
export const DUREE_HABITUELLE_MS = 30_000;

/** Au-delà, on le dit — sans alarmer : long n'est pas cassé. */
export const SEUIL_PLUS_LONG_QUE_DHABITUDE_MS = 45_000;

/**
 * Délai au bout duquel le navigateur rend la main de lui-même.
 *
 * Délibérément plus long que le budget du serveur (110 s) : en marche normale
 * c'est le message précis du serveur qui doit gagner, celui-ci n'étant qu'un
 * filet pour le cas où le serveur meurt sans rien dire.
 */
export const DELAI_LECTURE_MS = 120_000;

/**
 * Au bout de ce délai, ce qu'on attend n'est plus l'envoi mais le modèle.
 *
 * `fetch` ne rapporte aucune progression de téléversement : le navigateur ne
 * sait pas distinguer les deux. Comme le document a été ramené sous 14 Mo — et
 * qu'il en fait moins d'un dans l'immense majorité des cas — deux secondes
 * suffisent à l'envoyer sur toute liaison utilisable. Afficher « Envoi » au-delà
 * serait faux.
 */
export const DELAI_BASCULE_ANALYSE_MS = 2_000;

export type TonLecture = "neutre" | "attention" | "erreur";

export interface EtatLecture {
  /** Ce que l'écran affiche comme activité en cours. */
  libelle: string;
  ton: TonLecture;
  /** Ce qui mérite une ligne à part : un réessai, une attente inhabituelle. */
  alerte: string | null;
  /** Faux une fois la lecture terminée, annulée ou abandonnée. */
  enCours: boolean;
}

const LIBELLES: Record<EtapeLecture, string> = {
  preparation: "Préparation du document",
  encodage: "Préparation du document",
  envoi: "Envoi du document",
  analyse: "Lecture par le modèle",
};

/** « 1 min 05 » se lit mieux que « 65 s » passé la minute. */
export function formaterDuree(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  if (total < 60) return `${total} s`;
  const minutes = Math.floor(total / 60);
  const secondes = total % 60;
  return `${minutes} min ${String(secondes).padStart(2, "0")}`;
}

/** La durée annoncée à l'utilisateur avant qu'il ne commence à s'inquiéter. */
export function attenteAnnoncee(): string {
  return `Cela prend habituellement ${formaterDuree(DUREE_HABITUELLE_MS)}.`;
}

/**
 * L'état à afficher, à partir de l'étape, du temps écoulé et de ce que le
 * serveur a bien voulu dire.
 *
 * Fonction pure : c'est elle que les tests éprouvent, l'écran ne fait que la
 * rendre.
 */
export function etatLecture(
  etape: EtapeLecture,
  msEcoules: number,
  evenements: EvenementLecture[] = []
): EtatLecture {
  const dernier = evenements[evenements.length - 1];

  if (dernier?.type === "saturation") {
    return {
      libelle: LIBELLES[etape],
      ton: "attention",
      alerte: `${dernier.modele} est saturé — nouvelle tentative sur un autre modèle.`,
      enCours: true,
    };
  }

  if (dernier?.type === "bascule") {
    return {
      libelle: LIBELLES[etape],
      ton: "attention",
      alerte: `Lecture reprise avec ${dernier.modele}.`,
      enCours: true,
    };
  }

  if (msEcoules >= SEUIL_PLUS_LONG_QUE_DHABITUDE_MS) {
    return {
      libelle: LIBELLES[etape],
      ton: "attention",
      alerte: "C'est plus long que d'habitude. La lecture est toujours en cours.",
      enCours: true,
    };
  }

  return { libelle: LIBELLES[etape], ton: "neutre", alerte: null, enCours: true };
}

/** Ce qu'on affiche quand l'utilisateur renonce : ce n'est pas une panne. */
export function etatAnnule(msEcoules: number): EtatLecture {
  return {
    libelle: `Lecture interrompue après ${formaterDuree(msEcoules)}`,
    ton: "neutre",
    alerte: "Le formulaire reste tel quel — vous pouvez saisir le bon à la main.",
    enCours: false,
  };
}

/** Et quand le serveur n'a rien dit du tout — le défaut du 14/09. */
export function etatDelaiDepasse(msEcoules: number): EtatLecture {
  return {
    libelle: `Aucune réponse après ${formaterDuree(msEcoules)}`,
    ton: "erreur",
    alerte:
      "Le service de lecture n'a pas répondu. Réessayez, ou saisissez le bon à la main.",
    enCours: false,
  };
}

export function etatEchec(message: string): EtatLecture {
  return { libelle: "Lecture impossible", ton: "erreur", alerte: message, enCours: false };
}
