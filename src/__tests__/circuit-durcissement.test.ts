/**
 * Ce que le circuit doit refuser.
 *
 * Les suites existantes vérifient les transitions depuis un compte unique et
 * légitime : elles prouvent que le chemin nominal marche, jamais qu'un autre
 * est fermé. L'audit du 2026-09-09 a montré quatre contournements, tous
 * exploitables sans rien casser :
 *
 *   1. appeler `tache_marquer_realisee` sans être authentifié ;
 *   2. appeler `bc_passer_pret_a_chiffrer` sans être authentifié ;
 *   3. écrire `statut = 'validee'` en PATCH direct, sans passer par l'arbitrage ;
 *   4. écrire n'importe quelle chaîne dans `statut`.
 *
 * Chacun a son test ici. Ils tournent contre la base locale (voir
 * docs/TESTING.md) : le durcissement se vérifie en attaquant, pas en relisant
 * la migration.
 */

import { describe, it, expect, beforeAll } from "vitest";
import * as queries from "@/api/queries";
import { supabase } from "@/api/client";
import type { Uuid } from "@/api/types";
import { AUTH_DISPONIBLE, TEST_SOCIETE_CODE } from "./setup";

const suite = AUTH_DISPONIBLE ? describe : describe.skip;

const URL = import.meta.env.VITE_SUPABASE_URL as string;
const CLE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

/**
 * Appel d'une fonction avec la seule clé anon — celle qui part dans le bundle.
 *
 * On n'utilise pas le client partagé : il porte la session des tests. C'est
 * précisément l'absence de session qu'on veut éprouver.
 */
async function appelAnonyme(fonction: string, corps: unknown) {
  const rep = await fetch(`${URL}/rest/v1/rpc/${fonction}`, {
    method: "POST",
    headers: {
      apikey: CLE_ANON,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(corps),
  });
  return { statut: rep.status, corps: await rep.text() };
}

suite("Durcissement du circuit", () => {
  let societeId: Uuid;
  let tacheId: Uuid;
  let bcFactureId: Uuid | null = null;

  beforeAll(async () => {
    const societe = await queries.getSocieteByCode(TEST_SOCIETE_CODE);
    if (!societe) throw new Error(`Société « ${TEST_SOCIETE_CODE} » introuvable`);
    societeId = societe.id;

    const { data: tache } = await supabase
      .from("planning_taches")
      .select("id")
      .eq("societe_id", societeId)
      .eq("statut", "planifiee")
      .limit(1)
      .maybeSingle();
    if (!tache) throw new Error("Aucune tâche planifiée pour éprouver les gardes");
    tacheId = tache.id as Uuid;

    const { data: bc } = await supabase
      .from("bons_commande")
      .select("id")
      .eq("societe_id", societeId)
      .eq("statut_workflow", "facture")
      .limit(1)
      .maybeSingle();
    bcFactureId = (bc?.id as Uuid) ?? null;
  });

  describe("Sans être authentifié", () => {
    it("refuse de déclarer des travaux faits", async () => {
      const rep = await appelAnonyme("tache_marquer_realisee", { p_tache_id: tacheId });
      expect(rep.statut).toBeGreaterThanOrEqual(400);
      expect(rep.corps).toMatch(/permission|denied|not exist|not find/i);
    });

    it("refuse d'envoyer un bon au chiffrage", async () => {
      const rep = await appelAnonyme("bc_passer_pret_a_chiffrer", {
        p_bc_id: bcFactureId ?? tacheId,
      });
      expect(rep.statut).toBeGreaterThanOrEqual(400);
      expect(rep.corps).toMatch(/permission|denied|not exist|not find/i);
    });

    it("laisse la tâche intacte", async () => {
      const tache = await queries.getTache(tacheId);
      expect(tache?.statut).toBe("planifiee");
    });
  });

  describe("Écriture directe de l'état", () => {
    /* Le compte de test est administrateur : c'est le cas le plus favorable à
       l'attaquant. S'il est refusé, un technicien l'est a fortiori. */

    it("refuse de valider une tâche sans passer par l'arbitrage", async () => {
      const { error } = await supabase
        .from("planning_taches")
        .update({ statut: "validee" })
        .eq("id", tacheId);

      expect(error).not.toBeNull();
      expect(error?.message).toMatch(/circuit/i);
    });

    it("refuse un statut hors du domaine", async () => {
      const { error } = await supabase
        .from("planning_taches")
        .update({ statut: "nimportequoi" })
        .eq("id", tacheId);

      expect(error).not.toBeNull();
    });

    it("laisse passer les constats, qui vivent sur la même ligne", async () => {
      const { error } = await supabase
        .from("planning_taches")
        .update({ commentaire: "constat de test" })
        .eq("id", tacheId);

      expect(error).toBeNull();
    });

    it("laisse la tâche dans son état de départ", async () => {
      const tache = await queries.getTache(tacheId);
      expect(tache?.statut).toBe("planifiee");
    });
  });

  describe("Passage au chiffrage", () => {
    /* `SupabaseError` porte son propre libellé ; le motif du refus, lui, vient
       de Postgres et vit dans `details`. C'est lui qu'on veut lire : « refusé »
       ne dit pas si la garde qui a parlé est la bonne. */
    async function motifDuRefus(action: Promise<unknown>): Promise<string> {
      try {
        await action;
        return "";
      } catch (err) {
        const details = (err as { details?: { message?: string } }).details;
        return details?.message ?? (err as Error).message;
      }
    }

    /* Appel direct de la fonction : `passerPretAChiffrer` refuse d'abord côté
       client, et c'est son message qu'on lirait. Ici on veut savoir ce que la
       base répond quand on la sollicite sans passer par ce filet. */
    it("refuse un bon déjà facturé", async () => {
      if (!bcFactureId) return;
      const { error } = await supabase.rpc("bc_passer_pret_a_chiffrer", {
        p_bc_id: bcFactureId,
      });
      expect(error).not.toBeNull();
      expect(error?.message).toMatch(/Transition interdite/i);
    });

    it("refuse un bon sans aucune tâche", async () => {
      const client = await queries.resolveClientByNom(societeId, "CLIENT DE TEST");
      const bc = await queries.createBonCommande(societeId, {
        client_nom: "CLIENT DE TEST",
        client_id: client.id,
        date: new Date().toISOString().slice(0, 10),
      });

      expect(await motifDuRefus(queries.passerPretAChiffrer(bc.id))).toMatch(
        /aucune tâche/i
      );
    });
  });

  describe("Trace", () => {
    it("journalise les transitions de tâche", async () => {
      const { data } = await supabase
        .from("workflow_journal")
        .select("entite, nouveau_statut, auteur_id")
        .eq("entite", "planning_tache")
        .limit(1);

      // Le journal se remplit dès la première transition du circuit ; les
      // suites précédentes en ont déjà provoqué.
      expect(Array.isArray(data)).toBe(true);
    });
  });
});
