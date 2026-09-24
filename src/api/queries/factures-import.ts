/**
 * Écriture d'un historique de facturation déjà numéroté.
 *
 * ── POURQUOI CE FICHIER N'UTILISE PAS `createFacture` ──────────────────────
 * `createFacture` (`factures.ts:130`) sait déjà naître brouillon puis émettre,
 * et c'est la bonne idée. Mais elle a une porte dérobée : un `input.numero`
 * fourni la fait insérer la facture **déjà numérotée** (`emiseDEmblee` est alors
 * faux, ligne 139). Le parent porte donc un numéro avant que ses lignes
 * n'arrivent — et `facture_lignes_figees` ne tolère l'insertion que tant que la
 * facture n'a AUCUNE ligne (`20260910180000…sql:42-49`). La première ligne
 * passe, la deuxième est refusée. Sur nos 768 pièces, 39 en portent plusieurs.
 *
 * D'où la séquence en trois temps, qui ne laisse jamais un déclencheur voir un
 * parent numéroté :
 *
 *   1. INSERT facture   statut « brouillon », numero NULL, tout le reste plein
 *   2. INSERT lignes    librement : la facture n'a pas de numéro
 *   3. UPDATE facture   numero + statut, en UN seul ordre
 *
 * Au 3, les deux déclencheurs s'effacent pour des raisons opposées et
 * complémentaires : `factures_entete_figee` regarde `OLD.numero`, qui est vide ;
 * `facture_attribuer_numero` regarde `NEW.numero`, qui est plein — donc il ne
 * touche pas au compteur (`20260914110000…sql:50`). La série importée et la
 * série native `FAC-2026-000001` coexistent sans se voir.
 *
 * ── CE QUI SE JOUE ICI, ET QU'ON NE RATTRAPERA PAS ─────────────────────────
 * Après l'étape 3, la pièce est close : l'en-tête est gelé hors liste blanche,
 * les lignes n'acceptent plus ni UPDATE ni DELETE, et `facture_numero_immuable`
 * refuse jusqu'à la suppression de la facture (`20260910120000…sql:151`). Un
 * import raté ne se défait pas par l'API — il faudrait une migration exécutée
 * en `postgres`, déclencheurs désarmés. L'étape 1 doit donc être exhaustive.
 */

import { enLots, insertMany, insertOne, supabase, SupabaseError, updateOne } from "../client";
import type { FactureInsert, FactureLigneInsert, FactureStatut, Uuid } from "../types";

/** Assez grand pour que 768 pièces tiennent en quatre requêtes de lecture. */
const LOT_LECTURE = 200;

/**
 * Lesquels de ces numéros sont déjà pris dans cette société ?
 *
 * On demande AVANT d'écrire plutôt que d'attendre le 23505 de
 * `factures_societe_numero_unique_idx` : un conflit rencontré en cours de route
 * laisserait derrière lui des brouillons sans numéro, invisibles dans l'écran
 * des factures et à retrouver un par un.
 */
export async function numerosDejaPris(societeId: Uuid, numeros: string[]): Promise<Set<string>> {
  const pris = new Set<string>();
  for (const lot of enLots(numeros, LOT_LECTURE)) {
    const { data, error } = await supabase
      .from("factures")
      .select("numero")
      .eq("societe_id", societeId)
      .in("numero", lot);

    if (error) throw new SupabaseError("Failed to list numeros", error.code, error);
    for (const row of data ?? []) if (row.numero) pris.add(row.numero);
  }
  return pris;
}

/** Une pièce prête à écrire : son en-tête, ses lignes, son numéro final. */
export interface PieceAEcrire {
  numero: string;
  statut: FactureStatut;
  entete: Omit<FactureInsert, "societe_id" | "numero" | "statut">;
  lignes: Omit<FactureLigneInsert, "facture_id">[];
}

export interface EchecPiece {
  numero: string;
  /** À quelle étape, pour savoir ce qui reste en base. */
  etape: "entete" | "lignes" | "numero";
  motif: string;
}

export interface ResultatImportFactures {
  ecrites: number;
  lignes: number;
  echecs: EchecPiece[];
  /**
   * Les brouillons laissés derrière par un échec aux étapes 2 ou 3 : ils
   * portent des lignes et aucun numéro. Nommés pour qu'on puisse les reprendre
   * ou les supprimer — sans numéro, la suppression est encore permise.
   */
  brouillonsOrphelins: { numero: string; id: string }[];
}

