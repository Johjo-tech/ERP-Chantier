import { nombre, pourcentageAncien, totauxPiece } from "./montants";
import type { DevisPilotage, FacturePilotage } from "./pilotage";

/**
 * L'écran Statistiques calculé comme `computeStatsParConducteur`,
 * `computeStatsBinomesParMois`, `filtrerParPeriode` et les graphiques de
 * `renderStatistiques` (app.js l. 12057-12290), DÉFAUTS COMPRIS (D-STA-A-01) :
 * groupement par l'ÉTIQUETTE `conducteur` des pièces, retard compté sur tout
 * bon dont la fin de travaux est passée, chiffre d'affaires de toutes les
 * factures (brouillons, acomptes, avoirs en négatif).
 */

export type PeriodeStats = "tout" | "annee" | "mois";

export const PERIODES_STATS: Record<PeriodeStats, string> = {
  tout: "Tout l'historique",
  annee: "Cette année",
  mois: "Ce mois-ci",
};

const FUSEAU = "Europe/Paris";
const anneeMoisParis = new Intl.DateTimeFormat("en-CA", { timeZone: FUSEAU, year: "numeric", month: "2-digit" });

/** Année et mois (1 à 12) d'un instant, à l'heure de Paris — ce que lisait `getFullYear()` / `getMonth()` d'un poste réglé sur Paris. */
function anneeMois(d: Date): { annee: number; mois: number } {
  const parties = anneeMoisParis.formatToParts(d);
  const val = (type: string) => Number(parties.find((p) => p.type === type)?.value);
  return { annee: val("year"), mois: val("month") };
}

/**
 * `filtrerParPeriode` : `new Date(valeur)` — une date seule est lue à minuit
 * UTC, un horodatage à son instant — puis l'année (et le mois) comparés à
 * ceux de maintenant. Sans valeur, ou illisible : hors période.
 */
export function filtrerParPeriode<T>(items: readonly T[], valeur: (it: T) => string | null | undefined, periode: PeriodeStats, maintenant: Date): T[] {
  if (periode === "tout") return [...items];
  const ici = anneeMois(maintenant);
  return items.filter((it) => {
    const d = valeur(it);
    if (!d) return false;
    const dt = new Date(d);
    if (Number.isNaN(dt.getTime())) return false;
    const la = anneeMois(dt);
    if (periode === "annee") return la.annee === ici.annee;
    return la.annee === ici.annee && la.mois === ici.mois;
  });
}

const MOIS_COURTS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"] as const;
const DECIMAL = 10;

/** « 2026-09 » → « Sep 2026 » (`moisLabelCourt`). */
export function moisLabelCourt(moisIso: string): string {
  const [an, m] = moisIso.split("-");
  return `${MOIS_COURTS[parseInt(m ?? "", DECIMAL) - 1] ?? "undefined"} ${an ?? ""}`;
}

/** La période en toutes lettres, dans « Période affichée : … » (`periodeLabel`). */
export function periodeLabel(periode: PeriodeStats, jour: string, maintenant: Date): string {
  if (periode === "mois") return moisLabelCourt(jour.slice(0, "AAAA-MM".length));
  if (periode === "annee") return String(anneeMois(maintenant).annee);
  return "tout l'historique";
}

/** Un bon tel que les statistiques le lisent. `travauxSupplementaires` : aucune colonne ne le porte, l'ancien lisait donc toujours une liste vide. */
export interface BonStats {
  id: string;
  cree_le: string | null;
  conducteur: string | null;
  technicien: string | null;
  bon_commande_parent_id: string | null;
  date_fin_travaux: string | null;
  travauxSupplementaires?: readonly { texte: string }[];
  lignes?: readonly { type: string | null; designation: string | null; quantite: number | string | null; prix_unitaire: number | string | null }[];
}

