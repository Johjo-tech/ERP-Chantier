/**
 * Parité de l'étape 4 de la reprise (production 3c6bc02) : un avoir repris
 * arrive déjà consommé. On fait tourner `importerFactures` de l'ANCIEN
 * (src/api/queries/factures-import.ts, importé tel quel) sur un client de
 * base factice qui enregistre ce qu'on lui demande d'écrire, et l'on compare
 * l'imputation demandée à celle que web/ écrit (`imputationDeReprise`, posée
 * sur la société et la pièce par `api/factures.ts`).
 */
import { describe, expect, it, vi } from "vitest";

const ecritures = vi.hoisted(() => ({ reglements: [] as Record<string, unknown>[], refuserReglement: false, compteur: 0 }));
vi.mock("../../../src/api/client", () => ({
  supabase: {},
  SupabaseError: class extends Error {},
  enLots: <T>(t: T[]) => [t],
  insertOne: (table: string, valeurs: Record<string, unknown>) => {
    if (table === "reglements") {
      if (ecritures.refuserReglement) return Promise.reject(Object.assign(new Error("refus"), { code: "42501" }));
      ecritures.reglements.push(valeurs);
    }
    ecritures.compteur++;
    return Promise.resolve({ id: `id-${ecritures.compteur}` });
  },
  insertMany: (_t: string, lignes: unknown[]) => Promise.resolve(lignes),
  updateOne: () => Promise.resolve({}),
}));

/** La même base factice pour web/ : chaque ordre PostgREST se résout comme `insertOne` ci-dessus. */
vi.mock("@/lib/supabase", () => ({
  supabase: () => ({
    from: (table: string) => {
      let valeurs: unknown = null;
      let op = "";
      const ordre = {
        insert: (v: unknown) => ((op = "insert"), (valeurs = v), ordre),
        update: (v: unknown) => ((op = "update"), (valeurs = v), ordre),
        eq: () => ordre,
        select: () => ordre,
        single: () => ordre,
        then: (resoudre: (r: unknown) => unknown) => {
          if (table === "reglements") {
            if (ecritures.refuserReglement) return Promise.resolve({ data: null, error: { code: "42501" } }).then(resoudre);
            ecritures.reglements.push(valeurs as Record<string, unknown>);
            return Promise.resolve({ data: [{ id: "r" }], error: null }).then(resoudre);
          }
          if (table === "facture_lignes") return Promise.resolve({ data: valeurs, error: null }).then(resoudre);
          if (op === "update") return Promise.resolve({ data: [{ id: "u" }], error: null }).then(resoudre);
          ecritures.compteur++;
          return Promise.resolve({ data: { id: `id-${ecritures.compteur}` }, error: null }).then(resoudre);
        },
      };
      return ordre;
    },
  }),
}));

const ancien = await import("../../../src/api/queries/factures-import");
const nouveau = await import("../../src/modules/import-export/api/factures");
const { imputationDeReprise, pieceAEcrire, REFERENCE_AVOIR_REPRIS } = await import("../../src/modules/import-export/domain/apercu-factures");
const { analyserExportFactures } = await import("../../src/modules/import-export/domain/factures");

const ENTETES =
  "numero_facture;type;date_facture;client;montant_ht;taux_tva;montant_tva;montant_ttc\n" +
  "F1;facture;2025-01-10;CDC HABITAT;100,00;20;20,00;120,00\n" +
  "A1;avoir;2025-02-10;CDC HABITAT;-50,00;20;-10,00;-60,00\n" +
  "A2;avoir;2025-03-11;OPAC;-12,34;10;-1,23;-13,57\n" +
  "A0;avoir;2025-03-12;OPAC;0,00;20;0,00;0,00\n";

function pieces() {
  const rapport = analyserExportFactures(new TextEncoder().encode(ENTETES), null, {});
  return rapport.factures.map((f) => pieceAEcrire(f, null, "payée"));
}

describe("reprise : l'avoir repris arrive déjà imputé (3c6bc02)", () => {
  it("même imputation que l'ancien : TTC en positif, au jour de la pièce, mode « imputation », référence en clair ; rien pour une facture ni un avoir à zéro", async () => {
    ecritures.reglements = [];
    const ps = pieces();
    const r = await ancien.importerFactures("s1" as never, ps as never);
    expect(r.echecs).toEqual([]);
    // L'ancien numérote ses identifiants au fil des insertions : on relit celui de chaque pièce.
    const neuf = ps.flatMap((p) => {
      const i = imputationDeReprise(p);
      return i ? [{ ...i, numero: p.numero }] : [];
    });
    expect(ecritures.reglements.map(({ facture_id: _f, ...reste }) => reste)).toEqual(neuf.map(({ numero: _n, ...i }) => ({ ...i, societe_id: "s1" })));
    expect(neuf.map((i) => [i.numero, i.montant, i.date])).toEqual([["A1", 60, "2025-02-10"], ["A2", 13.57, "2025-03-11"]]);
    expect(REFERENCE_AVOIR_REPRIS).toBe(ancien.REFERENCE_AVOIR_REPRIS);
  });

  it("web/ écrit les mêmes imputations, par son propre chemin d'écriture", async () => {
    ecritures.reglements = [];
    await ancien.importerFactures("s1" as never, pieces() as never);
    const vieux = ecritures.reglements.map(({ facture_id: _f, ...reste }) => reste);
    ecritures.reglements = [];
    const r = await nouveau.importerFactures("s1", pieces());
    expect(r).toMatchObject({ ecrites: 4, echecs: [], brouillonsOrphelins: [] });
    expect(ecritures.reglements.map(({ facture_id: _f, ...reste }) => reste)).toEqual(vieux);
    expect(ecritures.reglements.every((x) => typeof x.facture_id === "string" && x.facture_id.startsWith("id-"))).toBe(true);
  });

  it("une imputation refusée est NOMMÉE à son étape, et la pièce reste écrite (ni orpheline, ni supprimable) — comme l'ancien", async () => {
    ecritures.refuserReglement = true;
    const vieux = await ancien.importerFactures("s1" as never, pieces() as never);
    const neuf = await nouveau.importerFactures("s1", pieces());
    ecritures.refuserReglement = false;
    const forme = (r: { ecrites: number; echecs: { numero: string; etape: string; motif: string }[]; brouillonsOrphelins: unknown[] }) => ({ ecrites: r.ecrites, echecs: r.echecs.map((e) => [e.numero, e.etape, e.motif]), orphelins: r.brouillonsOrphelins });
    expect(forme(neuf)).toEqual(forme(vieux));
    expect(forme(neuf)).toEqual({ ecrites: 4, echecs: [["A1", "imputation", "vos droits ne permettent pas d'écrire les factures"], ["A2", "imputation", "vos droits ne permettent pas d'écrire les factures"]], orphelins: [] });
  });
});
