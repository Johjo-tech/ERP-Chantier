/**
 * L'équipe d'une tâche, vue depuis trois rôles différents.
 *
 * Toutes les autres suites tournent sous un compte unique et administrateur :
 * elles prouvent que le chemin nominal marche, jamais qu'un autre est fermé.
 * Aucune garde de rôle n'avait donc jamais été éprouvée.
 *
 * Ici on ouvre trois sessions distinctes — deux techniciens et un conducteur —
 * et on vérifie la règle telle qu'elle a été posée : une tâche est confiée à
 * une équipe, n'importe lequel de ses membres suffit à la déclarer faite, un
 * technicien étranger à l'équipe est refusé, et une tâche sans équipe ne se
 * clôt que par l'encadrement.
 *
 * Les comptes viennent de `supabase/seed-tests.sql`, rejoué à chaque
 * `supabase db reset`. La suite ne tourne donc que sur la base locale.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import * as queries from "@/api/queries";
import { supabase } from "@/api/client";
import type { Uuid } from "@/api/types";
import { AUTH_DISPONIBLE, TEST_SOCIETE_CODE } from "./setup";

const URL = import.meta.env.VITE_SUPABASE_URL as string;
const CLE = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

/** Les comptes de rôle n'existent que dans le conteneur local. */
const EN_LOCAL = /127\.0\.0\.1|localhost/.test(URL ?? "");
const suite = AUTH_DISPONIBLE && EN_LOCAL ? describe : describe.skip;

const MOT_DE_PASSE = "motdepasse-test";
const TECH_A = "11111111-1111-1111-1111-111111111111" as Uuid;
const TECH_B = "44444444-4444-4444-4444-444444444444" as Uuid;
/** L'équipe et ses salariés viennent de `supabase/seed-tests.sql`. */
const EQUIPE = "66666666-6666-6666-6666-666666666666" as Uuid;
const SALARIE_B = "88888888-8888-8888-8888-888888888888" as Uuid;

