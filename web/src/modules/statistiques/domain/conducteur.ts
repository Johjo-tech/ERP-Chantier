import { ajouterJours } from "@/modules/planning/domain/calendrier";
import { interventionFaite } from "@/modules/planning/domain/cartes";
import { CIRCUIT_CLOS } from "@/modules/planning/domain/filtres";

/**
 * Le tableau de bord du conducteur de travaux (`renderDashboardConducteur`,
 * `statsConducteur`, app.js l. 1786-1968).
 *
 * AUCUN MONTANT, délibérément : chiffre d'affaires, impayés et montant à
 * facturer sont le métier de l'administration. Ce qui se joue chez lui, ce
 * sont des délais tenus, des réclamations, et des affaires qui attendent.
 */

/**
 * `periodeJours` : fenêtre glissante de ses chiffres — plus court, un seul SAV
 * fait bondir le taux ; plus long, un progrès met un trimestre à se voir.
 * `tentativesInjoignable` : au-delà, ce n'est plus un rappel à faire mais un
 * locataire qu'on n'arrive pas à joindre.
 */
export const CONDUCTEUR = { periodeJours: 90, tentativesInjoignable: 3 } as const;

/** Les repères des jauges : sous 10 % de SAV, au-dessus de 80 % de délais tenus, c'est bon. */
export const REPERES = { tauxSavBon: 10, delaiTenuBon: 80 } as const;

/** La tâche d'un bon, réduite à ce que le tableau de bord lit. */
export interface TacheDuBon {
  bon_commande_id: string | null;
  metier: string | null;
  statut: string;
  date_tache: string | null;
  piece_a_commander: boolean | null;
  piece_date_commande: string | null;
}

/** Le bon, tel que l'API le lit (sans montant). */
export interface BonLu {
  id: string;
  conducteur_id: string | null;
  bon_commande_parent_id: string | null;
  statut_workflow: string | null;
  client_nom: string;
  date: string | null;
  date_reception: string | null;
  date_planifiee: string | null;
  date_fin_travaux: string | null;
  date_intervention_terminee: string | null;
  rappel_date: string | null;
  tentatives_contact: unknown;
  probleme_description: string | null;
  metier: string | null;
  metiers: unknown;
}

/** Le bon, avec ce que ses tâches disent de lui. */
export interface BonConducteur extends BonLu {
  factureLiee: boolean;
  valideConducteur: boolean;
  valideDirecteur: boolean;
  pieceEnAttente: boolean;
  interventionFaite: boolean;
  /** Les journées déclarées faites, dans l'ordre. */
  journeesFaites: string[];
  nbTentatives: number;
}

const faite = (t: Pick<TacheDuBon, "statut">) => t.statut === "realisee" || t.statut === "validee";

function metiersDuBon(b: Pick<BonLu, "metiers" | "metier">): string[] {
  const liste = Array.isArray(b.metiers) ? b.metiers.filter((m): m is string => typeof m === "string" && m.trim() !== "") : [];
  return liste.length ? liste : b.metier ? [b.metier] : [];
}

/**
 * Les journées du bon (`bcToutesDatesDuBC`) : celle du rendez-vous, faite quand
 * toutes les tâches le sont, puis celles que portent les tâches à d'autres
 * dates, faites quand toutes les tâches de ce jour le sont.
 */
function journeesDuBon(b: Pick<BonLu, "date_planifiee">, taches: readonly TacheDuBon[]): { date: string; fait: boolean }[] {
  if (!b.date_planifiee) return [];
  const origine = { date: b.date_planifiee, fait: taches.length > 0 && taches.every(faite) };
  const autres = [...new Set(taches.map((t) => t.date_tache).filter((d): d is string => !!d && d !== b.date_planifiee))].sort();
  return [origine, ...autres.map((date) => ({ date, fait: taches.filter((t) => t.date_tache === date).every(faite) }))];
}

const DECIMAL = 10;

/**
 * Le nombre de tentatives TEL QUE L'ANCIEN LE LISAIT : `parseInt` du champ.
 * Les tentatives sont un TABLEAU jsonb d'objets, que `parseInt` lit comme
 * « [object Object] » : NaN, donc 0 — un locataire n'est jamais « injoignable ».
 * Défaut conservé sur décision du client (D-STA-A-01, DEF-STA-12) ; la
 * correction (compter le tableau) est dans l'historique de ce fichier.
 */
export function nombreDeTentatives(brut: unknown): number {
  return parseInt(String(brut), DECIMAL) || 0;
}

export function avancementDuBon(b: BonLu, taches: readonly TacheDuBon[], factureLiee: boolean): BonConducteur {
  const metiers = metiersDuBon(b);
  const metiersFait: Record<string, boolean> = {};
  for (const t of taches) if (t.metier) metiersFait[t.metier] = faite(t);
  const journees = journeesDuBon(b, taches);
  const enAttente = taches.find((t) => t.piece_a_commander);
  return {
    ...b,
    factureLiee,
    valideConducteur: taches.length > 0 && taches.every((t) => t.statut === "validee"),
    valideDirecteur: b.statut_workflow === "chiffre" || b.statut_workflow === "facture",
    pieceEnAttente: !!enAttente && !enAttente.piece_date_commande,
    interventionFaite: interventionFaite(metiers, metiersFait, journees),
    journeesFaites: journees.filter((j) => j.fait).map((j) => j.date),
    nbTentatives: nombreDeTentatives(b.tentatives_contact),
  };
}

export const estSav = (b: Pick<BonLu, "bon_commande_parent_id">) => !!b.bon_commande_parent_id;

