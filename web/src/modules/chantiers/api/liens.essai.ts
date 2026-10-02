import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * DEF-COR-56 (D-ECR-CHA-10) : l'ancien listait devis et factures du chantier dans
 * l'ordre physique de la base. Un tri sur la seule date laissait deux pièces du
 * même jour s'intervertir d'un chargement à l'autre : on départage par numéro,
 * puis par identifiant. Le client est remplacé par un enregistreur de requêtes.
 */
const tris = vi.hoisted(() => ({ parTable: new Map<string, [string, unknown][]>() }));

function requete(table: string) {
  const r: Record<string, unknown> = {};
  const chaine = () => r;
  for (const m of ["select", "eq", "in"]) r[m] = chaine;
  r.order = (colonne: string, options?: unknown) => {
    tris.parTable.set(table, [...(tris.parTable.get(table) ?? []), [colonne, options]]);
    return r;
  };
  r.then = (ok: (v: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(ok);
  return r;
}
vi.mock("@/lib/supabase", () => ({ supabase: () => ({ from: requete }) }));

const { listerDevisAvecLignes, listerDevisDuChantier, listerFacturesDuChantier } = await import("./liens");

beforeEach(() => tris.parTable.clear());

describe("fiche chantier : un ordre qui ne dépend pas de la base (DEF-COR-56)", () => {
  it.each([
    ["factures", () => listerFacturesDuChantier("ch1")],
    ["devis", () => listerDevisDuChantier("ch1")],
    ["devis (avec lignes)", () => listerDevisAvecLignes("ch1")],
  ] as const)("%s : date décroissante, puis numéro, puis identifiant", async (_nom, lire) => {
    await lire();
    const colonnes = [...tris.parTable.values()].flat().map(([c]) => c);
    expect(colonnes).toEqual(["date", "numero", "id"]);
  });
});
