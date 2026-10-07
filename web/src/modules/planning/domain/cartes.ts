import { z } from "zod";
import { creneauDeLaTache, type Creneau } from "./taches";
import { memeMetier } from "./metiers";

/**
 * Le planning lu depuis la base : les cartes à poser sur la grille.
 *
 * Port de `planningItems`, `schedField`, `bcInterventionFaite` (app.js
 * l. 8718-8790, 7060) et de `datesSupplementairesDuBon` (html-adapter.ts).
 * Une carte vaut un bon × un métier quand le bon porte plusieurs métiers (son
 * identifiant est alors `bcId::METIER`, PLN-03), le bon entier sinon.
 *
 * Deux sources, comme dans l'ancien écran que la base partage encore :
 *  - le RENDEZ-VOUS (date, heure, durée, équipe) vit sur le bon — colonnes
 *    pour un bon mono-métier, `schedule_par_metier[métier]` sinon ;
 *  - les JOURNÉES réelles et leur circuit vivent dans `planning_taches`
 *    (une tâche par bon × métier × jour).
 */

const nombre = z
  .union([z.number(), z.string()])
  .nullable()
  .transform((v) => (v === null || v === "" ? null : Number(v)))
  .transform((v) => (v === null || Number.isNaN(v) ? null : v));

export const schemaBonPlanning = z.object({
  id: z.string(),
  societe_id: z.string(),
  numero_interne: z.string().nullable(),
  numero_bc: z.string().nullable(),
  client_id: z.string().nullable(),
  client_nom: z.string(),
  interlocuteur: z.string().nullable(),
  bon_commande_parent_id: z.string().nullable(),
  devis_id: z.string().nullable(),
  probleme_description: z.string().nullable(),
  adresse: z.string().nullable(),
  adresse_locataire: z.string().nullable(),
  code_postal: z.string().nullable(),
  ville: z.string().nullable(),
  logement_statut: z.string().nullable(),
  occupant: z.string().nullable(),
  etage: z.string().nullable(),
  numero_logement: z.string().nullable(),
  date_planifiee: z.string().nullable(),
  date_planifiee_fin: z.string().nullable(),
  heure_planifiee: z.string().nullable(),
  duree_heures: nombre,
  heure_dernier_jour: z.string().nullable(),
  duree_dernier_jour: nombre,
  metier: z.string().nullable(),
  metiers: z.unknown(),
  technicien: z.string().nullable(),
  schedule_par_metier: z.unknown(),
  montant: z.union([z.number(), z.string()]).nullable(),
  montant_par_metier: z.unknown(),
  montant_sous_traitant: z.union([z.number(), z.string()]).nullable(),
  conducteur: z.string().nullable(),
  conducteur_id: z.string().nullable(),
  statut_workflow: z.string().nullable(),
  date_planification_initiale: z.string().nullable(),
  tentatives_contact: z.unknown(),
  rappel_date: z.string().nullable(),
  piece_jointe_nom: z.string().nullable(),
  piece_jointe_chemin: z.string().nullable(),
  // Pour la carte « En attente », qui reprend celle de la liste des bons (statut, attente du BC).
  statut: z.string().nullable().default(null),
  en_attente_bc: z.boolean().nullable().default(null),
  // L'ordre de l'ancien écran (`trierParDate`) : réception, rendez-vous, date, puis création.
  date_reception: z.string().nullable().default(null),
  date: z.string().nullable().default(null),
  cree_le: z.string().nullable().default(null),
});
export type BonPlanning = z.infer<typeof schemaBonPlanning>;

export const schemaTachePlanning = z.object({
  id: z.string(),
  bon_commande_id: z.string().nullable(),
  libelle: z.string(),
  metier: z.string().nullable(),
  statut: z.string(),
  date_tache: z.string().nullable(),
  heure_debut: z.string().nullable(),
  heure_fin: z.string().nullable(),
  technicien_id: z.string().nullable(),
  sous_traitant_id: z.string().nullable(),
  commentaire: z.string().nullable(),
  croquis: z.string().nullable(),
  piece_a_commander: z.boolean().nullable(),
  piece_description: z.string().nullable(),
  piece_fournisseur: z.string().nullable(),
  piece_date_commande: z.string().nullable(),
  piece_recue_le: z.string().nullable(),
  realisee_le: z.string().nullable(),
  realisee_par: z.string().nullable(),
  validee_le: z.string().nullable(),
  validee_par: z.string().nullable(),
  refus_motif: z.string().nullable(),
  cree_le: z.string(),
});
export type TachePlanning = z.infer<typeof schemaTachePlanning>;

export interface Equipe {
  id: string;
  nom: string;
  couleur: string | null;
  metiers: string[];
}

