/**
 * À qui appartient le catalogue d'articles.
 *
 * Il empruntait les droits des autres : la **lecture** exigeait la permission
 * « devis », l'**écriture** passait par `peut_ecrire` — admin, conducteur ou
 * technicien. D'où deux situations absurdes, tenues ici en échec :
 *
 *   * un technicien pouvait écrire un catalogue qu'il ne pouvait pas lire ;
 *   * une secrétaire, dont c'est l'outil quotidien, ne pouvait pas l'écrire.
 *
 * Le module `articles` de la matrice tranche : consultation pour qui chiffre,
 * écriture pour l'administration.
 *
 * Les comptes viennent de `supabase/seed-tests.sql` : base locale uniquement.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import * as queries from "@/api/queries";
import type { Uuid } from "@/api/types";
import { AUTH_DISPONIBLE, TEST_SOCIETE_CODE } from "./setup";

const URL = import.meta.env.VITE_SUPABASE_URL as string;
const CLE = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
const EN_LOCAL = /127\.0\.0\.1|localhost/.test(URL ?? "");
const suite = AUTH_DISPONIBLE && EN_LOCAL ? describe : describe.skip;

async function session(email: string): Promise<SupabaseClient> {
  const client = createClient(URL, CLE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await client.auth.signInWithPassword({
    email,
    password: "motdepasse-test",
  });
  if (error) throw new Error(`Connexion ${email} impossible : ${error.message}`);
  return client;
}

suite("Droits du catalogue d'articles", () => {
  let societeId: Uuid;
  let technicien: SupabaseClient;
  let conducteur: SupabaseClient;
  let secretaire: SupabaseClient;
  let articleId: Uuid;

  beforeAll(async () => {
    const societe = await queries.getSocieteByCode(TEST_SOCIETE_CODE);
    if (!societe) throw new Error("Société de test introuvable");
    societeId = societe.id;

    [technicien, conducteur, secretaire] = await Promise.all([
      session("tech.a@local"),
      session("conducteur@local"),
      session("secretaire@local"),
    ]);

    // Posé par l'administrateur de la suite : les rôles le liront ou non.
    const article = await queries.createArticle(societeId, {
      code: "CAT-DROITS-1",
      designation: "Article témoin",
      prix_unitaire: 100,
      tva: 10,
    });
    articleId = article.id;
  });

  afterAll(async () => {
    if (articleId) await queries.deleteArticle(articleId).catch(() => {});
    await Promise.all(
      [technicien, conducteur, secretaire].map((c) => c?.auth.signOut())
    );
  });

  it("laisse la secrétaire lire le catalogue", async () => {
    const { data, error } = await secretaire
      .from("articles")
      .select("code")
      .eq("id", articleId)
      .maybeSingle();
    expect(error).toBeNull();
    expect(data?.code).toBe("CAT-DROITS-1");
  });

  /* Le geste qui lui était refusé : elle chiffre, elle doit pouvoir poser une
     référence manquante sans passer par un administrateur. */
  it("laisse la secrétaire créer un article", async () => {
    const { data, error } = await secretaire
      .from("articles")
      .insert({
        societe_id: societeId,
        code: "CAT-DROITS-SECRETAIRE",
        designation: "Créé par la secrétaire",
        prix_unitaire: 50,
        tva: 20,
      })
      .select("id")
      .single();

    expect(error).toBeNull();
    if (data) await queries.deleteArticle(data.id as Uuid).catch(() => {});
  });

  it("laisse le conducteur consulter le catalogue", async () => {
    const { data, error } = await conducteur
      .from("articles")
      .select("code")
      .eq("id", articleId)
      .maybeSingle();
    expect(error).toBeNull();
    expect(data?.code).toBe("CAT-DROITS-1");
  });

  /* Il chiffre un devis à partir du catalogue ; il ne décide pas de ce qui y
     figure. */
  it("refuse au conducteur d'y ajouter une référence", async () => {
    const { error } = await conducteur.from("articles").insert({
      societe_id: societeId,
      code: "CAT-DROITS-CONDUCTEUR",
      designation: "Ne doit pas exister",
      prix_unitaire: 10,
      tva: 10,
    });
    expect(error).not.toBeNull();
  });

  it("ne montre rien du catalogue au technicien", async () => {
    const { data, error } = await technicien
      .from("articles")
      .select("code")
      .eq("id", articleId)
      .maybeSingle();
    // La RLS ne refuse pas : elle ne rend aucune ligne.
    expect(error).toBeNull();
    expect(data).toBeNull();
  });

  /* Le défaut corrigé : il écrivait ce qu'il ne pouvait pas lire. */
  it("refuse au technicien d'écrire dans le catalogue", async () => {
    const { error } = await technicien.from("articles").insert({
      societe_id: societeId,
      code: "CAT-DROITS-TECHNICIEN",
      designation: "Ne doit pas exister",
      prix_unitaire: 10,
      tva: 10,
    });
    expect(error).not.toBeNull();
  });

  /* Une écriture que la RLS écarte ne lève pas d'erreur : elle ne touche
     aucune ligne. C'est donc le résultat qu'on vérifie, pas le refus — et
     c'est le seul qui compte, puisque c'est le prix qui engage. */
  it("laisse le prix intact quand le technicien tente de le modifier", async () => {
    const { data } = await technicien
      .from("articles")
      .update({ prix_unitaire: 1 })
      .eq("id", articleId)
      .select("id");

    expect(data ?? [], "aucune ligne ne doit être touchée").toEqual([]);

    const article = await queries.getArticle(articleId);
    expect(Number(article?.prix_unitaire)).toBe(100);
  });
});

suite("Un code d'article est unique dans sa société", () => {
  let societeId: Uuid;
  let premier: Uuid;

  beforeAll(async () => {
    const societe = await queries.getSocieteByCode(TEST_SOCIETE_CODE);
    societeId = societe!.id;
    premier = (
      await queries.createArticle(societeId, {
        code: "CAT-UNIQUE",
        designation: "Premier",
        prix_unitaire: 10,
        tva: 10,
      })
    ).id;
  });

  afterAll(async () => {
    if (premier) await queries.deleteArticle(premier).catch(() => {});
  });

  /* Le code est la clé de l'import et du remplissage automatique : deux
     articles homonymes rendraient le remplissage indéterminé. */
  it("refuse un second article portant le même code", async () => {
    await expect(
      queries.createArticle(societeId, {
        code: "CAT-UNIQUE",
        designation: "Doublon",
        prix_unitaire: 20,
        tva: 10,
      })
    ).rejects.toThrow();
  });

  it("refuse un article sans code", async () => {
    await expect(
      queries.createArticle(societeId, {
        designation: "Sans code",
        prix_unitaire: 20,
        tva: 10,
      } as never)
    ).rejects.toThrow();
  });
});
