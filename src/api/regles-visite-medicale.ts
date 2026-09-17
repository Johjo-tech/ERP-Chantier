/**
 * Le suivi en santé au travail : ce qu'on enregistre, et quand la suite est due.
 *
 * Module feuille — il n'importe que des types. La même règle sert à l'écran RH
 * (la pastille rouge) et au calcul des alertes : un salarié déclaré à jour ici
 * ne doit pas paraître en retard là.
 *
 * `joursEntre` est recopié de `regles-documents-rh.ts` plutôt qu'importé : deux
 * feuilles ne s'importent pas l'une l'autre, sous peine que la première qui
 * bouge entraîne la seconde. Le coût est six lignes.
 *
 * Les dates circulent en ISO `AAAA-MM-JJ` et se comparent comme telles. Aucun
 * `new Date()` implicite : `toISOString()` bascule en UTC et, avant 1 h à
 * Paris, ferait expirer la veille une échéance valable le jour même.
 */

export interface TypeVisite {
  code: string;
  libelle: string;
  icone: string;
  /**
   * Cette visite remet le compteur à zéro.
   *
   * Une **préreprise** s'organise pendant l'arrêt, pour préparer le retour :
   * elle ne vaut pas examen d'aptitude et ne décale donc aucune échéance. Lui
   * faire repousser la périodicité laisserait un salarié sans suivi réel.
   */
  reinitialiseLEcheance: boolean;
}

export const TYPES_VISITE: readonly TypeVisite[] = [
  { code: "embauche",       libelle: "Visite d'embauche",        icone: "🧾", reinitialiseLEcheance: true  },
  { code: "periodique",     libelle: "Visite périodique",        icone: "🩺", reinitialiseLEcheance: true  },
  { code: "reprise",        libelle: "Visite de reprise",        icone: "🔄", reinitialiseLEcheance: true  },
  { code: "prereprise",     libelle: "Visite de préreprise",     icone: "📋", reinitialiseLEcheance: false },
  { code: "mi_carriere",    libelle: "Visite de mi-carrière",    icone: "⏳", reinitialiseLEcheance: true  },
  { code: "post_exposition",libelle: "Visite post-exposition",   icone: "🛡️", reinitialiseLEcheance: true  },
  { code: "a_la_demande",   libelle: "Visite à la demande",      icone: "✋", reinitialiseLEcheance: false },
] as const;

export interface RegimeSuivi {
  code: string;
  libelle: string;
  /** Délai maximal avant le prochain examen par le médecin du travail. */
  plafondMois: number;
  /** Visite intermédiaire imposée entre deux examens, quand il y en a une. */
  intermediaireMois?: number;
  reference: string;
}

/**
 * Les trois régimes, et leurs plafonds.
 *
 * Ce sont des **plafonds**, pas des périodicités : le code fixe un délai à ne
 * pas dépasser, c'est le médecin du travail qui arrête la date et l'écrit sur
 * l'avis. D'où `prochaineVisiteSuggeree`, qui propose, et
 * `depasseLePlafondLegal`, qui avertit — aucune des deux ne décide.
 */
export const REGIMES_SUIVI: readonly RegimeSuivi[] = [
  {
    code: "simple",
    libelle: "Suivi individuel simple",
    plafondMois: 60,
    reference: "art. R.4624-16 du code du travail",
  },
  {
    code: "adapte",
    libelle: "Suivi individuel adapté",
    plafondMois: 36,
    reference: "art. R.4624-17 — travail de nuit, moins de 18 ans, travailleur handicapé, grossesse",
  },
  {
    code: "renforce",
    libelle: "Suivi individuel renforcé",
    plafondMois: 48,
    intermediaireMois: 24,
    reference: "art. R.4624-28 — amiante, plomb, agents CMR, échafaudages, habilitation électrique",
  },
] as const;

export interface AvisAptitude {
  code: string;
  libelle: string;
  /** Comment l'écran doit le montrer : un avis d'inaptitude n'est pas une info. */
  gravite: "ok" | "warn" | "danger";
}

export const AVIS_APTITUDE: readonly AvisAptitude[] = [
  { code: "apte",              libelle: "Apte",                      gravite: "ok"     },
  { code: "apte_amenagements", libelle: "Apte avec aménagements",    gravite: "warn"   },
  { code: "inapte_temporaire", libelle: "Inapte temporairement",     gravite: "danger" },
  { code: "inapte",            libelle: "Inapte",                    gravite: "danger" },
] as const;

const TYPE_PAR_DEFAUT: TypeVisite = {
  code: "periodique",
  libelle: "Visite périodique",
  icone: "🩺",
  reinitialiseLEcheance: true,
};

const REGIME_PAR_DEFAUT: RegimeSuivi = REGIMES_SUIVI[0];

/**
 * Le type décrit, même pour un code retiré du catalogue.
 *
 * Une visite rangée sous un code qu'on ne connaît plus doit rester visible et
 * corrigeable, pas disparaître de l'écran en laissant sa pièce jointe dans le
 * bucket. Même repli que `typeDocumentRh`.
 */
export function typeVisite(code?: string | null): TypeVisite {
  const cherche = (code ?? "").trim();
  return TYPES_VISITE.find((t) => t.code === cherche) ?? TYPE_PAR_DEFAUT;
}

export function regimeSuivi(code?: string | null): RegimeSuivi {
  const cherche = (code ?? "").trim();
  return REGIMES_SUIVI.find((r) => r.code === cherche) ?? REGIME_PAR_DEFAUT;
}

export function avisAptitude(code?: string | null): AvisAptitude | null {
  const cherche = (code ?? "").trim();
  if (!cherche) return null;
  return (
    AVIS_APTITUDE.find((a) => a.code === cherche) ?? {
      code: cherche,
      libelle: cherche,
      gravite: "warn",
    }
  );
}