export interface SousTraitant {
  id: string;
  nom: string;
  metiers: string[];
}

/** Le réglage d'un métier, tel que l'écran historique l'écrit (clés camelCase). */
export interface ReglageMetier {
  datePlanifiee?: string | null;
  datePlanifieeFin?: string | null;
  heurePlanifiee?: string | null;
  dureeHeures?: number | null;
  heureDernierJour?: string | null;
  dureeDernierJour?: number | null;
  technicien?: string | null;
  sousTraitant?: string | null;
}

export type Tentative = { id: string; type: "appel" | "sms"; date: string; heure: string };

const schemaTentative = z.object({ id: z.coerce.string(), type: z.enum(["appel", "sms"]), date: z.string(), heure: z.string().default("") });
const schemaReglage = z
  .object({
    datePlanifiee: z.string().nullish(),
    datePlanifieeFin: z.string().nullish(),
    heurePlanifiee: z.string().nullish(),
    dureeHeures: z.coerce.number().nullish(),
    heureDernierJour: z.string().nullish(),
    dureeDernierJour: z.coerce.number().nullish(),
    technicien: z.string().nullish(),
    sousTraitant: z.string().nullish(),
  })
  .partial();

/** Les métiers déclarés d'un bon (`bcMetiersDuBC`) : la liste, sinon le métier seul. */
export function metiersDuBon(b: Pick<BonPlanning, "metiers" | "metier">): string[] {
  const liste = Array.isArray(b.metiers) ? b.metiers.filter((m): m is string => typeof m === "string" && m.trim() !== "") : [];
  if (liste.length) return liste;
  return b.metier ? [b.metier] : [];
}

/** `schedule_par_metier` lu prudemment : une entrée illisible est ignorée plutôt que de faire tomber l'écran. */
export function reglagesParMetier(b: Pick<BonPlanning, "schedule_par_metier">): Record<string, ReglageMetier> {
  const brut = b.schedule_par_metier;
  if (!brut || typeof brut !== "object" || Array.isArray(brut)) return {};
  const sortie: Record<string, ReglageMetier> = {};
  for (const [cle, valeur] of Object.entries(brut as Record<string, unknown>)) {
    const r = schemaReglage.safeParse(valeur ?? {});
    if (r.success) sortie[cle] = r.data;
  }
  return sortie;
}

export function tentativesDuBon(b: Pick<BonPlanning, "tentatives_contact">): Tentative[] {
  const brut = Array.isArray(b.tentatives_contact) ? b.tentatives_contact : [];
  return brut.flatMap((t) => {
    const r = schemaTentative.safeParse(t);
    return r.success ? [r.data] : [];
  });
}

function montantParMetier(b: Pick<BonPlanning, "montant_par_metier">, metier: string): string | number | null {
  const brut = b.montant_par_metier;
  if (!brut || typeof brut !== "object" || Array.isArray(brut)) return null;
  const v = (brut as Record<string, unknown>)[metier];
  return typeof v === "number" || typeof v === "string" ? v : null;
}

/** Le rendez-vous d'une carte (`schedField`) : colonnes du bon, ou réglage du métier. */
export interface RendezVous {
  datePlanifiee: string | null;
  datePlanifieeFin: string | null;
  heurePlanifiee: string | null;
  dureeHeures: number | null;
  heureDernierJour: string | null;
  dureeDernierJour: number | null;
  technicien: string | null;
  sousTraitantNom: string | null;
}

export function rendezVousDe(b: BonPlanning, metierKey: string | null): RendezVous {
  if (!metierKey) {
    return {
      datePlanifiee: b.date_planifiee || null,
      datePlanifieeFin: b.date_planifiee_fin || null,
      heurePlanifiee: b.heure_planifiee || null,
      dureeHeures: b.duree_heures,
      heureDernierJour: b.heure_dernier_jour || null,
      dureeDernierJour: b.duree_dernier_jour,
      technicien: b.technicien || null,
      sousTraitantNom: null,
    };
  }
  const r = reglagesParMetier(b)[metierKey] ?? {};
  return {
    datePlanifiee: r.datePlanifiee || null,
    datePlanifieeFin: r.datePlanifieeFin || null,
    heurePlanifiee: r.heurePlanifiee || null,
    dureeHeures: r.dureeHeures ?? null,
    heureDernierJour: r.heureDernierJour || null,
    dureeDernierJour: r.dureeDernierJour ?? null,
    technicien: r.technicien || null,
    sousTraitantNom: r.sousTraitant || null,
  };
}

export interface JourneeSupplementaire {
  date: string;
  creneau: Creneau | null;
  fait: boolean;
}

const tacheFaite = (t: Pick<TachePlanning, "statut">) => t.statut === "realisee" || t.statut === "validee";

