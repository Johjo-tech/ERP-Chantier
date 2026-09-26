/**
 * Le catalogue d'articles contre la base LOCALE : politiques RLS par rôle
 * (ART-06, ART-30, ART-40), et le module `articles/api` tel que l'écran
 * l'emploie — recherche échappée, pagination, retrait, import par lots.
 *
 * Tout ce qui est écrit porte le préfixe ESSAI-RLS et disparaît à la fin.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  articleParCode,
  changerActif,
  chercherArticles,
  chercherPourLigne,
  CodeEnDouble,
  creerArticle,
  importerArticles,
  LOT_IMPORT,
  listerFamilles,
  modifierArticle,
} from "../../src/modules/articles/api/articles";
import { CRITERES_DEFAUT, type SaisieArticle } from "../../src/modules/articles/domain/article";
import type { ArticleImporte } from "../../src/modules/articles/domain/import";
import { ALPHA, BETA, COMPTES, connecte, type Client } from "./cible";

const PREFIXE = "ESSAI-RLS";
const saisie = (code: string, extra: Partial<SaisieArticle> = {}): SaisieArticle => ({
  code, designation: `Essai ${code}`, famille: "Essais RLS", description: null, type_article: "service", unite: "u",
  prix_unitaire: 10, prix_achat: null, tva: 20, gere_en_stock: false, ...extra,
});
const importe = (code: string): ArticleImporte => ({
  code, designation: `Importé ${code}`, description: null, prix_unitaire: 1.5, prix_achat: null, unite: "m²",
  type_article: "bien", tva: 10, actif: true, gere_en_stock: false, famille: "Essais import",
});

let secretaire: Client;
let conducteur: Client;
let lecture: Client;
let technicien: Client;
let sousTraitant: Client;
let adminBeta: Client;

beforeAll(async () => {
  [secretaire, conducteur, lecture, technicien, sousTraitant, adminBeta] = await Promise.all([
    connecte(COMPTES.secretaireAlpha),
    connecte(COMPTES.conducteurAlpha),
    connecte(COMPTES.lectureAlpha),
    connecte(COMPTES.technicienAlpha),
    connecte(COMPTES.sousTraitantAlpha),
    connecte(COMPTES.adminBeta),
  ]);
});

afterAll(async () => {
  // Nettoyage par les admins : la suppression n'est offerte par aucun écran (ART-03).
  const admin = await connecte(COMPTES.adminAlpha);
  await admin.from("articles").delete().eq("societe_id", ALPHA).like("code", `${PREFIXE}%`);
  await adminBeta.from("articles").delete().eq("societe_id", BETA).like("code", `${PREFIXE}%`);
});

describe("qui lit le catalogue", () => {
  it("le technicien et le sous-traitant ne lisent AUCUN article, ni n'en créent (ART-40)", async () => {
    for (const c of [technicien, sousTraitant]) {
      const { data } = await c.from("articles").select("id");
      expect(data ?? []).toEqual([]);
      await expect(creerArticle(ALPHA, saisie(`${PREFIXE}-TERRAIN`), c)).rejects.toMatchObject({ code: "42501" });
    }
  });

  it.each([
    ["conducteur", () => conducteur],
    ["lecture", () => lecture],
  ])("le rôle %s lit sans écrire", async (_, client) => {
    const c = client();
    const page = await chercherArticles(ALPHA, CRITERES_DEFAUT, c);
    expect(page.total).toBeGreaterThanOrEqual(3);
    await expect(creerArticle(ALPHA, saisie(`${PREFIXE}-LECT`), c)).rejects.toMatchObject({ code: "42501" });
    const cible = page.articles[0]?.id as string;
    await expect(changerActif(cible, false, c)).rejects.toMatchObject({ code: "42501" });
    const r = await importerArticles(ALPHA, [importe(`${PREFIXE}-LECT-IMP`)], c);
    expect(r.crees + r.misAJour).toBe(0);
    expect(r.echecs).toHaveLength(1);
  });

  it("BETA est invisible d'ALPHA, et ALPHA de BETA", async () => {
    await creerArticle(BETA, saisie(`${PREFIXE}-BETA`), adminBeta);
    expect((await chercherArticles(BETA, { ...CRITERES_DEFAUT, actif: "tous" }, secretaire)).total).toBe(0);
    expect(await chercherPourLigne(BETA, PREFIXE, secretaire)).toEqual([]);
    const { data } = await adminBeta.from("articles").select("societe_id");
    expect(new Set(data?.map((d) => d.societe_id))).toEqual(new Set([BETA]));
    await expect(creerArticle(BETA, saisie(`${PREFIXE}-INTRUS`), secretaire)).rejects.toMatchObject({ code: "42501" });
  });
});

describe("la secrétaire tient le catalogue", () => {
  it("crée, refuse le code en double, modifie", async () => {
    const a = await creerArticle(ALPHA, saisie(`${PREFIXE}-S1`, { prix_achat: 4.1234, gere_en_stock: true }), secretaire);
    expect(a).toMatchObject({ societe_id: ALPHA, actif: true, prix_achat: 4.1234, gere_en_stock: true, type_article: "service" });
    await expect(creerArticle(ALPHA, saisie(`${PREFIXE}-S1`), secretaire)).rejects.toBeInstanceOf(CodeEnDouble);
    await expect(creerArticle(ALPHA, saisie(`${PREFIXE}-S1`), secretaire)).rejects.toThrow(`Le code « ${PREFIXE}-S1 » existe déjà dans le catalogue.`);
    const m = await modifierArticle(a.id, saisie(`${PREFIXE}-S1`, { designation: "Renommé", tva: 5.5 }), secretaire);
    expect(m).toMatchObject({ designation: "Renommé", tva: 5.5, actif: true });
  });

  it("retirer cache l'article à la saisie des lignes (ART-20), remettre le rend", async () => {
    const a = await creerArticle(ALPHA, saisie(`${PREFIXE}-R1`), secretaire);
    await changerActif(a.id, false, secretaire);
    expect(await articleParCode(ALPHA, `${PREFIXE}-R1`, secretaire)).toBeNull();
    expect((await chercherPourLigne(ALPHA, `${PREFIXE}-R1`, secretaire)).map((x) => x.code)).toEqual([]);
    const retires = await chercherArticles(ALPHA, { ...CRITERES_DEFAUT, recherche: `${PREFIXE}-R1`, actif: "retires" }, secretaire);
    expect(retires.articles.map((x) => x.code)).toEqual([`${PREFIXE}-R1`]);
    await changerActif(a.id, true, secretaire);
    expect((await articleParCode(ALPHA, ` ${PREFIXE}-R1 `, secretaire))?.id).toBe(a.id);
  });

  it("la recherche prend % et _ au pied de la lettre, et supporte virgules et parenthèses", async () => {
    await creerArticle(ALPHA, saisie(`${PREFIXE}_U1`, { designation: "Tube 1/2\", cuivre (écroui)" }), secretaire);
    await creerArticle(ALPHA, saisie(`${PREFIXE}XU1`), secretaire);
    const trouves = await chercherArticles(ALPHA, { ...CRITERES_DEFAUT, recherche: `${PREFIXE}_U` }, secretaire);
    expect(trouves.articles.map((a) => a.code)).toEqual([`${PREFIXE}_U1`]);
    const virgule = await chercherPourLigne(ALPHA, "1/2\", cuivre (écroui", secretaire);
    expect(virgule.map((a) => a.code)).toEqual([`${PREFIXE}_U1`]);
  });
});

describe("import par lots (ART-05, ART-22)", () => {
  const NB = LOT_IMPORT + 30;
  const codes = Array.from({ length: NB }, (_, i) => `${PREFIXE}-IMP-${String(i).padStart(4, "0")}`);

  it("crée, puis met à jour, en comptant lot par lot", async () => {
    const premier = await importerArticles(ALPHA, codes.map(importe), secretaire);
    expect(premier).toEqual({ crees: NB, misAJour: 0, echecs: [] });
    const second = await importerArticles(ALPHA, codes.map((c) => ({ ...importe(c), prix_unitaire: 2 })), secretaire);
    expect(second).toEqual({ crees: 0, misAJour: NB, echecs: [] });
    const lu = await articleParCode(ALPHA, codes[0] as string, secretaire);
    expect(lu).toMatchObject({ prix_unitaire: 2, tva: 10, unite: "m²", type_article: "bien", famille: "Essais import" });
  });

  it("un lot refusé n'arrête pas les autres, et ne compte ni en créés ni en mis à jour", async () => {
    const neufs = Array.from({ length: LOT_IMPORT + 5 }, (_, i) => importe(`${PREFIXE}-LOT-${String(i).padStart(4, "0")}`));
    // Un type que la contrainte CHECK refuse : tout le premier lot tombe (23514).
    neufs[3] = { ...(neufs[3] as ArticleImporte), type_article: "autre" as "bien" };
    const r = await importerArticles(ALPHA, neufs, secretaire);
    expect(r.crees).toBe(5);
    expect(r.echecs).toHaveLength(1);
    expect(r.echecs[0]?.codes).toHaveLength(LOT_IMPORT);
    expect(r.echecs[0]?.erreur).toMatchObject({ code: "23514" });
  });

  it("pagination serveur : 25 par page, total exact, une page disparue recule à la dernière", async () => {
    const criteres = { ...CRITERES_DEFAUT, recherche: `${PREFIXE}-IMP-` };
    const p2 = await chercherArticles(ALPHA, { ...criteres, page: 2 }, secretaire);
    expect(p2).toMatchObject({ total: NB, page: 2, pages: Math.ceil(NB / 25) });
    expect(p2.articles.map((a) => a.code)).toEqual(codes.slice(25, 50));
    const trop = await chercherArticles(ALPHA, { ...criteres, page: 99 }, secretaire);
    expect(trop.page).toBe(Math.ceil(NB / 25));
    expect(trop.articles.at(-1)?.code).toBe(codes.at(-1));
    expect(await listerFamilles(ALPHA, secretaire)).toContain("Essais import");
  });
});
