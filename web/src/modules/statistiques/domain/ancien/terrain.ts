import { technicienLabel, type EquipeStats } from "./statistiques";

/**
 * Les tableaux de bord du technicien et du sous-traitant, calculés comme
 * `renderDashboardTechnicien` / `mesBonsTechnicien` et
 * `renderDashboardSousTraitant` (app.js l. 1657-1690, 1724-1790, 1978-2023),
 * DÉFAUTS COMPRIS (D-STA-A-01). Le bon y est vu comme l'ancien pont le
 * reconstituait : `metiersFait`, `valideConducteur`, la pièce et le
 * sous-traitant se lisent sur ses tâches (`reconstituerWorkflow`).
 */

/** Le bon tel que le planning le lit (vue terrain). */
export interface BonTerrain {
  id: string;
  client_nom: string | null;
  adresse: string | null;
  date_planifiee: string | null;
  heure_planifiee: string | null;
  metier: string | null;
  metiers: unknown;
  technicien: string | null;
  montant_sous_traitant: number | string | null;
}

export interface TacheTerrain {
  bon_commande_id: string | null;
  metier: string | null;
  statut: string;
  sous_traitant_id: string | null;
  piece_a_commander: boolean | null;
  piece_date_commande: string | null;
}

const faite = (t: TacheTerrain) => t.statut === "realisee" || t.statut === "validee";

function tachesParBon(taches: readonly TacheTerrain[]): Map<string, TacheTerrain[]> {
  const m = new Map<string, TacheTerrain[]>();
  for (const t of taches) if (t.bon_commande_id) m.set(t.bon_commande_id, [...(m.get(t.bon_commande_id) ?? []), t]);
  return m;
}

/** `metiersFait` du pont : la DERNIÈRE tâche lue d'un métier décide. */
function metiersFait(taches: readonly TacheTerrain[]): Record<string, boolean> {
  const m: Record<string, boolean> = {};
  for (const t of taches) if (t.metier) m[t.metier] = faite(t);
  return m;
}

/** `etatPieceDuBon` : la PREMIÈRE tâche qui attend une pièce dit si elle est commandée. */
function pieceEnAttente(taches: readonly TacheTerrain[]): boolean {
  const enAttente = taches.find((t) => t.piece_a_commander);
  return !!enAttente && !enAttente.piece_date_commande;
}

/** `b.metiers` s'il est une liste non vide, sinon `[b.metier]`, sinon rien. */
function metiersDuBon(b: BonTerrain): unknown[] {
  if (Array.isArray(b.metiers) && b.metiers.length) return b.metiers;
  return b.metier ? [b.metier] : [];
}

export interface TableauTechnicien {
  duJour: BonTerrain[];
  laSemaine: BonTerrain[];
  aPointer: BonTerrain[];
  pieces: BonTerrain[];
}

/**
 * `mesBonsTechnicien` : les bons dont la colonne `technicien` désigne mon
 * équipe, par son uuid ou par son libellé ; sans équipe connue, tous.
 */
export function mesBonsTechnicien(bons: readonly BonTerrain[], equipes: readonly EquipeStats[], monEquipeId: string | null): BonTerrain[] {
  if (!monEquipeId) return [...bons];
  const libelles = equipes.filter((e) => e.id === monEquipeId).map(technicienLabel);
  return bons.filter((b) => b.technicien === monEquipeId || libelles.includes(b.technicien ?? "\u0000"));
}

const SANS_HEURE = "99:99";

/**
 * `renderDashboardTechnicien`. Seule la date du RENDEZ-VOUS compte (pas les
 * journées supplémentaires) ; `finSemaine` est la date de Paris six fois
 * 24 heures plus tard, comme l'ancien. « À pointer » : rendez-vous passé et
 * un métier du bon non déclaré fait (ou aucun métier).
 */
export function tableauTechnicien(miens: readonly BonTerrain[], taches: readonly TacheTerrain[], jour: string, finSemaine: string): TableauTechnicien {
  const parBon = tachesParBon(taches);
  const duJour = miens
    .filter((b) => b.date_planifiee === jour)
    .sort((x, y) => (x.heure_planifiee || SANS_HEURE).localeCompare(y.heure_planifiee || SANS_HEURE));
  return {
    duJour,
    laSemaine: miens.filter((b) => !!b.date_planifiee && b.date_planifiee > jour && b.date_planifiee <= finSemaine),
    aPointer: miens.filter((b) => {
      if (!b.date_planifiee || b.date_planifiee >= jour) return false;
      const metiers = metiersDuBon(b);
      const faits = metiersFait(parBon.get(b.id) ?? []);
      return !metiers.length || metiers.some((m) => !faits[String(m)]);
    }),
    pieces: miens.filter((b) => pieceEnAttente(parBon.get(b.id) ?? [])),
  };
}

// ---------- Sous-traitant ----------

export interface TableauSousTraitant {
  facturesPretes: number;
  /** `devis.sousTraitantEmetteur` n'a pas de colonne : l'ancien comptait toujours 0. */
  devis: number;
  /** `factures.sousTraitantEmetteur` n'a pas de colonne : l'ancien comptait toujours 0. */
  impayees: number;
}

/**
 * `renderDashboardSousTraitant`. « Factures <société> prêtes » = bons dont
 * une tâche porte un sous-traitant (le nom de la PREMIÈRE, comme le pont),
 * le mien s'il est connu, validés par le conducteur (toutes les tâches
 * validées), avec un montant sous-traitant, et qu'aucune facture de
 * sous-traitant ne couvre — il n'en existe aucune (D-FAC-09).
 */
export function tableauSousTraitant(bons: readonly BonTerrain[], taches: readonly TacheTerrain[], nomsSousTraitants: ReadonlyMap<string, string>, sousTraitantActuel: string): TableauSousTraitant {
  const parBon = tachesParBon(taches);
  const pretes = bons.filter((b) => {
    const ts = parBon.get(b.id) ?? [];
    const avecSt = ts.find((t) => t.sous_traitant_id);
    const nom = avecSt?.sous_traitant_id ? (nomsSousTraitants.get(avecSt.sous_traitant_id) ?? "") : "";
    const valideConducteur = ts.length > 0 && ts.every((t) => t.statut === "validee");
    return !!nom && (!sousTraitantActuel || nom === sousTraitantActuel) && valideConducteur && b.montant_sous_traitant != null;
  });
  return { facturesPretes: pretes.length, devis: 0, impayees: 0 };
}