/**
 * Les journées d'une carte qui ne sont pas celle de son rendez-vous.
 * Sans rendez-vous il n'y a pas de « journée en plus » : le bon est non planifié.
 * Le créneau retenu est celui qui commence le plus tôt, pas « la première tâche ».
 */
export function datesSupplementaires(taches: readonly TachePlanning[], dateOrigine: string | null): JourneeSupplementaire[] {
  if (!dateOrigine) return [];
  const autres = [...new Set(taches.map((t) => t.date_tache).filter((d): d is string => !!d && d !== dateOrigine))].sort();
  return autres.map((date) => {
    const duJour = taches.filter((t) => t.date_tache === date);
    const creneau =
      duJour
        .map((t) => creneauDeLaTache(t))
        .filter((c): c is Creneau => !!c)
        .sort((a, b) => a.heure.localeCompare(b.heure))[0] ?? null;
    return { date, creneau, fait: duJour.every(tacheFaite) };
  });
}

/** Toutes les journées du bon (`bcToutesDatesDuBC`). */
export function toutesLesJournees(dateOrigine: string | null, origineFaite: boolean, suppl: readonly JourneeSupplementaire[]) {
  const liste: { date: string; fait: boolean }[] = [];
  if (dateOrigine) liste.push({ date: dateOrigine, fait: origineFaite });
  for (const d of suppl) liste.push({ date: d.date, fait: d.fait });
  return liste;
}

/**
 * L'intervention est-elle faite (`bcInterventionFaite`) ? Tous les métiers
 * pointés et toutes les journées faites — et au moins l'un des deux, sinon un
 * bon sans rien serait « fait ».
 */
export function interventionFaite(metiers: readonly string[], metiersFait: Record<string, boolean>, journees: readonly { fait: boolean }[]): boolean {
  const metiersFaitReel = metiers.length > 0 && metiers.every((m) => metiersFait[m]);
  const datesFaitReel = journees.length > 0 && journees.every((d) => d.fait);
  const metiersOk = metiers.length === 0 || metiersFaitReel;
  const datesOk = journees.length === 0 || datesFaitReel;
  return metiersOk && datesOk && (metiersFaitReel || datesFaitReel);
}

export interface CartePlanning {
  /** `bcId` ou `bcId::METIER` (PLN-03). */
  id: string;
  bcId: string;
  metierKey: string | null;
  metier: string | null;
  /** Position dans les métiers du bon (« 🔗 2/3 »), 0 si mono-métier. */
  positionLiee: number;
  nbMetiers: number;
  bon: BonPlanning;
  rdv: RendezVous;
  /** Métiers dont cette carte porte les tâches. */
  metiersDeLaCarte: (string | null)[];
  equipeId: string | null;
  sousTraitantId: string | null;
  taches: TachePlanning[];
  suppl: JourneeSupplementaire[];
  faite: boolean;
  /** Date de fin des travaux, lue sur les tâches (jamais une colonne tenue à la main — PLN-54). */
  termineeLe: string | null;
  isSav: boolean;
  logementPartage: number;
  /** `null` pour qui ne voit pas les prix : la vue les a déjà masqués. */
  montant: string | number | null;
  tentatives: Tentative[];
}

export interface Annuaires {
  equipes: readonly Equipe[];
  sousTraitants: readonly SousTraitant[];
}

/** L'équipe désignée par le bon : uuid (sélecteur récent) ou libellé (héritage), les deux acceptés. */
export function equipeDesignee(valeur: string | null, equipes: readonly Equipe[]): Equipe | null {
  const brut = (valeur ?? "").trim();
  if (!brut) return null;
  return equipes.find((e) => e.id === brut) ?? equipes.find((e) => e.nom === brut) ?? null;
}

function tachesDeLaCarte(taches: readonly TachePlanning[], metiers: readonly string[], metierKey: string | null, premiere: boolean): TachePlanning[] {
  if (!metierKey) return [...taches];
  return taches.filter((t) => {
    if (memeMetier(t.metier, metierKey)) return true;
    // Une tâche qu'aucun métier du bon ne réclame reste atteignable : sur la première carte (PLN-30).
    return premiere && !metiers.some((m) => memeMetier(m, t.metier));
  });
}

const derniere = (dates: readonly (string | null)[]) => dates.filter((d): d is string => !!d).sort().pop() ?? null;

