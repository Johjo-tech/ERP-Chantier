import { beforeEach, describe, expect, it, vi } from "vitest";
import droits from "@/test/fixtures/role_permissions.json";
import { DemarrageImpossible } from "../domain/demarrage";

/**
 * L'ordre du démarrage (AUTH-07) : on simule le client Supabase et on relève
 * l'ordre des tables interrogées.
 */
const faux = vi.hoisted(() => ({
  journal: [] as string[],
  matrice: { data: [] as unknown[], error: null as unknown, count: 0 as number | null },
}));

function reponse(table: string) {
  switch (table) {
    case "role_permissions":
      return faux.matrice;
    case "profiles":
      return { data: { id: "u1", nom: "Admin", email: "admin@erp.local" }, error: null };
    case "membres_societe":
      return { data: [{ role: "admin", societe: { id: "s1", code: "ALPHA", nom: "ALPHA", niveau_abonnement: null } }], error: null };
    default:
      return { data: [], error: null };
  }
}

/** Une requête PostgREST factice : chaînable, et « thenable » comme la vraie. */
function requete(table: string) {
  const r = {
    select: () => r,
    eq: () => r,
    single: () => r,
    then: (ok: (v: unknown) => unknown, ko: (e: unknown) => unknown) => {
      faux.journal.push(table);
      return Promise.resolve(reponse(table)).then(ok, ko);
    },
  };
  return r;
}

vi.mock("@/lib/supabase", () => ({
  supabase: () => ({ from: requete }),
  supabasePropositions: () => ({ from: requete }),
}));

const { chargerSession } = await import("./session");

beforeEach(() => {
  faux.journal = [];
  faux.matrice = { data: droits, error: null, count: droits.length };
});

describe("démarrage ordonné (AUTH-07)", () => {
  it("matrice d'abord, puis profil, sociétés et rôles, puis accès client", async () => {
    const s = await chargerSession("u1");
    expect(faux.journal).toEqual(["role_permissions", "profiles", "membres_societe", "v_mes_acces_clients"]);
    expect(s.societes).toEqual([{ id: "s1", code: "ALPHA", nom: "ALPHA", role: "admin", niveauAbonnement: null }]);
    expect(s.matrice.size).toBe(droits.length);
  });

  it("une matrice vide arrête tout avant d'interroger le reste (AUTH-33)", async () => {
    faux.matrice = { data: [], error: null, count: 0 };
    await expect(chargerSession("u1")).rejects.toBeInstanceOf(DemarrageImpossible);
    expect(faux.journal).toEqual(["role_permissions"]);
  });

  it("une matrice tronquée par le plafond de lignes refuse de démarrer (AUTH-33)", async () => {
    faux.matrice = { data: droits.slice(0, 100), error: null, count: droits.length };
    await expect(chargerSession("u1")).rejects.toThrow(/tronquée : 100 lignes reçues sur 184/);
  });
});
