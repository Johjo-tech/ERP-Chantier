import { z } from "zod";
import { videEnNull } from "@/lib/validation";
import { MOIS_PAR_AN } from "@/lib/durees";
import { joursEntre } from "./documents";

/**
 * Le suivi en santé au travail (RH-07). Port de
 * `src/api/regles-visite-medicale.ts` (parité : tests/parite/rh.essai.ts).
 *
 * Les régimes donnent des PLAFONDS, pas des périodicités : le médecin du
 * travail arrête la date. D'où `prochaineVisiteSuggeree`, qui propose, et
 * `depasseLePlafondLegal`, qui avertit — aucune des deux ne décide.
 */

export interface TypeVisite {
  code: string;
  libelle: string;
  icone: string;
  /** Une préreprise prépare le retour et ne vaut pas examen : elle ne décale aucune échéance. */
  reinitialiseLEcheance: boolean;
}

export const TYPES_VISITE: readonly TypeVisite[] = [
  { code: "embauche", libelle: "Visite d'embauche", icone: "🧾", reinitialiseLEcheance: true },
  { code: "periodique", libelle: "Visite périodique", icone: "🩺", reinitialiseLEcheance: true },
  { code: "reprise", libelle: "Visite de reprise", icone: "🔄", reinitialiseLEcheance: true },
  { code: "prereprise", libelle: "Visite de préreprise", icone: "📋", reinitialiseLEcheance: false },
  { code: "mi_carriere", libelle: "Visite de mi-carrière", icone: "⏳", reinitialiseLEcheance: true },
  { code: "post_exposition", libelle: "Visite post-exposition", icone: "🛡️", reinitialiseLEcheance: true },
  { code: "a_la_demande", libelle: "Visite à la demande", icone: "✋", reinitialiseLEcheance: false },
];

export interface RegimeSuivi {
  code: string;
  libelle: string;
  plafondMois: number;
  /** Visite intermédiaire imposée entre deux examens, quand il y en a une. */
  intermediaireMois?: number;
  reference: string;
}

export const REGIMES_SUIVI: readonly RegimeSuivi[] = [
  { code: "simple", libelle: "Suivi individuel simple", plafondMois: 60, reference: "art. R.4624-16 du code du travail" },
  { code: "adapte", libelle: "Suivi individuel adapté", plafondMois: 36, reference: "art. R.4624-17 — travail de nuit, moins de 18 ans, travailleur handicapé, grossesse" },
  {
    code: "renforce",
    libelle: "Suivi individuel renforcé",
    plafondMois: 48,
    intermediaireMois: 24,
    reference: "art. R.4624-28 — amiante, plomb, agents CMR, échafaudages, habilitation électrique",
  },
];

export interface AvisAptitude {
  code: string;
  libelle: string;
  /** Un avis d'inaptitude n'est pas une information comme une autre. */
  gravite: "ok" | "warn" | "danger";
}

export const AVIS_APTITUDE: readonly AvisAptitude[] = [
  { code: "apte", libelle: "Apte", gravite: "ok" },
  { code: "apte_amenagements", libelle: "Apte avec aménagements", gravite: "warn" },
  { code: "inapte_temporaire", libelle: "Inapte temporairement", gravite: "danger" },
  { code: "inapte", libelle: "Inapte", gravite: "danger" },
];

const TYPE_PAR_DEFAUT: TypeVisite = { code: "periodique", libelle: "Visite périodique", icone: "🩺", reinitialiseLEcheance: true };
const REGIME_PAR_DEFAUT: RegimeSuivi = { code: "simple", libelle: "Suivi individuel simple", plafondMois: 60, reference: "art. R.4624-16 du code du travail" };

/** Le type décrit, même pour un code retiré : la visite reste visible et corrigeable. */
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
  return AVIS_APTITUDE.find((a) => a.code === cherche) ?? { code: cherche, libelle: cherche, gravite: "warn" };
}

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

/**
 * La même date, n mois plus tard. Le dernier jour d'un mois se rabat sur celui
 * du mois d'arrivée (31 mars + 1 mois = 30 avril) : sans ce rabat, une
 * échéance posée un 31 dériverait d'un jour à chaque report.
 */
