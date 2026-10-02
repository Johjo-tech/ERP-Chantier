import { describe, expect, it, vi } from "vitest";
import { messageErreur } from "@/lib/erreurs";

/**
 * Relecture 4, M2 : un `update` d'en-tête que la RLS refuse touche zéro ligne
 * sans lever d'erreur ; les lignes partaient ensuite seules. La fausse base
 * rend zéro ligne à tout `update`.
 */
const lignesEcrites = vi.hoisted(() => ({ n: 0 }));

function requete() {
  const q = {
    update: () => q,
    eq: () => q,
    select: () => q,
    then: (ok: (r: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(ok),
  };
  return q;
}

vi.mock("@/lib/supabase", () => ({ supabase: () => ({ from: () => requete() }) }));
vi.mock("@/modules/documents/api/lignes", () => ({
  synchroniserLignes: vi.fn(async () => {
    lignesEcrites.n += 1;
  }),
}));

const { enregistrerDevis } = await import("./devis");

describe("enregistrer un devis refusé par la base", () => {
  it("refuse avant d'écrire les lignes, et dit pourquoi", async () => {
    const entete = { conducteur_id: null } as unknown as Parameters<typeof enregistrerDevis>[2];
    const refus = await enregistrerDevis("s1", "d1", entete, []).catch((e: unknown) => e);
    expect(lignesEcrites.n).toBe(0);
    expect(messageErreur(refus)).toMatch(/n'existe plus, ou vous n'avez pas le droit/);
  });
});
