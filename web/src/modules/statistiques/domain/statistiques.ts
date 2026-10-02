import { montant, somme, ZERO, type Montant } from "@/lib/money";
import { CIRCUIT_CLOS } from "@/modules/planning/domain/filtres";
import { estBrouillon, htCompte, pourcentage, type DevisStats, type FactureStats } from "./pieces";

/**
 * L'écran Statistiques, dans la forme de `renderStatistiques` (mêmes tuiles,
 * mêmes colonnes, mêmes graphiques, mêmes périodes), sans les défauts de
 * l'ancien calcul (D-STA-B-01) : par la RÉFÉRENCE du conducteur avec une
 * ligne « Sans conducteur » (DEF-STA-08), retard sur un bon encore ouvert
 * (DEF-STA-09), pas de barre pour qui n'a aucun bon (DEF-STA-10), travaux
 * supplémentaires lus dans leur table (DEF-STA-11), part des seuls chiffres
 * d'affaires positifs (DEF-STA-17), bons rangés par leur date de commande
 * (DEF-STA-18), chiffre d'affaires des pièces émises (DEF-STA-01).
 */

export type PeriodeStats = "tout" | "annee" | "mois";

export const PERIODES_STATS: Record<PeriodeStats, string> = {
  tout: "Tout l'historique",
  annee: "Cette année",
  mois: "Ce mois-ci",
};

const FUSEAU = "Europe/Paris";
const anneeMoisParis = new Intl.DateTimeFormat("en-CA", { timeZone: FUSEAU, year: "numeric", month: "2-digit" });

/** Année et mois (1 à 12) d'un instant, à l'heure de Paris. */
function anneeMois(d: Date): { annee: number; mois: number } {
  const parties = anneeMoisParis.formatToParts(d);
  const val = (type: string) => Number(parties.find((p) => p.type === type)?.value);
  return { annee: val("year"), mois: val("month") };
}

/**
 * `filtrerParPeriode` : `new Date(valeur)` — une date seule est lue à minuit
 * UTC, un horodatage à son instant — puis l'année (et le mois) comparés à
 * ceux de maintenant, à Paris. Sans valeur, ou illisible : hors période.
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

/** Un bon tel que les statistiques le lisent (vue terrain). */
export interface BonStats {
  id: string;
  cree_le: string | null;
  /** La date du bon de commande : celle de la commande du client. */
  date: string | null;
  date_reception: string | null;
  conducteur_id: string | null;
  conducteur: string | null;
  technicien: string | null;
  bon_commande_parent_id: string | null;
  date_fin_travaux: string | null;
  statut_workflow: string | null;
}

/** Une fiche de conducteur, active ou non : l'ancien les prenait toutes. */
export interface FicheConducteur {
  id: string;
  nom: string | null;
}

/** L'état d'une tâche de terrain : dit si le bon a tout pointé. */
export interface TacheStats {
  bon_commande_id: string | null;
  statut: string;
}

/** Un travail supplémentaire signalé sur un bon (`tache_travaux_supplementaires`). */
export interface TravailStats {
  bon_commande_id: string;
  statut: string;
  quantite: number | string | null;
  prix_vente_ht: number | string | null;
}

export interface DonneesStats {
  bons: readonly BonStats[];
  devis: readonly DevisStats[];
  factures: readonly FactureStats[];
  conducteurs: readonly FicheConducteur[];
  taches: readonly TacheStats[];
  travaux: readonly TravailStats[];
}

/**
 * La date qui range un bon dans la période (DEF-STA-18) : celle de la
 * COMMANDE — le bon se range comme devis et factures, par la date de la
 * pièce —, sinon sa réception, et seulement faute des deux sa saisie. Saisir
 * aujourd'hui un bon du mois dernier ne le fait plus compter ce mois-ci.
 */
export const dateDuBon = (b: Pick<BonStats, "date" | "date_reception" | "cree_le">): string | null => b.date || b.date_reception || b.cree_le;

/** Les trois tuiles : devis par leur date, factures comptées au chiffre d'affaires par leur date, bons par leur date de commande. */
export function totauxStats(d: Pick<DonneesStats, "bons" | "devis" | "factures">, periode: PeriodeStats, maintenant: Date): { devis: number; factures: number; bons: number } {
  return {
    devis: filtrerParPeriode(d.devis, (x) => x.date, periode, maintenant).length,
    factures: filtrerParPeriode(
      d.factures.filter((f) => htCompte(f) !== null),
      (x) => x.date,
      periode,
      maintenant
    ).length,
    bons: filtrerParPeriode(d.bons, dateDuBon, periode, maintenant).length,
  };
}

const TACHE_FAITE = ["realisee", "validee"];

/**
 * Un bon encore ouvert (D-STA-05) : ni chiffré, ni facturé, ni clos, aucune
 * facture ne le désigne, et le terrain n'a pas tout pointé. Seul un bon
 * ouvert peut être « en retard » : un bon facturé l'était à vie (DEF-STA-09).
 */