export interface StatConducteurAncien {
  nom: string;
  bcTotal: number;
  bcSAV: number;
  tauxSAV: number;
  bcEnRetard: number;
  bcDansLesTemps: number;
  tauxDansLesTemps: number;
  nbTravSup: number;
  montantTravSup: number;
  tauxTravSup: number;
  ca: number;
  devisTotal: number;
  devisAcceptes: number;
  tauxDevisAccepte: number;
  devisTransformes: number;
  tauxDevisTransforme: number;
}

export interface DonneesStats {
  bons: readonly BonStats[];
  devis: readonly DevisPilotage[];
  factures: readonly FacturePilotage[];
  /** Les noms des fiches de conducteur de la société, dans l'ordre de lecture. */
  conducteurs: readonly string[];
}

/** Les trois tuiles : devis et factures par leur date, bons par leur création. */
export function totauxStats(d: DonneesStats, periode: PeriodeStats, maintenant: Date): { devis: number; factures: number; bons: number } {
  return {
    devis: filtrerParPeriode(d.devis, (x) => x.date, periode, maintenant).length,
    factures: filtrerParPeriode(d.factures, (x) => x.date, periode, maintenant).length,
    bons: filtrerParPeriode(d.bons, (x) => x.cree_le, periode, maintenant).length,
  };
}

const etiquette = (x: { conducteur: string | null }) => x.conducteur || "";

/**
 * `computeStatsParConducteur` : une ligne par NOM — celui des fiches, puis
 * les étiquettes portées par les bons, devis et factures de la période —,
 * triée par chiffre d'affaires décroissant.
 */
export function statsParConducteur(d: DonneesStats, periode: PeriodeStats, jour: string, maintenant: Date): StatConducteurAncien[] {
  const bons = filtrerParPeriode(d.bons, (b) => b.cree_le, periode, maintenant);
  const devis = filtrerParPeriode(d.devis, (x) => x.date, periode, maintenant);
  const factures = filtrerParPeriode(d.factures, (f) => f.date, periode, maintenant);
  const noms = Array.from(new Set([...d.conducteurs, ...bons.map(etiquette), ...devis.map(etiquette), ...factures.map(etiquette)].filter((n) => n !== "")));
  return noms
    .map((nom) => {
      const bcs = bons.filter((b) => etiquette(b) === nom);
      const bcTotal = bcs.length;
      const bcSAV = bcs.filter((b) => !!b.bon_commande_parent_id).length;
      const bcEnRetard = bcs.filter((b) => !!b.date_fin_travaux && b.date_fin_travaux < jour).length;
      const bcDansLesTemps = bcTotal - bcEnRetard;
      const bcAvecTravSup = bcs.filter((b) => (b.travauxSupplementaires ?? []).length > 0).length;
      const nbTravSup = bcs.reduce((s, b) => s + (b.travauxSupplementaires ?? []).length, 0);
      const montantTravSup = bcs.reduce((s, b) => {
        const textes = (b.travauxSupplementaires ?? []).map((t) => t.texte);
        const lignes = (b.lignes ?? []).filter((l) => (l.type || "ligne") === "ligne" && textes.includes(l.designation ?? ""));
        return s + lignes.reduce((s2, l) => s2 + nombre(l.quantite) * nombre(l.prix_unitaire), 0);
      }, 0);
      const devisC = devis.filter((x) => etiquette(x) === nom);
      const devisAcceptes = devisC.filter((x) => x.statut === "accepté").length;
      const devisTransformes = devisC.filter((x) => factures.some((f) => f.devis_id === x.id)).length;
      const ca = factures.filter((f) => etiquette(f) === nom).reduce((s, f) => s + totauxPiece(f).ht, 0);
      return {
        nom,
        bcTotal,
        bcSAV,
        tauxSAV: pourcentageAncien(bcSAV, bcTotal),
        bcEnRetard,
        bcDansLesTemps,
        tauxDansLesTemps: pourcentageAncien(bcDansLesTemps, bcTotal),
        nbTravSup,
        montantTravSup,
        tauxTravSup: pourcentageAncien(bcAvecTravSup, bcTotal),
        ca,
        devisTotal: devisC.length,
        devisAcceptes,
        tauxDevisAccepte: pourcentageAncien(devisAcceptes, devisC.length),
        devisTransformes,
        tauxDevisTransforme: pourcentageAncien(devisTransformes, devisC.length),
      };
    })
    .sort((a, b) => b.ca - a.ca);
}

