import type { CartePlanning, Equipe, SousTraitant, TachePlanning } from "./cartes";
import { dureeDesCases } from "./grille";
import { memeMetier, tachesAcreer } from "./metiers";
import { colonnesDuCreneau, creneauDeclare, creneauDeLaTache, creneauModifiable, DUREE_DEFAUT_H, DUREE_MAX_H, DUREE_MIN_H, HEURE_DEFAUT, type Creneau } from "./taches";

/**
 * Les gestes du planning, calculés sans base : chacun rend un PLAN — ce qu'il
 * faut écrire sur le bon (le rendez-vous, que l'écran historique lit encore)
 * et sur ses tâches (les journées réelles) — ou lève un refus rédigé.
 *
 * Port de `poserAuPlanning`, `unscheduleBC`, `shiftBCUnJourPlusTot`,
 * `updateBC*`, `confirmerAjoutDateSuppl`, `removeDateSupplementaire` (app.js
 * l. 10141-10550) et de la matérialisation de `appliquerWorkflow`
 * (html-adapter.ts). Écarts assumés : D-PLN-02 (la tâche naît à la
 * planification), D-PLN-08 (déplacer une carte déplace sa journée).
 */

/** Un refus métier : `code` P0001 pour que `messageErreur` le montre tel quel. */
export class RefusPlanning extends Error {
  readonly code = "P0001";
  constructor(message: string) {
    super(message);
    this.name = "RefusPlanning";
  }
}

export const MSG_INTERVENTION_FAITE = "Cette intervention a été validée par le technicien, elle ne peut plus être modifiée depuis le planning.";
export const MSG_DATE_EN_DOUBLE = "Cette date est déjà planifiée pour ce bon de commande.";
export const MSG_JOURNEE_POINTEE = "Journée conservée : le terrain y a déjà pointé son travail. Passez par le circuit de validation pour la défaire.";

export type AffectationChoisie = { type: "equipe"; equipe: Equipe | null } | { type: "sous_traitant"; sousTraitant: SousTraitant | null };

/** Les colonnes du rendez-vous sur le bon. `schedule_par_metier` est réécrit en entier (jsonb). */
export interface ColonnesRdvBon {
  date_planifiee?: string | null;
  date_planifiee_fin?: string | null;
  heure_planifiee?: string | null;
  duree_heures?: number | null;
  heure_dernier_jour?: string | null;
  duree_dernier_jour?: number | null;
  technicien?: string | null;
  schedule_par_metier?: Record<string, unknown>;
}

export interface ChampsTache {
  date_tache?: string | null;
  technicien_id?: string | null;
  sous_traitant_id?: string | null;
  heure_debut?: string | null;
  heure_fin?: string | null;
}

export interface NouvelleTache extends ChampsTache {
  bon_commande_id: string;
  libelle: string;
  metier: string | null;
  date_tache: string | null;
}

export type OperationTache = { type: "creer"; tache: NouvelleTache } | { type: "maj"; id: string; champs: ChampsTache } | { type: "supprimer"; id: string };

export interface Plan {
  bon: ColonnesRdvBon | null;
  taches: OperationTache[];
}

/** Les champs du rendez-vous, sous les noms de l'écran historique (clés de `schedule_par_metier`). */
interface ChampsRdv {
  datePlanifiee?: string | null;
  datePlanifieeFin?: string | null;
  heurePlanifiee?: string | null;
  dureeHeures?: number | null;
  heureDernierJour?: string | null;
  dureeDernierJour?: number | null;
  technicien?: string | null;
  sousTraitant?: string | null;
}

const COLONNE_DE: Record<Exclude<keyof ChampsRdv, "sousTraitant">, keyof ColonnesRdvBon> = {
  datePlanifiee: "date_planifiee",
  datePlanifieeFin: "date_planifiee_fin",
  heurePlanifiee: "heure_planifiee",
  dureeHeures: "duree_heures",
  heureDernierJour: "heure_dernier_jour",
  dureeDernierJour: "duree_dernier_jour",
  technicien: "technicien",
};