export function construireCartes(bons: readonly BonPlanning[], taches: readonly TachePlanning[], annuaires: Annuaires): CartePlanning[] {
  const parBon = new Map<string, TachePlanning[]>();
  for (const t of taches) {
    if (!t.bon_commande_id) continue;
    parBon.set(t.bon_commande_id, [...(parBon.get(t.bon_commande_id) ?? []), t]);
  }
  const parDevis = new Map<string, number>();
  for (const b of bons) if (b.devis_id) parDevis.set(b.devis_id, (parDevis.get(b.devis_id) ?? 0) + 1);

  return bons.flatMap((b) => {
    const tachesDuBon = parBon.get(b.id) ?? [];
    const metiers = [...new Set(metiersDuBon(b))];
    const multi = metiers.length > 1;
    const cles: (string | null)[] = multi ? metiers : [null];

    const metiersFait: Record<string, boolean> = {};
    for (const t of tachesDuBon) if (t.metier) metiersFait[t.metier] = tacheFaite(t);
    const origineFaite = tachesDuBon.length > 0 && tachesDuBon.every(tacheFaite);
    const rdvBon = rendezVousDe(b, null);
    const supplBon = datesSupplementaires(tachesDuBon, rdvBon.datePlanifiee);
    const faite = interventionFaite(metiers, metiersFait, toutesLesJournees(rdvBon.datePlanifiee, origineFaite, supplBon));
    const partage = b.devis_id && (parDevis.get(b.devis_id) ?? 0) > 1 ? (parDevis.get(b.devis_id) ?? 0) : 0;

    return cles.map((metierKey, i): CartePlanning => {
      const rdv = rendezVousDe(b, metierKey);
      const siennes = tachesDeLaCarte(tachesDuBon, metiers, metierKey, i === 0);
      const avecST = siennes.find((t) => t.sous_traitant_id);
      const stParNom = rdv.sousTraitantNom ? annuaires.sousTraitants.find((s) => s.nom === rdv.sousTraitantNom) : undefined;
      const equipe = equipeDesignee(rdv.technicien, annuaires.equipes);
      const avecEquipe = siennes.find((t) => t.technicien_id);
      const toutesFaites = siennes.length > 0 && siennes.every(tacheFaite);
      const montantMetier = metierKey ? montantParMetier(b, metierKey) : null;
      return {
        id: metierKey ? `${b.id}::${metierKey}` : b.id,
        bcId: b.id,
        metierKey,
        // Un bon mono-métier dont seul `metiers` est rempli garde son métier (D-PLN-03).
        metier: metierKey ?? b.metier ?? metiers[0] ?? null,
        positionLiee: multi ? i + 1 : 0,
        nbMetiers: multi ? metiers.length : 0,
        bon: b,
        rdv,
        metiersDeLaCarte: metierKey ? [metierKey] : metiers.length ? metiers : [null],
        equipeId: equipe?.id ?? avecEquipe?.technicien_id ?? null,
        sousTraitantId: avecST?.sous_traitant_id ?? stParNom?.id ?? null,
        taches: siennes,
        suppl: metierKey ? datesSupplementaires(siennes, rdv.datePlanifiee) : supplBon,
        faite,
        termineeLe: toutesFaites ? derniere(siennes.map((t) => t.realisee_le)) : null,
        isSav: !!b.bon_commande_parent_id,
        logementPartage: partage,
        montant: montantMetier ?? b.montant,
        tentatives: tentativesDuBon(b),
      };
    });
  });
}

/** La tâche d'une carte pour une journée : celle du jour, sinon la première du métier (`tacheDuBonCommande`). */
export function tacheDuJour(carte: CartePlanning, metier: string | null, jour: string | null): TachePlanning | null {
  const duMetier = carte.taches.filter((t) => memeMetier(t.metier, metier));
  return duMetier.find((t) => t.date_tache === jour) ?? duMetier[0] ?? null;
}

/** Les tâches qu'aucun métier de la carte ne réclame (« Hors métier ») — la première carte les porte. */
export function tachesHorsMetier(carte: CartePlanning): TachePlanning[] {
  return carte.taches.filter((t) => !carte.metiersDeLaCarte.some((m) => memeMetier(m, t.metier)));
}

/**
 * L'ordre des bons de l'ancien écran (`COLLECTIONS_ETAT.bonCommande`,
 * `trierParDate`) : le plus récent d'abord, sur la première date renseignée
 * parmi réception, rendez-vous et date du bon ; la création départage. Les
 * cartes d'un même bon gardent l'ordre de ses métiers (tri stable).
 */
export function trierCommeLAncien<C extends { bon: Pick<BonPlanning, "date_reception" | "date_planifiee" | "date" | "cree_le"> }>(cartes: readonly C[]): C[] {
  const cle = (b: C["bon"]) => b.date_reception || b.date_planifiee || b.date || "";
  return [...cartes].sort((a, b) => cle(b.bon).localeCompare(cle(a.bon)) || (b.bon.cree_le ?? "").localeCompare(a.bon.cree_le ?? ""));
}