// ---------- Graphiques ----------

/** `renderStatsCARepartitionHTML` : la part de chacun, `Math.round(ca / total × 100)` ; `null` sans total (message vide). */
export function repartitionCA(stats: readonly StatConducteurAncien[]): { stat: StatConducteurAncien; part: number }[] | null {
  const total = stats.reduce((s, x) => s + x.ca, 0);
  if (!total) return null;
  return [...stats].sort((a, b) => b.ca - a.ca).map((stat) => ({ stat, part: Math.round((stat.ca / total) * 100) }));
}

/**
 * `renderStatsRetardHTML` : dans les temps / en retard. Un conducteur sans bon
 * se divise par 1 : 0 % dans les temps, donc une barre rouge pleine à « 0 / 0 ».
 * `null` quand personne n'a de bon (message vide).
 */
export function retardParConducteur(stats: readonly StatConducteurAncien[]): { stat: StatConducteurAncien; pctOk: number; pctRetard: number }[] | null {
  if (!stats.reduce((s, x) => s + x.bcTotal, 0)) return null;
  return stats.map((stat) => {
    const pctOk = Math.round((stat.bcDansLesTemps / (stat.bcTotal || 1)) * 100);
    return { stat, pctOk, pctRetard: 100 - pctOk };
  });
}

// ---------- Chiffre d'affaires par équipe et par mois ----------

export const NON_ATTRIBUE = "Non attribué";

/** Une équipe : son nom, sinon son métier, sinon « Équipe » (`technicienLabel`). */
export interface EquipeStats {
  id: string;
  nom: string | null;
  metier?: string | null;
  metiers?: readonly string[] | null;
}

export function technicienLabel(t: EquipeStats): string {
  return t.nom || t.metier || t.metiers?.[0] || "Équipe";
}

export interface TableauEquipesAncien {
  mois: string[];
  binomes: string[];
  parBinome: Record<string, Record<string, number>>;
}

/**
 * `computeStatsBinomesParMois` : chaque facture datée de la période, à
 * l'équipe désignée par la colonne `technicien` de son bon (uuid ou libellé),
 * « Non attribué » sinon. Équipes par ordre alphabétique (`localeCompare` du
 * poste), « Non attribué » en dernier.
 */
export function equipesParMois(factures: readonly FacturePilotage[], bons: readonly BonStats[], equipes: readonly EquipeStats[], periode: PeriodeStats, maintenant: Date): TableauEquipesAncien {
  const moisVus = new Set<string>();
  const parBinome: Record<string, Record<string, number>> = {};
  for (const f of filtrerParPeriode(factures, (x) => x.date, periode, maintenant)) {
    const mois = (f.date || "").slice(0, "AAAA-MM".length);
    if (!mois) continue;
    const bc = f.bon_commande_id ? bons.find((b) => b.id === f.bon_commande_id) : null;
    const tech = bc && bc.technicien ? equipes.find((t) => t.id === bc.technicien || technicienLabel(t) === bc.technicien) : null;
    const label = tech ? technicienLabel(tech) : NON_ATTRIBUE;
    moisVus.add(mois);
    const ligne = (parBinome[label] ??= {});
    ligne[mois] = (ligne[mois] || 0) + totauxPiece(f).ht;
  }
  const binomes = Object.keys(parBinome).sort((a, b) => (a === NON_ATTRIBUE ? 1 : b === NON_ATTRIBUE ? -1 : a.localeCompare(b)));
  return { mois: [...moisVus].sort(), binomes, parBinome };
}

/** Le total d'une équipe sur les mois affichés. */
export function totalEquipe(t: TableauEquipesAncien, binome: string): number {
  return t.mois.reduce((s, m) => s + (t.parBinome[binome]?.[m] || 0), 0);
}