/**
 * `setSchedField` : sur les colonnes du bon pour une carte mono-métier, dans
 * le réglage du métier sinon — les autres clés du jsonb sont conservées, un
 * écran qui ne les connaît pas ne doit pas les effacer. Le sous-traitant d'un
 * bon mono-métier n'a pas de colonne : il ne vit que sur les tâches.
 */
export function rdvAEcrire(carte: Pick<CartePlanning, "metierKey" | "bon">, champs: ChampsRdv): ColonnesRdvBon | null {
  if (!carte.metierKey) {
    const sortie: ColonnesRdvBon = {};
    for (const [cle, valeur] of Object.entries(champs) as [keyof ChampsRdv, ChampsRdv[keyof ChampsRdv]][]) {
      if (cle === "sousTraitant") continue;
      Object.assign(sortie, { [COLONNE_DE[cle]]: valeur ?? null });
    }
    return Object.keys(sortie).length ? sortie : null;
  }
  const brut = carte.bon.schedule_par_metier;
  const existant = brut && typeof brut === "object" && !Array.isArray(brut) ? (brut as Record<string, unknown>) : {};
  const avant = existant[carte.metierKey];
  const reglage = avant && typeof avant === "object" && !Array.isArray(avant) ? (avant as Record<string, unknown>) : {};
  return { schedule_par_metier: { ...existant, [carte.metierKey]: { ...reglage, ...champs } } };
}

function libelleTache(carte: CartePlanning, metier: string | null): string {
  const base = carte.bon.numero_bc || carte.bon.client_nom || "Intervention";
  return metier ? `${base} — ${metier}` : base;
}

function champsAffectation(a: AffectationChoisie | null, carte: CartePlanning): ChampsTache {
  if (!a) return { technicien_id: carte.equipeId, sous_traitant_id: carte.sousTraitantId };
  return a.type === "equipe" ? { technicien_id: a.equipe?.id ?? null } : { sous_traitant_id: a.sousTraitant?.id ?? null };
}

function rdvAffectation(a: AffectationChoisie | null, carte: CartePlanning): ChampsRdv {
  if (!a) return {};
  if (a.type === "equipe") return { technicien: a.equipe?.nom ?? null };
  // Le nom dans le réglage du métier : c'est là que l'écran historique le relit.
  return carte.metierKey ? { sousTraitant: a.sousTraitant?.nom ?? null } : {};
}

const duMetier = (taches: readonly TachePlanning[], metier: string | null) => taches.filter((t) => memeMetier(t.metier, metier));

/** Une journée pointée, commentée, dessinée, en attente de pièce ou portant un travail supplémentaire : un constat, pas un plan. */
export function journeeConstatee(t: TachePlanning, avecTravaux: ReadonlySet<string>): boolean {
  return !creneauModifiable(t.statut) || !!t.commentaire || !!t.croquis || !!t.piece_a_commander || avecTravaux.has(t.id);
}

/**
 * Poser une carte au planning, ou la déplacer (PLN-04). L'équipe (ou le
 * sous-traitant) rejoint la tâche ici : sans elle, `est_de_l_equipe()` refuse
 * le terrain et seul le conducteur peut clore.
 */