/** Une session à part : le client partagé porte celle de l'administrateur. */
async function ouvrirSession(email: string): Promise<SupabaseClient> {
  const client = createClient(URL, CLE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await client.auth.signInWithPassword({
    email,
    password: MOT_DE_PASSE,
  });
  if (error) throw new Error(`Connexion ${email} impossible : ${error.message}`);
  return client;
}

/** Le motif du refus, que `SupabaseError` range dans `details`. */
function motif(erreur: unknown): string {
  const e = erreur as { message?: string; details?: string; hint?: string };
  return [e?.message, e?.details, e?.hint].filter(Boolean).join(" ");
}

suite("Équipe d'une tâche", () => {
  let societeId: Uuid;
  let avecEquipe: Uuid;
  let sansEquipe: Uuid;
  let clientA: SupabaseClient;
  let clientB: SupabaseClient;
  let clientConducteur: SupabaseClient;

  beforeAll(async () => {
    const societe = await queries.getSocieteByCode(TEST_SOCIETE_CODE);
    if (!societe) throw new Error(`Société « ${TEST_SOCIETE_CODE} » introuvable`);
    societeId = societe.id;

    const aujourdhui = new Date().toISOString().slice(0, 10);
    /* L'équipe s'affecte à la création de la tâche : c'est `technicien_id` qui
       la porte, pas une table de liaison. */
    const a = await queries.planifierTache(societeId, {
      libelle: "Tâche avec équipe",
      date_tache: aujourdhui,
      technicien_id: EQUIPE,
    });
    const b = await queries.planifierTache(societeId, {
      libelle: "Tâche sans équipe",
      date_tache: aujourdhui,
    });
    avecEquipe = a.id;
    sansEquipe = b.id;

    clientA = await ouvrirSession("tech.a@local");
    clientB = await ouvrirSession("tech.b@local");
    clientConducteur = await ouvrirSession("conducteur@local");
  });

  afterAll(async () => {
    await Promise.all([
      clientA?.auth.signOut(),
      clientB?.auth.signOut(),
      clientConducteur?.auth.signOut(),
    ]);
  });

  it("porte les membres de l'équipe affectée", async () => {
    const equipe = await queries.listEquipeTache(avecEquipe);
    expect(equipe.map((m) => m.profileId)).toContain(TECH_A);
  });

  /* Un salarié sans compte fait partie de l'équipe et n'y casse rien : il ne
     peut simplement pas pointer lui-même. C'est le cas de la moitié d'un
     chantier, et il ne doit pas faire échouer la résolution. */
  it("accepte un membre sans compte", async () => {
    const equipe = await queries.listMembresEquipe(EQUIPE);
    expect(equipe.some((m) => m.profileId === null)).toBe(true);
    expect(equipe.length).toBeGreaterThan(1);
  });

  it("laisse un membre de l'équipe déclarer les travaux faits", async () => {
    const { error } = await clientA.rpc("tache_marquer_realisee", {
      p_tache_id: avecEquipe,
    });
    expect(error).toBeNull();

    const tache = await queries.getTache(avecEquipe);
    expect(tache?.statut).toBe("realisee");
    expect(tache?.realisee_par).toBe(TECH_A);
  });

  it("refuse un technicien étranger à l'équipe", async () => {
    const { error } = await clientB.rpc("tache_marquer_realisee", {
      p_tache_id: avecEquipe,
    });
    expect(error).not.toBeNull();
    expect(motif(error)).toMatch(/autre équipe/i);
  });

  it("refuse le terrain sur une tâche sans équipe", async () => {
    const { error } = await clientA.rpc("tache_marquer_realisee", {
      p_tache_id: sansEquipe,
    });
    expect(error).not.toBeNull();
    expect(motif(error)).toMatch(/aucune équipe/i);
  });

  it("laisse le conducteur clore une tâche sans équipe", async () => {
    const { error } = await clientConducteur.rpc("tache_marquer_realisee", {
      p_tache_id: sansEquipe,
    });
    expect(error).toBeNull();

    const tache = await queries.getTache(sansEquipe);
    expect(tache?.statut).toBe("realisee");
  });

  it("refuse au technicien d'arbitrer, fût-ce sa propre tâche", async () => {
    const { error } = await clientA.rpc("tache_valider", {
      p_tache_id: avecEquipe,
      p_ok: true,
    });
    expect(error).not.toBeNull();
    expect(motif(error)).toMatch(/rôle insuffisant/i);
  });

  it("laisse le conducteur arbitrer", async () => {
    const { error } = await clientConducteur.rpc("tache_valider", {
      p_tache_id: avecEquipe,
      p_ok: true,
    });
    expect(error).toBeNull();

    const tache = await queries.getTache(avecEquipe);
    expect(tache?.statut).toBe("validee");
  });

  /* Composer les équipes est un geste RH, pas un geste de planning : le
     conducteur n'a le module RH qu'en lecture. La RLS ne lève alors aucune
     erreur, elle ne modifie aucune ligne — un refus silencieux qu'il vaut
     mieux tenir sous test que découvrir en production. */
  it("ne laisse pas le conducteur toucher aux salariés", async () => {
    const { error } = await clientConducteur
      .from("salaries")
      .update({ technicien_id: EQUIPE })
      .eq("id", SALARIE_B);
    expect(error).toBeNull();

    const equipe = await queries.listMembresEquipe(EQUIPE);
    expect(equipe.map((m) => m.profileId)).not.toContain(TECH_B);
  });

  it("laisse le RH composer l'équipe", async () => {
    await queries.affecterSalarieAEquipe(SALARIE_B, EQUIPE);
    expect((await queries.listMembresEquipe(EQUIPE)).map((m) => m.profileId)).toContain(
      TECH_B
    );

    // Remis en l'état : les autres cas reposent sur B hors de l'équipe.
    await queries.affecterSalarieAEquipe(SALARIE_B, null);
    expect(
      (await queries.listMembresEquipe(EQUIPE)).map((m) => m.profileId)
    ).not.toContain(TECH_B);
  });

  it("garde la trace de chaque transition", async () => {
    const { data } = await supabase
      .from("workflow_journal")
      .select("ancien_statut, nouveau_statut, auteur_id")
      .eq("entite", "planning_tache")
      .eq("entite_id", avecEquipe)
      .order("cree_le");

    expect(data?.map((l) => l.nouveau_statut)).toEqual(["realisee", "validee"]);
    expect(data?.[0]?.auteur_id).toBe(TECH_A);
  });
});
