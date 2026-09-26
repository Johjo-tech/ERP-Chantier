import { beforeAll, describe, expect, it } from "vitest";
import droitsFixture from "../../src/test/fixtures/role_permissions.json";
import { ALPHA, BETA, COMPTES, anonyme, connecte, type Client } from "./cible";

const TABLES_SOCIETE = ["clients", "chantiers", "devis", "articles"] as const;

describe("la matrice figée des tests d'interface est celle de la base", () => {
  it("role_permissions n'a pas bougé", async () => {
    const c = await connecte(COMPTES.lectureAlpha);
    const { data, error } = await c.from("role_permissions").select("role, module, action");
    expect(error).toBeNull();
    const cle = (d: { role: string; module: string; action: string }) => `${d.role}|${d.module}|${d.action}`;
    expect(new Set((data ?? []).map(cle))).toEqual(new Set(droitsFixture.map(cle)));
  });
});

describe("société A ne voit rien de B", () => {
  for (const compte of Object.values(COMPTES).filter((e) => e.endsWith("alpha@erp.local"))) {
    it(`${compte} : aucune ligne de BETA`, async () => {
      const c = await connecte(compte);
      for (const table of TABLES_SOCIETE) {
        const { data, error } = await c.from(table).select("id, societe_id").eq("societe_id", BETA);
        expect(error, `${table}`).toBeNull();
        expect(data, `${compte} lit ${table} de BETA`).toEqual([]);
      }
      const { data: societes } = await c.from("societes").select("id");
      expect((societes ?? []).map((s) => s.id)).toEqual([ALPHA]);
    });
  }

  it("l'admin de BETA ne voit que BETA", async () => {
    const c = await connecte(COMPTES.adminBeta);
    const { data } = await c.from("clients").select("societe_id");
    expect(data?.length).toBeGreaterThan(0);
    expect(new Set(data?.map((d) => d.societe_id))).toEqual(new Set([BETA]));
  });

  it("un compte d'ALPHA ne peut pas écrire dans BETA", async () => {
    const c = await connecte(COMPTES.adminAlpha);
    const { error } = await c.from("clients").insert({ societe_id: BETA, nom: "Intrus" });
    expect(error?.code).toBe("42501");
  });
});

describe("l'anonyme ne voit rien", () => {
  it("aucune donnée métier sans session", async () => {
    const c = anonyme();
    for (const table of TABLES_SOCIETE) {
      const { data } = await c.from(table).select("id");
      expect(data ?? []).toEqual([]);
    }
  });
});

describe("chaque rôle ne voit que ce qu'il doit", () => {
  let tech: Client;
  let st: Client;
  let lecture: Client;
  let conducteur: Client;

  beforeAll(async () => {
    [tech, st, lecture, conducteur] = await Promise.all([
      connecte(COMPTES.technicienAlpha),
      connecte(COMPTES.sousTraitantAlpha),
      connecte(COMPTES.lectureAlpha),
      connecte(COMPTES.conducteurAlpha),
    ]);
  });

  it("le technicien et le sous-traitant ne lisent ni devis, ni lignes, ni articles", async () => {
    for (const c of [tech, st]) {
      for (const table of ["devis", "devis_lignes", "articles", "factures"] as const) {
        const { data } = await c.from(table).select("id");
        expect(data ?? [], table).toEqual([]);
      }
    }
  });

  it("le terrain ne voit que les chantiers où il est affecté", async () => {
    const { data: t } = await tech.from("chantiers").select("id");
    expect(t?.map((c) => c.id)).toEqual(["a3000000-0000-0000-0000-000000000001"]);
    const { data: s } = await st.from("chantiers").select("id");
    expect(s?.map((c) => c.id)).toEqual(["a3000000-0000-0000-0000-000000000002"]);
    // Le conducteur voit TOUS les chantiers de sa société (d'autres jeux d'essai peuvent en ajouter).
    const { data: c } = await conducteur.from("chantiers").select("id");
    const admin = await connecte(COMPTES.adminAlpha);
    const { count } = await admin.from("chantiers").select("id", { count: "exact", head: true }).eq("societe_id", ALPHA);
    expect(c?.length).toBe(count);
  });

  it("le rôle lecture lit mais n'écrit pas", async () => {
    const { data } = await lecture.from("devis").select("id");
    expect(data?.length).toBeGreaterThan(0);
    const { error } = await lecture.from("clients").insert({ societe_id: ALPHA, nom: "Refusé" });
    expect(error?.code).toBe("42501");
    const { data: maj } = await lecture.from("clients").update({ notes: "x" }).eq("societe_id", ALPHA).select("id");
    expect(maj ?? []).toEqual([]);
  });

  it("le conducteur ne supprime pas un devis (droit absent de la matrice)", async () => {
    const { data } = await conducteur.from("devis").delete().eq("societe_id", ALPHA).select("id");
    expect(data ?? []).toEqual([]);
    const { data: reste } = await conducteur.from("devis").select("id");
    expect(reste?.length).toBeGreaterThan(0);
  });
});