export function bonOuvert(b: Pick<BonStats, "id" | "statut_workflow">, facturesDesBons: ReadonlySet<string>, tachesParBon: ReadonlyMap<string, readonly TacheStats[]>): boolean {
  if (CIRCUIT_CLOS.includes(b.statut_workflow ?? "") || facturesDesBons.has(b.id)) return false;
  const taches = tachesParBon.get(b.id) ?? [];
  return !(taches.length > 0 && taches.every((t) => TACHE_FAITE.includes(t.statut)));
}

/** Un travail refusé n'a pas eu lieu ; seul un travail chiffré (ou intégré à la pré-facture) a un montant. */
const TRAVAIL_REFUSE = "refuse";
const TRAVAIL_CHIFFRE = ["chiffre", "integre"];

function travauxParBon(travaux: readonly TravailStats[]): Map<string, { nombre: number; ht: Montant }> {
  const m = new Map<string, { nombre: number; ht: Montant }>();
  for (const t of travaux) {
    if (t.statut === TRAVAIL_REFUSE) continue;
    const avant = m.get(t.bon_commande_id) ?? { nombre: 0, ht: ZERO };
    // Une quantité absente vaut 1 : un travail signalé sans quantité est un forfait.
    const ht = TRAVAIL_CHIFFRE.includes(t.statut) ? (t.quantite == null ? montant(1) : montant(t.quantite)).times(montant(t.prix_vente_ht)) : ZERO;
    m.set(t.bon_commande_id, { nombre: avant.nombre + 1, ht: avant.ht.plus(ht) });
  }
  return m;
}

function grouperParBon<T extends { bon_commande_id: string | null }>(lignes: readonly T[]): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const l of lignes) if (l.bon_commande_id) m.set(l.bon_commande_id, [...(m.get(l.bon_commande_id) ?? []), l]);
  return m;
}

/** La ligne des pièces sans conducteur : elles ne disparaissent plus des statistiques (DEF-STA-08). */
export const SANS_CONDUCTEUR = "Sans conducteur";
const CLE_SANS = "";

export interface StatConducteur {
  /** `conducteur_id`, ou "" pour la ligne « Sans conducteur ». */
  cle: string;
  nom: string;
  bcTotal: number;
  bcSAV: number;
  tauxSAV: number;
  bcEnRetard: number;
  bcDansLesTemps: number;
  tauxDansLesTemps: number;
  nbTravSup: number;
  montantTravSup: Montant;
  tauxTravSup: number;
  ca: Montant;
  devisTotal: number;
  devisAcceptes: number;
  tauxDevisAccepte: number;
  devisTransformes: number;
  tauxDevisTransforme: number;
}

const cleDe = (x: { conducteur_id: string | null }) => x.conducteur_id ?? CLE_SANS;

/**
 * Les lignes et leur nom : chaque fiche (dans l'ordre de lecture, comme
 * l'ancien), puis une référence que portent les pièces sans fiche lisible
 * (nommée par l'étiquette de la pièce), puis « Sans conducteur » si une pièce
 * n'en a pas.
 */
function lignesDeConducteurs(fiches: readonly FicheConducteur[], pieces: readonly { conducteur_id: string | null; conducteur: string | null }[]): { cle: string; nom: string }[] {
  const lignes = new Map<string, string>(fiches.map((f) => [f.id, f.nom ?? ""]));
  for (const p of pieces) if (p.conducteur_id && !lignes.has(p.conducteur_id)) lignes.set(p.conducteur_id, p.conducteur || p.conducteur_id);
  const sortie = [...lignes.entries()].map(([cle, nom]) => ({ cle, nom }));
  return pieces.some((p) => !p.conducteur_id) ? [...sortie, { cle: CLE_SANS, nom: SANS_CONDUCTEUR }] : sortie;
}

/**
 * `computeStatsParConducteur` corrigé : une ligne par RÉFÉRENCE de
 * conducteur, triée par chiffre d'affaires décroissant (tri stable : à
 * égalité, l'ordre des fiches).
 */