/** La visite telle que l'écran la manipule (colonnes converties en camelCase). */
export interface VisiteMedicale {
  id: string;
  salarieId: string;
  dateVisite: string;
  type: string;
  suivi: string;
  organisme?: string | null;
  medecin?: string | null;
  avis?: string | null;
  reserves?: string | null;
  prochaineVisite?: string | null;
  fichierChemin?: string | null;
  fichierNom?: string | null;
  notes?: string | null;
  creeLe?: string | null;
}

/** Jours entre deux dates ISO ; négatif si la cible est passée. */
export function joursEntre(depuis: string, jusqua?: string | null): number | null {
  const cible = Date.parse(`${(jusqua ?? "").trim()}T00:00:00Z`);
  const origine = Date.parse(`${depuis}T00:00:00Z`);
  if (Number.isNaN(cible) || Number.isNaN(origine)) return null;
  return Math.round((cible - origine) / 86_400_000);
}

/**
 * La même date, n mois plus tard.
 *
 * Le dernier jour d'un mois se rabat sur le dernier jour du mois d'arrivée :
 * le 31 mars + 1 mois vaut le 30 avril, pas le 1er mai. Sans ce rabat, une
 * échéance posée un 31 dériverait d'un jour à chaque report.
 */
export function ajouterMois(dateISO: string, mois: number): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec((dateISO ?? "").trim());
  if (!m) return null;
  const annee = Number(m[1]);
  const moisOrigine = Number(m[2]) - 1;
  const jour = Number(m[3]);

  const total = annee * 12 + moisOrigine + mois;
  const anneeCible = Math.floor(total / 12);
  const moisCible = total - anneeCible * 12;

  const dernierJour = new Date(Date.UTC(anneeCible, moisCible + 1, 0)).getUTCDate();
  const jourCible = Math.min(jour, dernierJour);

  const pad = (n: number) => String(n).padStart(2, "0");
  return `${anneeCible}-${pad(moisCible + 1)}-${pad(jourCible)}`;
}

/**
 * La prochaine échéance qu'on propose — le prochain rendez-vous dû, pas le
 * plafond légal.
 *
 * En suivi renforcé, l'examen du médecin tient quatre ans mais une visite
 * intermédiaire s'intercale à deux : c'est elle qu'il faut porter à l'agenda.
 * Le plafond, lui, sert à avertir (`depasseLePlafondLegal`).
 *
 * Rien à proposer pour une préreprise ou une visite à la demande : elles ne
 * remettent aucun compteur à zéro.
 */
export function prochaineVisiteSuggeree(
  dateVisite: string,
  suivi?: string | null,
  type?: string | null
): string | null {
  if (!typeVisite(type).reinitialiseLEcheance) return null;
  const regime = regimeSuivi(suivi);
  return ajouterMois(dateVisite, regime.intermediaireMois ?? regime.plafondMois);
}

/**
 * L'échéance saisie va-t-elle au-delà de ce que la loi tolère ?
 *
 * Un avertissement, jamais un refus : c'est le médecin qui arrête la date, et
 * l'écran n'a pas à lui dire non. Mais un dépassement se voit.
 */
export function depasseLePlafondLegal(
  dateVisite: string,
  prochaineVisite?: string | null,
  suivi?: string | null
): { depasse: boolean; plafond: string | null; regime: RegimeSuivi } {
  const regime = regimeSuivi(suivi);
  const plafond = ajouterMois(dateVisite, regime.plafondMois);
  const saisie = (prochaineVisite ?? "").trim();
  if (!plafond || !saisie) return { depasse: false, plafond, regime };
  return { depasse: saisie > plafond, plafond, regime };
}

export type EtatVisite = "aJour" | "bientot" | "depassee" | "inconnue";

/**
 * Où en est le suivi d'un salarié, d'après sa prochaine échéance.
 *
 * `inconnue` n'est pas neutre : c'est un salarié dont on ne sait pas s'il est
 * suivi, ce qui, pour l'inspection du travail, vaut un manquement. L'écran le
 * traite comme tel.
 */
export function etatVisite(
  prochaineVisite: string | null | undefined,
  aujourdHui: string,
  seuilJours: number
): { etat: EtatVisite; jours: number | null } {
  const jours = joursEntre(aujourdHui, prochaineVisite);
  if (jours === null) return { etat: "inconnue", jours: null };
  if (jours < 0) return { etat: "depassee", jours };
  if (jours <= seuilJours) return { etat: "bientot", jours };
  return { etat: "aJour", jours };
}

/**
 * Les visites de la plus récente à la plus ancienne.
 *
 * Deux examens le même jour se départagent par l'ordre d'enregistrement : la
 * correction saisie en second est celle qui fait foi.
 */
export function trierVisites(visites: VisiteMedicale[]): VisiteMedicale[] {
  return [...visites].sort((a, b) => {
    if (a.dateVisite !== b.dateVisite) return b.dateVisite.localeCompare(a.dateVisite);
    return (b.creeLe ?? "").localeCompare(a.creeLe ?? "");
  });
}

/** La visite qui fait foi, c'est-à-dire la plus récente. */
export function derniereVisite(visites: VisiteMedicale[]): VisiteMedicale | null {
  return trierVisites(visites)[0] ?? null;
}

/** L'échéance en cours d'un salarié : celle que porte sa dernière visite. */
export function echeanceEnCours(visites: VisiteMedicale[]): string | null {
  return derniereVisite(visites)?.prochaineVisite ?? null;
}

export function libelleTypeVisite(visite: VisiteMedicale): string {
  return typeVisite(visite.type).libelle;
}

export function libelleAvis(code?: string | null): string {
  return avisAptitude(code)?.libelle ?? "Avis non renseigné";
}
