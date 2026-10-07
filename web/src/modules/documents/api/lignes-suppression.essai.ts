import { describe, expect, it } from "vitest";
import { messageErreur } from "@/lib/erreurs";
import type { Client } from "@/lib/supabase";
import { synchroniserLignes } from "./lignes";

/**
 * Relecture 4, M3 : un `delete` que la RLS refuse ne lève rien, il supprime
 * zéro ligne. Une fausse base qui refuse ainsi toute suppression.
 */
function baseQuiRefuseDeSupprimer(existantes: string[]): Client {
  const requete = () => {
    let suppression = false;
    const q = {
      select: () => q,
      eq: () => q,
      in: () => q,
      delete: () => {
        suppression = true;
        return q;
      },
      then: (ok: (r: unknown) => unknown) => Promise.resolve({ data: suppression ? [] : existantes.map((id) => ({ id })), error: null }).then(ok),
    };
    return q;
  };
  return { from: requete } as unknown as Client;
}

describe("synchroniser les lignes : suppression refusée", () => {
  it("dit que les lignes retirées sont restées, au lieu de les laisser réapparaître en silence", async () => {
    const refus = await synchroniserLignes("devis_lignes", "devis_id", "d1", [], baseQuiRefuseDeSupprimer(["l1", "l2"])).catch((e: unknown) => e);
    expect(messageErreur(refus)).toMatch(/n'ont pas pu être supprimées/);
  });

  it("rien à supprimer : aucun refus", async () => {
    await expect(synchroniserLignes("devis_lignes", "devis_id", "d1", [], baseQuiRefuseDeSupprimer([]))).resolves.toBeUndefined();
  });
});