export function statsParConducteur(d: DonneesStats, periode: PeriodeStats, jour: string, maintenant: Date): StatConducteur[] {
  const bons = filtrerParPeriode(d.bons, dateDuBon, periode, maintenant);
  const devis = filtrerParPeriode(d.devis, (x) => x.date, periode, maintenant);
  const factures = filtrerParPeriode(d.factures, (f) => f.date, periode, maintenant);
  const facturesDesBons = new Set(d.factures.map((f) => f.bon_commande_id).filter((id): id is string => !!id));
  const tachesParBon = grouperParBon(d.taches);
  const travaux = travauxParBon(d.travaux);
  return lignesDeConducteurs(d.conducteurs, [...bons, ...devis, ...factures])
    .map(({ cle, nom }) => {
      const bcs = bons.filter((b) => cleDe(b) === cle);
      const bcTotal = bcs.length;
      const bcSAV = bcs.filter((b) => !!b.bon_commande_parent_id).length;
      const bcEnRetard = bcs.filter((b) => !!b.date_fin_travaux && b.date_fin_travaux < jour && bonOuvert(b, facturesDesBons, tachesParBon)).length;
      const bcDansLesTemps = bcTotal - bcEnRetard;
      const travauxDesBons = bcs.map((b) => travaux.get(b.id)).filter((t): t is { nombre: number; ht: Montant } => !!t);
      const devisC = devis.filter((x) => cleDe(x) === cle);
      const devisAcceptes = devisC.filter((x) => x.statut === "accepté").length;
      // « Transformé » = une facture a été ÉMISE pour ce devis (le libellé de l'écran) : un brouillon ne l'est pas.
      const devisTransformes = devisC.filter((x) => factures.some((f) => f.devis_id === x.id && !estBrouillon(f))).length;
      return {
        cle,
        nom,
        bcTotal,
        bcSAV,
        tauxSAV: pourcentage(bcSAV, bcTotal),
        bcEnRetard,
        bcDansLesTemps,
        tauxDansLesTemps: pourcentage(bcDansLesTemps, bcTotal),
        nbTravSup: travauxDesBons.reduce((s, t) => s + t.nombre, 0),
        montantTravSup: somme(travauxDesBons.map((t) => t.ht)),
        tauxTravSup: pourcentage(travauxDesBons.length, bcTotal),
        ca: somme(factures.filter((f) => cleDe(f) === cle).map((f) => htCompte(f) ?? ZERO)),
        devisTotal: devisC.length,
        devisAcceptes,
        tauxDevisAccepte: pourcentage(devisAcceptes, devisC.length),
        devisTransformes,
        tauxDevisTransforme: pourcentage(devisTransformes, devisC.length),
      };
    })
    .sort((a, b) => b.ca.cmp(a.ca));
}

// ---------- Graphiques ----------

/**
 * `renderStatsCARepartitionHTML` corrigé : la part de chacun dans le total
 * des chiffres d'affaires qui ne sont pas NÉGATIFS — un conducteur dont les
 * avoirs l'emportent sort de la répartition (sa part était négative, et
 * celles des autres dépassaient 100 %, DEF-STA-17) ; un conducteur à zéro
 * garde sa ligne à 0 %, comme l'ancien. `null` sans total (message vide).
 */
export function repartitionCA(stats: readonly StatConducteur[]): { stat: StatConducteur; part: number }[] | null {
  const comptes = stats.filter((s) => s.ca.gte(ZERO));
  const total = somme(comptes.map((s) => s.ca));
  if (total.eq(ZERO)) return null;
  return [...comptes].sort((a, b) => b.ca.cmp(a.ca)).map((stat) => ({ stat, part: pourcentage(stat.ca, total) }));
}

/**
 * `renderStatsRetardHTML` : dans les temps / en retard. Corrigé : un
 * conducteur sans bon a une barre VIDE (0 % et 0 %), plus une barre rouge
 * pleine à « 0 / 0 » (DEF-STA-10). `null` quand personne n'a de bon.
 */
export function retardParConducteur(stats: readonly StatConducteur[]): { stat: StatConducteur; pctOk: number; pctRetard: number }[] | null {
  if (!stats.reduce((s, x) => s + x.bcTotal, 0)) return null;
  return stats.map((stat) => {
    if (!stat.bcTotal) return { stat, pctOk: 0, pctRetard: 0 };
    const pctOk = pourcentage(stat.bcDansLesTemps, stat.bcTotal);
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

export interface TableauEquipes {
  mois: string[];
  binomes: string[];
  parBinome: Record<string, Record<string, Montant>>;
}

/**
 * `computeStatsBinomesParMois` : chaque pièce comptée au chiffre d'affaires,
 * datée de la période, à l'équipe désignée par la colonne `technicien` de son
 * bon (uuid ou libellé), « Non attribué » sinon. Équipes par ordre
 * alphabétique, « Non attribué » en dernier.
 */
export function equipesParMois(factures: readonly FactureStats[], bons: readonly BonStats[], equipes: readonly EquipeStats[], periode: PeriodeStats, maintenant: Date): TableauEquipes {
  const moisVus = new Set<string>();
  const parBinome: Record<string, Record<string, Montant>> = {};
  for (const f of filtrerParPeriode(factures, (x) => x.date, periode, maintenant)) {
    const mois = (f.date || "").slice(0, "AAAA-MM".length);
    const ht = htCompte(f);
    if (!mois || !ht) continue;
    const bc = f.bon_commande_id ? bons.find((b) => b.id === f.bon_commande_id) : null;
    const tech = bc && bc.technicien ? equipes.find((t) => t.id === bc.technicien || technicienLabel(t) === bc.technicien) : null;
    const label = tech ? technicienLabel(tech) : NON_ATTRIBUE;
    moisVus.add(mois);
    const ligne = (parBinome[label] ??= {});
    ligne[mois] = (ligne[mois] ?? ZERO).plus(ht);
  }
  const binomes = Object.keys(parBinome).sort((a, b) => (a === NON_ATTRIBUE ? 1 : b === NON_ATTRIBUE ? -1 : a.localeCompare(b)));
  return { mois: [...moisVus].sort(), binomes, parBinome };
}

/** Le total d'une équipe sur les mois affichés. */
export function totalEquipe(t: TableauEquipes, binome: string): Montant {
  return somme(t.mois.map((m) => t.parBinome[binome]?.[m] ?? ZERO));
}