export function planPoser(carte: CartePlanning, date: string, heure: string, affectation: AffectationChoisie | null): Plan {
  if (!date) throw new RefusPlanning("Choisissez une date.");
  const ancienne = carte.rdv.datePlanifiee;
  // Une carte faite ne se DÉPLACE pas ; sans date, la poser n'est pas la déplacer (PLN-33).
  if (ancienne && carte.faite) throw new RefusPlanning(MSG_INTERVENTION_FAITE);
  const duree = carte.rdv.dureeHeures || DUREE_DEFAUT_H;
  const creneau = creneauDeclare(heure || HEURE_DEFAUT, duree);
  const bon = rdvAEcrire(carte, {
    datePlanifiee: date,
    datePlanifieeFin: date,
    heurePlanifiee: heure || HEURE_DEFAUT,
    dureeHeures: duree,
    ...rdvAffectation(affectation, carte),
  });

  const affecte = champsAffectation(affectation, carte);
  const plage = creneau ? colonnesDuCreneau(creneau) : {};
  const taches: OperationTache[] = [];
  const prises = new Set<string>();
  for (const metier of carte.metiersDeLaCarte) {
    const siennes = duMetier(carte.taches, metier).filter((t) => !prises.has(t.id));
    const cible =
      siennes.find((t) => t.date_tache === date) ??
      (ancienne && ancienne !== date ? siennes.find((t) => t.date_tache === ancienne && creneauModifiable(t.statut)) : undefined) ??
      // Une tâche dé-datée (« pièce reçue ») attend ce rendez-vous : c'est elle qui le prend, pas une jumelle.
      siennes.find((t) => !t.date_tache);
    if (cible) {
      prises.add(cible.id);
      const champs: ChampsTache = { ...affecte };
      if (cible.date_tache !== date) champs.date_tache = date;
      if (creneauModifiable(cible.statut)) Object.assign(champs, plage);
      taches.push({ type: "maj", id: cible.id, champs });
      continue;
    }
    taches.push({
      type: "creer",
      tache: { bon_commande_id: carte.bcId, libelle: libelleTache(carte, metier), metier, date_tache: date, technicien_id: carte.equipeId, sous_traitant_id: carte.sousTraitantId, ...affecte, ...plage },
    });
  }
  return { bon, taches };
}

/** La question à poser avant de déplanifier une carte qui a d'autres journées. */
export function questionDeplanifier(carte: CartePlanning): string | null {
  const n = carte.suppl.length;
  return n ? `Ce bon de commande a aussi ${n} autre(s) date(s) planifiée(s). Les retirer du planning va aussi supprimer ces dates-là. Continuer ?` : null;
}

/**
 * Déplanifier (PLN-05, PLN-50) : refusé si l'intervention est faite ou si une
 * autre journée porte déjà un constat. La journée d'origine perd sa date mais
 * garde ses constats — elle attend son prochain rendez-vous.
 */
export function planDeplanifier(carte: CartePlanning, avecTravaux: ReadonlySet<string>): Plan {
  if (carte.faite) throw new RefusPlanning(MSG_INTERVENTION_FAITE);
  const origine = carte.rdv.datePlanifiee;
  const autres = carte.taches.filter((t) => t.date_tache && t.date_tache !== origine && carte.suppl.some((d) => d.date === t.date_tache));
  const pointees = [...new Set(autres.filter((t) => journeeConstatee(t, avecTravaux)).map((t) => t.date_tache))];
  if (pointees.length) throw new RefusPlanning(`${pointees.length} journée(s) ont déjà été pointées par le terrain : le bon reste planifié.`);
  const taches: OperationTache[] = autres.map((t) => ({ type: "supprimer", id: t.id }));
  for (const t of carte.taches) {
    if (origine && t.date_tache === origine && creneauModifiable(t.statut)) taches.push({ type: "maj", id: t.id, champs: { date_tache: null } });
  }
  return { bon: rdvAEcrire(carte, { datePlanifiee: null, datePlanifieeFin: null }), taches };
}

/** « ← » : défait d'abord l'étirement, puis déplanifie — avec les mêmes contrôles (PLN-50). */
export function planAvancer(carte: CartePlanning, avecTravaux: ReadonlySet<string>): Plan {
  const { datePlanifiee: debut, datePlanifieeFin: fin } = carte.rdv;
  if (!debut) throw new RefusPlanning("Cette carte n'est pas planifiée.");
  if (fin && fin !== debut) return { bon: rdvAEcrire(carte, { datePlanifieeFin: debut, dureeDernierJour: null, heureDernierJour: null }), taches: [] };
  return planDeplanifier(carte, avecTravaux);
}

function majCreneauDesJournees(taches: readonly TachePlanning[], date: string | null, creneau: Creneau | null): OperationTache[] {
  if (!date || !creneau) return [];
  const plage = colonnesDuCreneau(creneau);
  return taches
    .filter((t) => t.date_tache === date && creneauModifiable(t.statut))
    .filter((t) => {
      const actuel = creneauDeLaTache(t);
      return !actuel || actuel.heure !== creneau.heure || actuel.duree !== creneau.duree;
    })
    .map((t) => ({ type: "maj", id: t.id, champs: plage }));
}