export function ajouterMois(dateISO: string, mois: number): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec((dateISO ?? "").trim());
  if (!m) return null;
  const total = Number(m[1]) * MOIS_PAR_AN + Number(m[2]) - 1 + mois;
  const anneeCible = Math.floor(total / MOIS_PAR_AN);
  const moisCible = total - anneeCible * MOIS_PAR_AN;
  const dernierJour = new Date(Date.UTC(anneeCible, moisCible + 1, 0)).getUTCDate();
  const jourCible = Math.min(Number(m[3]), dernierJour);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${anneeCible}-${pad(moisCible + 1)}-${pad(jourCible)}`;
}

/**
 * Le prochain rendez-vous dû, pas le plafond : en suivi renforcé, la visite
 * intermédiaire à deux ans. Rien pour une préreprise ou une visite à la demande.
 */
export function prochaineVisiteSuggeree(dateVisite: string, suivi?: string | null, type?: string | null): string | null {
  if (!typeVisite(type).reinitialiseLEcheance) return null;
  const regime = regimeSuivi(suivi);
  return ajouterMois(dateVisite, regime.intermediaireMois ?? regime.plafondMois);
}

/** L'échéance saisie dépasse-t-elle le plafond légal ? Un avertissement, jamais un refus. */
export function depasseLePlafondLegal(dateVisite: string, prochaineVisite?: string | null, suivi?: string | null): { depasse: boolean; plafond: string | null; regime: RegimeSuivi } {
  const regime = regimeSuivi(suivi);
  const plafond = ajouterMois(dateVisite, regime.plafondMois);
  const saisie = (prochaineVisite ?? "").trim();
  if (!plafond || !saisie) return { depasse: false, plafond, regime };
  return { depasse: saisie > plafond, plafond, regime };
}

export type EtatVisite = "aJour" | "bientot" | "depassee" | "inconnue";

/**
 * `inconnue` n'est pas neutre : un salarié dont on ignore l'échéance vaut, pour
 * l'inspection du travail, un salarié non suivi.
 */
export function etatVisite(prochaineVisite: string | null | undefined, aujourdHui: string, seuilJours: number): { etat: EtatVisite; jours: number | null } {
  const jours = joursEntre(aujourdHui, prochaineVisite);
  if (jours === null) return { etat: "inconnue", jours: null };
  if (jours < 0) return { etat: "depassee", jours };
  if (jours <= seuilJours) return { etat: "bientot", jours };
  return { etat: "aJour", jours };
}

/** De la plus récente à la plus ancienne ; le même jour, la saisie la plus tardive fait foi. */
export function trierVisites(visites: readonly VisiteMedicale[]): VisiteMedicale[] {
  return [...visites].sort((a, b) => {
    if (a.dateVisite !== b.dateVisite) return b.dateVisite.localeCompare(a.dateVisite);
    return (b.creeLe ?? "").localeCompare(a.creeLe ?? "");
  });
}

export function derniereVisite(visites: readonly VisiteMedicale[]): VisiteMedicale | null {
  return trierVisites(visites)[0] ?? null;
}

export function libelleAvis(code?: string | null): string {
  return avisAptitude(code)?.libelle ?? "Avis non renseigné";
}

/** Valeurs initiales du formulaire : le régime et l'organisme de la visite précédente, et l'échéance proposée d'emblée. */
export function visiteParDefaut(precedente: VisiteMedicale | null, aujourdHui: string) {
  const type = precedente ? "periodique" : "embauche";
  const suivi = precedente?.suivi ?? "simple";
  return {
    dateVisite: aujourdHui,
    type,
    suivi,
    organisme: precedente?.organisme ?? "",
    medecin: "",
    avis: "",
    reserves: "",
    prochaineVisite: prochaineVisiteSuggeree(aujourdHui, suivi, type) ?? "",
    notes: "",
  };
}

const texte = z.preprocess(videEnNull, z.string().trim().nullable());
const date = z.preprocess(videEnNull, z.iso.date("Date invalide.").nullable());

export const schemaSaisieVisite = z
  .object({
    dateVisite: z.iso.date("Indiquez la date de la visite."),
    type: z.enum(TYPES_VISITE.map((t) => t.code) as [string, ...string[]]),
    suivi: z.enum(REGIMES_SUIVI.map((r) => r.code) as [string, ...string[]]),
    organisme: texte,
    medecin: texte,
    avis: z.preprocess(videEnNull, z.enum(AVIS_APTITUDE.map((a) => a.code) as [string, ...string[]]).nullable()),
    reserves: texte,
    prochaineVisite: date,
    notes: texte,
  })
  // La base le refuse aussi (`salarie_visites_echeance_posterieure`), mais en message de contrainte.
  .refine((v) => v.prochaineVisite === null || v.prochaineVisite >= v.dateVisite, { message: "La prochaine visite ne peut pas précéder celle-ci.", path: ["prochaineVisite"] });
export type SaisieVisite = z.infer<typeof schemaSaisieVisite>;
