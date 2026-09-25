import Big from "big.js";
import { z } from "zod";
import { schemaNombreFr } from "@/lib/nombres";
import type { LigneAEnregistrer } from "@/modules/documents/domain/lignes";
import { memeMetier, metierDeLaLigne } from "./metiers";

/**
 * La pré-facture du directeur (port de `src/integrations/prefacture.ts`,
 * parité : tests/parite/circuit.essai.ts).
 *
 * Chaque travail supplémentaire rejoint le chapitre du métier sur lequel il a
 * été constaté ; ce qui ne trouve pas son chapitre reste groupé à la fin. Le
 * même placement sert à l'AFFICHAGE et à l'INTÉGRATION dans les lignes du bon :
 * la facture dit exactement ce que l'écran a montré.
 */
export const CHAPITRE_BON_COMMANDE = "Bon de commande";
export const CHAPITRE_TRAVAUX_SUP = "Travaux supplémentaires constatés sur le chantier";
/** Un travail non mesuré vaut un forfait (BC-47). */
export const QUANTITE_DEFAUT = 1;
export const UNITE_DEFAUT = "u";
/** Le défaut de la colonne `tache_travaux_supplementaires.tva` (BC-46), donné explicitement à l'insertion. */
export const TVA_TRAVAIL_DEFAUT = 10;

export const schemaTravail = z.object({
  id: z.string(),
  bon_commande_id: z.string(),
  planning_tache_id: z.string().nullable(),
  libelle: z.string(),
  unite: z.string().nullable(),
  quantite: z.number().nullable(),
  /** NULL pour qui ne voit pas les prix : la vue terrain le masque. */
  prix_vente_ht: z.number().nullable(),
  tva: z.number().nullable(),
  origine: z.string(),
  statut: z.enum(["a_chiffrer", "chiffre", "integre", "refuse"]),
  cree_le: z.string().nullable(),
});
export type Travail = z.infer<typeof schemaTravail>;

const ORIGINES: Record<string, string> = { technicien: "Ajouté — technicien", conducteur: "Ajouté — conducteur" };
export const badgeOrigine = (origine: string | null | undefined) => ORIGINES[origine ?? ""] ?? "Ajouté en cours de chantier";

export interface TacheDuTravail {
  id: string;
  metier: string | null;
}

/** Le métier d'un travail : celui de la tâche pendant laquelle il a été constaté (pas de colonne à tenir d'accord). */
export function metierDuTravail(t: { planning_tache_id: string | null }, taches: readonly TacheDuTravail[]): string | null {
  if (!t.planning_tache_id) return null;
  return (taches.find((x) => x.id === t.planning_tache_id)?.metier ?? "").trim() || null;
}

export interface LigneDocument {
  id: string | null;
  type: "ligne" | "chapitre" | "commentaire";
  designation: string;
  quantite: number;
  prix_unitaire: number;
  unite: string | null;
  tva: number;
  article_reference: string | null;
  commentaire: string | null;
  metier: string | null;
  /** Présent sur une ligne née d'un travail supplémentaire : l'écran la distingue, la facture non. */
  ajout?: { travailId: string; badge: string };
}

export interface Placement<T> {
  apres: Map<number, T[]>;
  restants: T[];
}

/** Chaque travail à la suite du DERNIER élément du chapitre de son métier ; les autres, à part. */
export function placerTravaux<T extends { planning_tache_id: string | null }>(
  lignes: readonly { type?: string | null; designation?: string | null; metier?: string | null }[],
  travaux: readonly T[],
  taches: readonly TacheDuTravail[],
  connus: readonly string[]
): Placement<T> {
  const blocs: { metier: string | null; dernier: number }[] = [];
  lignes.forEach((l, i) => {
    if (l.type === "chapitre") blocs.push({ metier: metierDeLaLigne(l, connus)?.metier ?? null, dernier: i });
    else if (blocs.length) (blocs[blocs.length - 1] as { dernier: number }).dernier = i;
  });
  const apres = new Map<number, T[]>();
  const restants: T[] = [];
  for (const t of travaux) {
    const metier = metierDuTravail(t, taches);
    const bloc = metier ? blocs.find((b) => !!b.metier && memeMetier(b.metier, metier)) : undefined;
    if (!bloc) {
      restants.push(t);
      continue;
    }
    apres.set(bloc.dernier, [...(apres.get(bloc.dernier) ?? []), t]);
  }
  return { apres, restants };
}

function travailEnLigne(t: Travail, tvaDefaut: number): LigneDocument {
  return {
    id: null,
    type: "ligne",
    designation: t.libelle,
    quantite: t.quantite ?? QUANTITE_DEFAUT,
    prix_unitaire: t.prix_vente_ht ?? 0,
    unite: t.unite || UNITE_DEFAUT,
    tva: t.tva ?? tvaDefaut,
    article_reference: null,
    commentaire: null,
    metier: null,
    ajout: { travailId: t.id, badge: badgeOrigine(t.origine) },
  };
}