export function bornerDuree(duree: number): number {
  return Math.min(DUREE_MAX_H, Math.max(DUREE_MIN_H, Math.trunc(duree) || DUREE_MIN_H));
}

/** Régler l'heure ou la durée du rendez-vous (1 à 8 h) ; la journée d'origine suit si elle n'est pas pointée (PLN-32). */
export function planCreneau(carte: CartePlanning, reglage: { heure?: string; duree?: number }): Plan {
  const heure = reglage.heure ?? carte.rdv.heurePlanifiee ?? HEURE_DEFAUT;
  const duree = reglage.duree !== undefined ? bornerDuree(reglage.duree) : carte.rdv.dureeHeures || DUREE_DEFAUT_H;
  const champs: ChampsRdv = {};
  if (reglage.heure !== undefined) champs.heurePlanifiee = heure;
  if (reglage.duree !== undefined) champs.dureeHeures = duree;
  return { bon: rdvAEcrire(carte, champs), taches: majCreneauDesJournees(carte.taches, carte.rdv.datePlanifiee, creneauDeclare(heure, duree)) };
}

/** Étirer jusqu'à une date : jamais avant le début. */
export function planDateFin(carte: CartePlanning, fin: string): Plan {
  const debut = carte.rdv.datePlanifiee;
  if (!debut) throw new RefusPlanning("Cette carte n'est pas planifiée.");
  return { bon: rdvAEcrire(carte, { datePlanifieeFin: fin && fin >= debut ? fin : debut }), taches: [] };
}

export function planDernierJour(carte: CartePlanning, reglage: { heure?: string; duree?: number }): Plan {
  const champs: ChampsRdv = {};
  if (reglage.heure !== undefined) champs.heureDernierJour = reglage.heure;
  if (reglage.duree !== undefined) champs.dureeDernierJour = bornerDuree(reglage.duree);
  return { bon: rdvAEcrire(carte, champs), taches: [] };
}

/** Changer l'équipe ou le sous-traitant : sur le bon ET sur toutes les tâches de la carte. */
export function planAffectation(carte: CartePlanning, affectation: AffectationChoisie): Plan {
  if (carte.faite) throw new RefusPlanning(MSG_INTERVENTION_FAITE);
  const champs = champsAffectation(affectation, carte);
  const taches: OperationTache[] = carte.taches
    .filter((t) => (affectation.type === "equipe" ? t.technicien_id !== champs.technicien_id : t.sous_traitant_id !== champs.sous_traitant_id))
    .map((t) => ({ type: "maj", id: t.id, champs }));
  return { bon: rdvAEcrire(carte, rdvAffectation(affectation, carte)), taches };
}

/** Une journée de plus (PLN-06) : refus du doublon et de la date d'origine ; une tâche par métier de la carte. */
export function planAjouterDate(carte: CartePlanning, date: string, heure: string, duree: number): Plan {
  if (!date) throw new RefusPlanning("Choisissez une date.");
  if (!carte.rdv.datePlanifiee) throw new RefusPlanning("Posez d'abord cette carte au planning.");
  if (date === carte.rdv.datePlanifiee || carte.suppl.some((d) => d.date === date)) throw new RefusPlanning(MSG_DATE_EN_DOUBLE);
  const creneau = creneauDeclare(heure || HEURE_DEFAUT, bornerDuree(duree));
  const plage = creneau ? colonnesDuCreneau(creneau) : {};
  const taches: OperationTache[] = tachesAcreer(carte.taches, [date], carte.metiersDeLaCarte).map(({ metier }) => ({
    type: "creer",
    tache: { bon_commande_id: carte.bcId, libelle: libelleTache(carte, metier), metier, date_tache: date, technicien_id: carte.equipeId, sous_traitant_id: carte.sousTraitantId, ...plage },
  }));
  return { bon: null, taches };
}