/** Un bon chiffré, facturé ou clos n'attend plus personne, quoi que disent ses tâches (`circuitTermine`). */
export const circuitTermine = (b: Pick<BonConducteur, "statut_workflow" | "factureLiee">) => CIRCUIT_CLOS.includes(b.statut_workflow ?? "") || b.factureLiee;

/**
 * La date à laquelle les travaux ont RÉELLEMENT fini : la dernière journée
 * faite, lue sur les tâches ; `date_intervention_terminee` (saisie à la main)
 * ne sert que de repli.
 */
export function dateFinReelle(b: Pick<BonConducteur, "interventionFaite" | "journeesFaites" | "date_intervention_terminee">): string | null {
  if (!b.interventionFaite) return null;
  const faites = [...b.journeesFaites].sort();
  return faites[faites.length - 1] ?? b.date_intervention_terminee ?? null;
}

export function horsDelai(b: Pick<BonConducteur, "date_fin_travaux" | "interventionFaite">, jour: string): boolean {
  return !!b.date_fin_travaux && b.date_fin_travaux < jour && !b.interventionFaite;
}

const JOUR_MS = 86_400_000;
const joursEntre = (debut: string, fin: string) => (Date.parse(`${fin}T00:00:00Z`) - Date.parse(`${debut}T00:00:00Z`)) / JOUR_MS;

/** Écart moyen en jours entre deux dates d'un même bon, sur les bons dont la fin tombe dans la période. */
export function moyenneJours(bons: readonly BonConducteur[], debut: (b: BonConducteur) => string | null, fin: (b: BonConducteur) => string | null, depuis: string): number | null {
  const ecarts: number[] = [];
  for (const b of bons) {
    const d = debut(b);
    const f = fin(b);
    if (!d || !f || f < depuis) continue;
    const n = joursEntre(d, f);
    if (Number.isFinite(n) && n >= 0) ecarts.push(n);
  }
  return ecarts.length ? ecarts.reduce((s, n) => s + n, 0) / ecarts.length : null;
}

export interface StatsConducteur {
  sav: BonConducteur[];
  horsDelai: BonConducteur[];
  aValider: BonConducteur[];
  chezDirecteur: BonConducteur[];
  sansRdv: BonConducteur[];
  aRappeler: BonConducteur[];
  injoignables: BonConducteur[];
  aContacter: BonConducteur[];
  pieces: BonConducteur[];
  seuilRdv: number;
  terminees: number;
  tauxSAV: number | null;
  delaiTenu: number | null;
  priseEnCharge: number | null;
  execution: number | null;
}

/** `statsConducteur`, sur les affaires du conducteur. */
export function statsConducteur(bons: readonly BonConducteur[], jour: string, seuilRdv: number): StatsConducteur {
  const depuis = ajouterJours(jour, -CONDUCTEUR.periodeJours);
  const limiteRdv = ajouterJours(jour, -seuilRdv);
  const ouverts = bons.filter((b) => !circuitTermine(b));
  const aRappeler = ouverts.filter((b) => !!b.rappel_date && b.rappel_date <= jour);
  // Comme l'ancien (DEF-STA-12) : `nbTentatives` vaut 0 pour tout tableau, la liste reste vide.
  const injoignables = ouverts.filter((b) => !b.date_planifiee && b.nbTentatives >= CONDUCTEUR.tentativesInjoignable);

  // Les chiffres de la période ne portent que sur ce qui s'est TERMINÉ : une
  // affaire en cours n'a ni délai tenu ni durée d'exécution.
  const terminees = bons.filter((b) => {
    const f = dateFinReelle(b);
    return !!f && f >= depuis;
  });
  const savNes = bons.filter((b) => estSav(b) && (b.date_reception || b.date || "") >= depuis);
  const dansLeDelai = terminees.filter((b) => !b.date_fin_travaux || (dateFinReelle(b) ?? "") <= b.date_fin_travaux);
  const n = terminees.length;
  return {
    sav: ouverts.filter(estSav),
    horsDelai: ouverts.filter((b) => horsDelai(b, jour)),
    // Un SAV ne passe pas par le chiffrage : le compter ferait attendre une validation jamais demandée.
    aValider: ouverts.filter((b) => !b.valideConducteur && !estSav(b)),
    chezDirecteur: ouverts.filter((b) => b.valideConducteur && !b.valideDirecteur),
    sansRdv: ouverts.filter((b) => !b.date_planifiee && !!b.date_reception && b.date_reception <= limiteRdv),
    aRappeler,
    injoignables,
    // Un bon, pas un motif : un locataire injoignable porte souvent un rappel.
    aContacter: ouverts.filter((b) => aRappeler.includes(b) || injoignables.includes(b)),
    pieces: ouverts.filter((b) => b.pieceEnAttente),
    seuilRdv,
    terminees: n,
    tauxSAV: n ? (savNes.length / n) * 100 : null,
    delaiTenu: n ? (dansLeDelai.length / n) * 100 : null,
    priseEnCharge: moyenneJours(bons, (b) => b.date_reception, (b) => b.date_planifiee, depuis),
    execution: moyenneJours(bons, (b) => b.date_planifiee, (b) => dateFinReelle(b), depuis),
  };
}

/** Le total « À traiter » : chaque liste une fois, « chez le directeur » à part (la balle n'est plus chez lui). */
export function totalATraiter(s: StatsConducteur): number {
  return s.sav.length + s.horsDelai.length + s.aValider.length + s.sansRdv.length + s.aContacter.length + s.pieces.length;
}
