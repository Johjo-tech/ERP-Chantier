/**
 * Facturer un bon de commande sans passer par le planning.
 *
 * Certaines affaires n'ont pas de terrain à pointer : pas de tâche, pas
 * d'arbitrage du conducteur, mais un bon à chiffrer et à envoyer en
 * facturation. Le circuit le refusait des deux côtés.
 *
 * Le contournement existait pourtant déjà, muet : `bc_chiffrage_valide` ne
 * lisait JAMAIS le statut de départ avant d'écrire « chiffré », et journalisait
 * un `ancien_statut` écrit en dur. Un bon facturé sans terrain était donc
 * indiscernable d'un bon passé par toutes les étapes.
 *
 * Ces tests éprouvent les deux moitiés de la correction, qui ne valent que
 * ensemble :
 *
 *   — la porte accidentelle est fermée (`bc_chiffrage_valide` exige désormais
 *     « prêt à chiffrer ») ;
 *   — une porte nommée l'a remplacée, et elle laisse une trace lisible.
 *
 * Ils écrivent vraiment, contre la base locale (voir docs/TESTING.md).
 */

import { describe, it, expect, beforeAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import * as queries from "@/api/queries";
import { supabase } from "@/api/client";
import type { Uuid } from "@/api/types";
import { AUTH_DISPONIBLE, TEST_SOCIETE_CODE } from "./setup";

const suite = AUTH_DISPONIBLE ? describe : describe.skip;

const URL = import.meta.env.VITE_SUPABASE_URL as string;
const CLE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

/** Les comptes de rôle viennent de `supabase/seed-tests.sql` — local seulement. */
const MOT_DE_PASSE = "motdepasse-test";

/** Une session à part : le client partagé porte celle de l'administrateur. */
async function ouvrirSession(email: string): Promise<SupabaseClient> {
  const client = createClient(URL, CLE_ANON, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await client.auth.signInWithPassword({
    email,
    password: MOT_DE_PASSE,
  });
  if (error) throw new Error(`Connexion ${email} impossible : ${error.message}`);
  return client;
}

/** Le motif tel que l'écran le montrera : Postgres le range dans `details`. */
async function motifDuRefus(promesse: Promise<unknown>): Promise<string> {
  try {
    await promesse;
    return "";
  } catch (err) {
    const e = err as { message?: string; details?: unknown };
    const d = e.details as
      | { message?: string; details?: string; hint?: string }
      | undefined;
    return [e.message, d?.message, d?.details, d?.hint].filter(Boolean).join(" ");
  }
}

suite("Pré-facture validée hors circuit", () => {
  const aujourdhui = new Date().toISOString().slice(0, 10);
  let societeId: Uuid;

  beforeAll(async () => {
    const societe = await queries.getSocieteByCode(TEST_SOCIETE_CODE);
    if (!societe) throw new Error(`Société « ${TEST_SOCIETE_CODE} » introuvable`);
    societeId = societe.id;
  });

  /** Une affaire sans terrain : chiffrée, mais qu'aucune tâche n'atteste. */
  async function bonSansTache() {
    const bc = await queries.createBonCommande(
      societeId,
      { client_nom: "CLIENT DE TEST", date: aujourdhui },
      [
        {
          type: "ligne",
          designation: "Dépannage sans passage planifié",
          quantite: 1,
          unite: "u",
          prix_unitaire: 240,
        },
      ]
    );
    return bc.id as Uuid;
  }

  function statutDe(bcId: Uuid) {
    return queries
      .getBonCommande(bcId)
      .then((bc) => bc?.statut_workflow ?? "en_cours");
  }

  it("naît « en cours », sans aucune tâche", async () => {
    const bcId = await bonSansTache();
    expect(await statutDe(bcId)).toBe("en_cours");
    expect(await queries.listTachesBonCommande(bcId)).toHaveLength(0);
  });

  it("est refusé par le circuit, et le motif nomme le planning", async () => {
    const bcId = await bonSansTache();
    const motif = await motifDuRefus(queries.validerChiffrage(bcId));

    expect(motif).toMatch(/tâche/i);
    expect(await statutDe(bcId)).toBe("en_cours");
  });

  /* LA porte dérobée. Avant cette migration, cet appel PASSAIT : il écrivait
     « chiffré » depuis n'importe quel statut, et journalisait « prêt à chiffrer
     → chiffré » quoi qu'il arrive. */
  it("est désormais refusé aussi par la fonction nominale appelée en direct", async () => {
    const bcId = await bonSansTache();
    const { error } = await supabase.rpc("bc_chiffrage_valide", {
      p_bc_id: bcId,
    });

    expect(error).not.toBeNull();
    expect(`${error?.message} ${error?.details ?? ""}`).toMatch(
      /transition interdite/i
    );
    expect(await statutDe(bcId)).toBe("en_cours");
  });

  it("atteint « chiffré » par la porte nommée", async () => {
    const bcId = await bonSansTache();
    await queries.validerChiffrageHorsCircuit(bcId);

    expect(await statutDe(bcId)).toBe("chiffre");
  });

  /* Sans colonne nouvelle : le chemin nominal passe forcément par « prêt à
     chiffrer », donc un `en_cours → chiffre` au journal EST la marque du
     contournement. C'est tout ce qui distingue les deux gestes après coup. */
  it("laisse au journal la transition réelle, et non celle du circuit", async () => {
    const bcId = await bonSansTache();
    await queries.validerChiffrageHorsCircuit(bcId);

    const { data } = await supabase
      .from("workflow_journal")
      .select("ancien_statut, nouveau_statut")
      .eq("entite", "bon_commande")
      .eq("entite_id", bcId)
      .eq("nouveau_statut", "chiffre");

    expect(data).toHaveLength(1);
    expect(data?.[0].ancien_statut).toBe("en_cours");
  });

  it("ne rejoue pas un bon déjà chiffré", async () => {
    const bcId = await bonSansTache();
    await queries.validerChiffrageHorsCircuit(bcId);

    // Le second appel ne doit ni échouer ni écrire une seconde ligne au journal
    await expect(queries.validerChiffrageHorsCircuit(bcId)).resolves.toBeUndefined();

    const { data } = await supabase
      .from("workflow_journal")
      .select("id")
      .eq("entite_id", bcId)
      .eq("nouveau_statut", "chiffre");
    expect(data).toHaveLength(1);
  });

  it("refuse de rouvrir le chiffrage d'un bon déjà chiffré, appelée en direct", async () => {
    const bcId = await bonSansTache();
    await queries.validerChiffrageHorsCircuit(bcId);

    const { error } = await supabase.rpc("bc_chiffrage_valide_hors_circuit", {
      p_bc_id: bcId,
    });
    expect(error).not.toBeNull();
    expect(`${error?.message} ${error?.details ?? ""}`).toMatch(/déjà/i);
  });

  /* La clé anon part dans le bundle : la porte doit être fermée à qui n'est pas
     authentifié, sans quoi « administrateur seul » ne veut rien dire. */
  it("est fermée à un appel anonyme", async () => {
    const bcId = await bonSansTache();
    const rep = await fetch(
      `${URL}/rest/v1/rpc/bc_chiffrage_valide_hors_circuit`,
      {
        method: "POST",
        headers: { apikey: CLE_ANON, "Content-Type": "application/json" },
        body: JSON.stringify({ p_bc_id: bcId }),
      }
    );

    expect(rep.status).toBeGreaterThanOrEqual(400);
    expect(await rep.text()).toMatch(/permission|denied|not exist|not find/i);
    expect(await statutDe(bcId)).toBe("en_cours");
  });

  /* « Administrateur seul » ne se prouve pas en refusant l'anonyme : il faut un
     compte AUTHENTIFIÉ et légitime, à qui la base doit dire non quand même.
     Les trois rôles ci-dessous existent en base locale et travaillent tous sur
     la même société que l'administrateur des autres tests. */
  describe.each([
    ["secretaire@local", "secrétaire"],
    ["conducteur@local", "conducteur"],
    ["tech.a@local", "technicien"],
  ])("Un compte %s", (email, intitule) => {
    it(`est refusé : le ${intitule} ne décide pas de sauter le terrain`, async () => {
      const bcId = await bonSansTache();
      const client = await ouvrirSession(email);

      const { error } = await client.rpc("bc_chiffrage_valide_hors_circuit", {
        p_bc_id: bcId,
      });

      expect(error).not.toBeNull();
      /* Le 42501 de Postgres, et non un refus de RLS sur la lecture : c'est la
         garde de rôle DANS la fonction qu'on veut voir se déclencher. */
      expect(error?.code).toBe("42501");
      expect(`${error?.message} ${error?.details ?? ""}`).toMatch(
        /administrateur/i
      );
      expect(await statutDe(bcId)).toBe("en_cours");
    });
  });

  /* L'écran fait remonter le bon dans « À facturer » d'après `valideDirecteur`,
     lui-même dérivé de l'état. Les deux chemins doivent donc y aboutir
     pareillement — c'est bien « l'envoyer en facturation ». */
  it("rend le bon facturable, comme le ferait le circuit complet", async () => {
    const bcId = await bonSansTache();
    await queries.validerChiffrageHorsCircuit(bcId);

    const bc = await queries.getBonCommande(bcId);
    expect(bc?.statut_workflow === "chiffre" || bc?.statut_workflow === "facture").toBe(
      true
    );
  });
});