/**
 * Le document du directeur : les lignes du bon, chaque travail glissé dans le
 * chapitre de son métier, le reste sous « Travaux supplémentaires constatés ».
 * Un chapitre « Bon de commande » coiffe les lignes d'origine quand elles n'ont
 * aucune structure — sans lui, seules les lignes ajoutées auraient un sous-total.
 */
export function documentDirecteur(lignes: readonly LigneDocument[], travaux: readonly Travail[], taches: readonly TacheDuTravail[], connus: readonly string[], tvaDefaut: number): LigneDocument[] {
  if (!travaux.length) return [...lignes];
  const { apres, restants } = placerTravaux(lignes, travaux, taches, connus);
  const doc: LigneDocument[] = [];
  const chapitre = (designation: string): LigneDocument => ({ id: null, type: "chapitre", designation, quantite: 0, prix_unitaire: 0, unite: null, tva: 0, article_reference: null, commentaire: null, metier: null });
  if (lignes.length) {
    if (!lignes.some((l) => l.type === "chapitre")) doc.push(chapitre(CHAPITRE_BON_COMMANDE));
    lignes.forEach((l, i) => {
      doc.push(l);
      for (const t of apres.get(i) ?? []) doc.push(travailEnLigne(t, tvaDefaut));
    });
  }
  if (restants.length) {
    doc.push(chapitre(CHAPITRE_TRAVAUX_SUP));
    doc.push(...restants.map((t) => travailEnLigne(t, tvaDefaut)));
  }
  return doc;
}

/**
 * Le prix saisi d'un travail : virgule admise, négatif refusé ; « PLB-001 »
 * n'est plus lu 0 comme par `parseFloat` (BC-72). `null` = rien de saisi.
 */
export function lirePrixTravail(saisie: string): { ok: true; prix: number | null } | { ok: false; message: string } {
  const texte = saisie.trim();
  if (!texte) return { ok: true, prix: null };
  const r = schemaNombreFr.safeParse(texte);
  if (!r.success) return { ok: false, message: "Montant invalide." };
  if (r.data < 0) return { ok: false, message: "Un prix ne peut pas être négatif." };
  return { ok: true, prix: r.data };
}

export interface ComptesRendu {
  tacheId: string;
  metier: string;
  date: string;
  statut: string;
  commentaire: string;
}

/** Tous les comptes-rendus terrain, pas seulement le premier (l'ancienne reconstitution en perdait). */
export function comptesRendus(taches: readonly { id: string; metier: string | null; date_tache: string | null; statut: string | null; commentaire: string | null }[]): ComptesRendu[] {
  return taches
    .filter((t) => (t.commentaire ?? "").trim())
    .map((t) => ({ tacheId: t.id, metier: t.metier ?? "", date: t.date_tache ?? "", statut: t.statut ?? "", commentaire: (t.commentaire ?? "").trim() }));
}

/**
 * Le document devenu lignes du bon : les ajouts perdent leur surbrillance (ni
 * colonne ni sens une fois enregistrés), les positions suivent l'ordre du
 * document, et le HT de ligne est le produit exact (convention de la table).
 */
export function versLignesAEnregistrer(doc: readonly LigneDocument[]): LigneAEnregistrer[] {
  return doc.map(({ ajout: _ajout, ...l }, position) => ({
    ...l,
    position,
    montant_ht: l.type === "ligne" ? Number(new Big(l.quantite).times(l.prix_unitaire).toString()) : 0,
  }));
}

/** Les lignes d'un bon, dans la forme du document. */
export function depuisLignesAEnregistrer(lignes: readonly LigneAEnregistrer[]): LigneDocument[] {
  return lignes.map(({ position: _p, montant_ht: _m, ...l }) => ({ ...l }));
}

/** La saisie du directeur sur un travail : un prix saisi chiffre le travail (majTravailDirecteur). */
export interface SaisieTravail {
  quantite: string;
  unite: string;
  prix: string;
}

export function travauxSaisis(travaux: readonly Travail[], saisies: Readonly<Record<string, SaisieTravail>>): { travaux: Travail[]; erreurs: Record<string, string> } {
  const erreurs: Record<string, string> = {};
  const sortie = travaux.map((t) => {
    const s = saisies[t.id];
    if (!s) return t;
    const p = lirePrixTravail(s.prix);
    const q = lirePrixTravail(s.quantite);
    if (!p.ok) erreurs[t.id] = p.message;
    else if (!q.ok) erreurs[t.id] = "Quantité invalide.";
    if (!p.ok || !q.ok) return t;
    return {
      ...t,
      quantite: q.prix ?? t.quantite,
      unite: s.unite.trim() || t.unite,
      prix_vente_ht: p.prix ?? t.prix_vente_ht,
      // Le statut ne bascule qu'au prix : une quantité sans montant ne chiffre rien, et la base doit continuer de bloquer.
      statut: p.prix !== null && t.statut === "a_chiffrer" ? ("chiffre" as const) : t.statut,
    };
  });
  return { travaux: sortie, erreurs };
}