/** Retirer une journée, c'est supprimer ses tâches — refusé dès que le terrain y a pointé (PLN-06). */
export function planRetirerDate(carte: CartePlanning, date: string, avecTravaux: ReadonlySet<string>): Plan {
  const duJour = carte.taches.filter((t) => t.date_tache === date && date !== carte.rdv.datePlanifiee);
  if (duJour.some((t) => journeeConstatee(t, avecTravaux))) throw new RefusPlanning(MSG_JOURNEE_POINTEE);
  return { bon: null, taches: duJour.map((t) => ({ type: "supprimer", id: t.id })) };
}

/** Le créneau d'une journée supplémentaire : sur ses tâches, tant qu'elles ne sont pas pointées. */
export function planCreneauJournee(carte: CartePlanning, date: string, reglage: { heure?: string; duree?: number }): Plan {
  const actuel = carte.suppl.find((d) => d.date === date)?.creneau;
  const heure = reglage.heure ?? actuel?.heure ?? HEURE_DEFAUT;
  const duree = reglage.duree !== undefined ? bornerDuree(reglage.duree) : (actuel?.duree ?? DUREE_DEFAUT_H);
  return { bon: null, taches: majCreneauDesJournees(carte.taches, date, creneauDeclare(heure, duree)) };
}

/**
 * La poignée (PLN-05) : les cases visées deviennent une durée — la case de
 * midi comptée une seule fois, puisque la grille l'ajoute d'elle-même —, et la
 * colonne visée devient la date de fin. Un seul plan, pour que le réglage du
 * métier ne soit pas réécrit deux fois depuis la même lecture.
 */
export function planEtirer(carte: CartePlanning, geste: { cases: number; indiceDebut: number; fin: string | null; dernierJour: boolean }): Plan {
  const debut = carte.rdv.datePlanifiee;
  if (!debut) throw new RefusPlanning("Cette carte n'est pas planifiée.");
  const duree = bornerDuree(dureeDesCases(geste.indiceDebut, geste.cases));
  const fin = geste.fin && geste.fin >= debut ? geste.fin : (carte.rdv.datePlanifieeFin ?? debut);
  const champs: ChampsRdv = geste.dernierJour ? { dureeDernierJour: duree } : { dureeHeures: duree };
  if (!geste.dernierJour) champs.datePlanifieeFin = fin;
  const heure = carte.rdv.heurePlanifiee ?? HEURE_DEFAUT;
  const taches = geste.dernierJour ? [] : majCreneauDesJournees(carte.taches, debut, creneauDeclare(heure, duree));
  return { bon: rdvAEcrire(carte, champs), taches };
}

/**
 * Une carte posée par l'écran historique n'a pas toujours sa tâche : il la
 * créait à l'ouverture de la fiche. On la crée ici, à la demande, avec
 * l'équipe de la carte — sans elle le terrain se verrait refuser sa propre tâche.
 */
export function planMaterialiser(carte: CartePlanning, metier: string | null, jour: string): Plan {
  if (carte.taches.some((t) => memeMetier(t.metier, metier) && t.date_tache === jour)) return { bon: null, taches: [] };
  const creneau = jour === carte.rdv.datePlanifiee ? creneauDeclare(carte.rdv.heurePlanifiee, carte.rdv.dureeHeures) : null;
  return {
    bon: null,
    taches: [
      {
        type: "creer",
        tache: { bon_commande_id: carte.bcId, libelle: libelleTache(carte, metier), metier, date_tache: jour, technicien_id: carte.equipeId, sous_traitant_id: carte.sousTraitantId, ...(creneau ? colonnesDuCreneau(creneau) : {}) },
      },
    ],
  };
}

/** L'affectation déjà connue de la carte, pour ne pas redemander l'équipe à chaque déplacement. */
export function affectationConnue(carte: CartePlanning, type: "equipe" | "sous_traitant", annuaires: { equipes: readonly Equipe[]; sousTraitants: readonly SousTraitant[] }): AffectationChoisie | null {
  if (type === "equipe") {
    const equipe = annuaires.equipes.find((e) => e.id === carte.equipeId);
    return equipe ? { type, equipe } : null;
  }
  const sousTraitant = annuaires.sousTraitants.find((s) => s.id === carte.sousTraitantId);
  return sousTraitant ? { type, sousTraitant } : null;
}