/** Un refus de la base, dit en français plutôt que recopié brut. */
function motifLisible(err: unknown): string {
  const e = err as { code?: string; message?: string };
  if (e?.code === "42501") return "vos droits ne permettent pas d'écrire les factures";
  if (e?.code === "23502") return "une colonne obligatoire est restée vide";
  if (e?.code === "23505") return "ce numéro est déjà pris";
  if (e?.code === "23503") return "le client référencé n'existe pas";
  if (e?.code === "2201G" || e?.code === "restrict_violation") {
    return "la base refuse : la pièce est déjà figée";
  }
  return e?.message || "refus de la base";
}

/**
 * Écrit les pièces, une par une.
 *
 * **Jamais par lot**, et c'est le point : un lot de 768 qui tombe au milieu
 * laisserait des brouillons sans numéro à retrouver à la main, sans dire
 * lesquels. Une pièce en échec est nommée avec son étape ; les autres
 * continuent. L'import reste reprenable tant que l'étape 3 n'a pas eu lieu.
 *
 * `onProgress` n'est pas décoratif : 768 pièces font plus de 1 500 allers-
 * retours, et un écran figé pendant plusieurs minutes passe pour une panne.
 */
export async function importerFactures(
  societeId: Uuid,
  pieces: PieceAEcrire[],
  onProgress?: (faites: number, total: number) => void
): Promise<ResultatImportFactures> {
  const echecs: EchecPiece[] = [];
  const brouillonsOrphelins: { numero: string; id: string }[] = [];
  let ecrites = 0;
  let lignes = 0;

  for (const [i, piece] of pieces.entries()) {
    let id: Uuid | null = null;

    // 1. L'en-tête, brouillon et sans numéro : aucun déclencheur ne mord.
    try {
      const facture = await insertOne("factures", {
        ...piece.entete,
        societe_id: societeId,
        statut: "brouillon",
      } as FactureInsert);
      id = facture.id as Uuid;
    } catch (err) {
      echecs.push({ numero: piece.numero, etape: "entete", motif: motifLisible(err) });
      onProgress?.(i + 1, pieces.length);
      continue;
    }

    // 2. Les lignes, tant que le parent n'a pas de numéro.
    try {
      const posees = await insertMany(
        "facture_lignes",
        piece.lignes.map((l, n) => ({ ...l, facture_id: id as Uuid, position: l.position ?? n }))
      );
      lignes += posees.length;
    } catch (err) {
      echecs.push({ numero: piece.numero, etape: "lignes", motif: motifLisible(err) });
      brouillonsOrphelins.push({ numero: piece.numero, id });
      onProgress?.(i + 1, pieces.length);
      continue;
    }

    /* 3. Le numéro et le statut, en UN seul ordre. Les séparer rouvrirait
          précisément la faille qu'on évite : poser le numéro d'abord figerait
          l'en-tête avant que le statut n'y soit. */
    try {
      await updateOne("factures", id, { numero: piece.numero, statut: piece.statut });
      ecrites++;
    } catch (err) {
      echecs.push({ numero: piece.numero, etape: "numero", motif: motifLisible(err) });
      brouillonsOrphelins.push({ numero: piece.numero, id });
    }

    onProgress?.(i + 1, pieces.length);
  }

  return { ecrites, lignes, echecs, brouillonsOrphelins };
}

/**
 * Supprime les brouillons qu'un import raté a laissés.
 *
 * Possible seulement parce qu'ils n'ont pas de numéro : `facture_numero_immuable`
 * ne refuse le DELETE que sur une pièce numérotée. C'est la seule fenêtre de
 * rattrapage de tout ce circuit, et elle se referme à l'étape 3.
 */
export async function supprimerBrouillonsImport(ids: string[]): Promise<number> {
  if (!ids.length) return 0;
  const { error, count } = await supabase
    .from("factures")
    .delete({ count: "exact" })
    .in("id", ids)
    .is("numero", null);

  if (error) throw new SupabaseError("Failed to delete drafts", error.code, error);
  return count ?? 0;
}
