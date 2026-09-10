/**
 * La numérotation des factures, éprouvée sur la base.
 *
 * L'article 242 nonies A de l'annexe II au CGI veut une série chronologique,
 * continue, sans trou ni doublon. Le front demandait jusqu'ici son numéro
 * **avant** d'enregistrer : une saisie abandonnée consommait une référence, et
 * la série se creusait. Le numéro est désormais attribué par la base, dans la
 * transaction de l'enregistrement.
 *
 * Ces cas éprouvent la règle telle qu'elle a été posée : un brouillon n'a pas
 * de numéro, l'émission en attribue un, un échec n'en consomme aucun, deux
 * émissions simultanées n'en partagent pas, et un numéro attribué ne bouge
 * plus — la facture non plus.
 */

import { describe, it, expect, beforeAll } from "vitest";
import * as queries from "@/api/queries";
import { supabase } from "@/api/client";
import type { Uuid } from "@/api/types";
import { AUTH_DISPONIBLE, TEST_SOCIETE_CODE } from "./setup";

const suite = AUTH_DISPONIBLE ? describe : describe.skip;

/** La valeur du compteur, pour vérifier ce qui a été consommé. */
async function compteurFacture(societeId: Uuid, annee: number): Promise<number> {
  const { data } = await supabase
    .from("compteurs")
    .select("valeur")
    .eq("societe_id", societeId)
    .eq("type", "facture")
    .eq("annee", annee)
    .maybeSingle();
  return (data?.valeur as number) ?? 0;
}

function sequence(numero: string): number {
  return Number(numero.slice(numero.lastIndexOf("-") + 1));
}

/** `SupabaseError` range le message de Postgres dans `details`, pas dans `message`. */
async function motifDuRefus(promesse: Promise<unknown>): Promise<string> {
  try {
    await promesse;
    return "";
  } catch (err) {
    const e = err as { message?: string; details?: unknown };
    const d = e.details as { message?: string; details?: string; hint?: string } | undefined;
    return [e.message, d?.message, d?.details, d?.hint].filter(Boolean).join(" ");
  }
}

suite("Numérotation des factures", () => {
  const NOM_CLIENT = "CLIENT DE TEST";
  const aujourdhui = new Date().toISOString().slice(0, 10);
  const annee = new Date().getFullYear();
  let societeId: Uuid;

  beforeAll(async () => {
    const societe = await queries.getSocieteByCode(TEST_SOCIETE_CODE);
    if (!societe) throw new Error(`Société « ${TEST_SOCIETE_CODE} » introuvable`);
    societeId = societe.id;
  });

  it("laisse un brouillon sans numéro", async () => {
    const avant = await compteurFacture(societeId, annee);

    const facture = await queries.createFacture(societeId, {
      client_nom: NOM_CLIENT,
      date: aujourdhui,
      statut: "brouillon",
    });

    expect(facture.numero).toBeNull();
    // Un brouillon ne consomme rien : c'est là tout l'intérêt du déplacement.
    expect(await compteurFacture(societeId, annee)).toBe(avant);
  });

  it("attribue le numéro à l'émission, et une seule fois", async () => {
    const brouillon = await queries.createFacture(societeId, {
      client_nom: NOM_CLIENT,
      date: aujourdhui,
      statut: "brouillon",
    });
    const avant = await compteurFacture(societeId, annee);

    const emise = await queries.emettreFacture(brouillon.id);
    expect(emise.numero).toMatch(/^FAC-\d{4}-\d{4}$/);
    expect(sequence(emise.numero!)).toBe(avant + 1);

    // Réémettre est refusé : la référence est déjà partie chez le client.
    await expect(queries.emettreFacture(brouillon.id)).rejects.toThrow(/déjà émise/);
  });

  it("numérote une facture créée directement émise", async () => {
    const facture = await queries.createFacture(societeId, {
      client_nom: NOM_CLIENT,
      date: aujourdhui,
      statut: "impayée",
    });
    expect(facture.numero).toMatch(/^FAC-\d{4}-\d{4}$/);
  });

  /* Le cas qui motive tout le reste : jusqu'ici le numéro était pris avant
     l'enregistrement, donc un refus de la base le laissait consommé. */
  it("ne consomme aucun numéro quand l'enregistrement échoue", async () => {
    const avant = await compteurFacture(societeId, annee);

    await expect(
      queries.createFacture(societeId, {
        client_nom: NOM_CLIENT,
        date: aujourdhui,
        statut: "impayée",
        // Une société qui n'est pas la nôtre : la RLS refuse la ligne entière.
        client_id: "00000000-0000-0000-0000-000000000000" as Uuid,
      })
    ).rejects.toThrow();

    expect(await compteurFacture(societeId, annee)).toBe(avant);
  });

  it("ne donne pas deux fois le même numéro à deux émissions simultanées", async () => {
    const brouillons = await Promise.all(
      Array.from({ length: 8 }, () =>
        queries.createFacture(societeId, {
          client_nom: NOM_CLIENT,
          date: aujourdhui,
          statut: "brouillon",
        })
      )
    );

    const emises = await Promise.all(
      brouillons.map((b) => queries.emettreFacture(b.id))
    );
    const numeros = emises.map((f) => f.numero!);

    expect(new Set(numeros).size).toBe(numeros.length);

    /* Et aucun de ces numéros n'était déjà pris. On ne peut pas exiger huit
       rangs contigus : d'autres suites émettent en même temps sur la même
       base, et leurs numéros s'intercalent légitimement. L'unicité, elle, doit
       tenir quoi qu'il arrive — c'est elle que la loi impose. */
    const { data } = await supabase
      .from("factures")
      .select("numero")
      .eq("societe_id", societeId)
      .in("numero", numeros);
    expect(data).toHaveLength(numeros.length);
  });

  describe("Un numéro attribué est définitif", () => {
    let numerotee: Uuid;
    let numero: string;

    beforeAll(async () => {
      const f = await queries.createFacture(societeId, {
        client_nom: NOM_CLIENT,
        date: aujourdhui,
        statut: "impayée",
      });
      numerotee = f.id;
      numero = f.numero!;
    });

    it("refuse de le réécrire", async () => {
      const motif = await motifDuRefus(
        queries.updateFacture(numerotee, { numero: "FAC-2026-9999" })
      );
      expect(motif).toMatch(/définitif/i);
      expect(motif).toMatch(/avoir/i);

      expect((await queries.getFacture(numerotee))?.numero).toBe(numero);
    });

    it("refuse de l'effacer", async () => {
      const motif = await motifDuRefus(queries.updateFacture(numerotee, { numero: null }));
      expect(motif).toMatch(/définitif/i);
    });

    it("refuse la suppression de la facture", async () => {
      expect(await motifDuRefus(queries.deleteFacture(numerotee))).toMatch(/avoir/i);
      expect(await queries.getFacture(numerotee)).not.toBeNull();
    });

    /* Corriger le reste — adresse, échéance, statut — doit rester possible :
       seul le numéro est figé. */
    it("laisse corriger le reste de la facture", async () => {
      const maj = await queries.updateFacture(numerotee, { statut: "payée" });
      expect(maj.statut).toBe("payée");
      expect(maj.numero).toBe(numero);
    });

    it("laisse supprimer un brouillon", async () => {
      const brouillon = await queries.createFacture(societeId, {
        client_nom: NOM_CLIENT,
        date: aujourdhui,
        statut: "brouillon",
      });
      await expect(queries.deleteFacture(brouillon.id)).resolves.not.toThrow();
      expect(await queries.getFacture(brouillon.id)).toBeNull();
    });
  });

  describe("La numérotation comptable quitte l'API", () => {
    it("refuse une demande de numéro de facture", async () => {
      const { error } = await supabase.rpc("prochain_numero", {
        p_annee: annee,
        p_societe: societeId,
        p_type: "facture",
      });
      expect(error).not.toBeNull();
      expect(`${error?.message} ${error?.details}`).toMatch(/émission/i);
    });

    it("refuse aussi pour un avoir", async () => {
      const { error } = await supabase.rpc("prochain_numero", {
        p_annee: annee,
        p_societe: societeId,
        p_type: "avoir",
      });
      expect(error).not.toBeNull();
    });

    /* Devis, SAV et interventions gardent l'accès : leur numéro n'engage rien
       et se demande légitimement avant l'enregistrement. */
    it("laisse passer les devis", async () => {
      const { data, error } = await supabase.rpc("prochain_numero", {
        p_annee: annee,
        p_societe: societeId,
        p_type: "devis",
      });
      expect(error).toBeNull();
      expect(data).toMatch(/^DEV-\d{4}-\d{4}$/);
    });

    it("ne laisse pas atteindre le compteur interne", async () => {
      /* La fonction n'a aucun EXECUTE accordé : PostgREST ne l'expose pas,
         et le type généré ne la connaît donc pas non plus. */
      const { error } = await (supabase.rpc as unknown as (
        n: string,
        a: Record<string, unknown>
      ) => Promise<{ error: unknown }>)("numero_suivant_interne", {
        p_societe: societeId,
        p_type: "facture",
        p_annee: annee,
      });
      expect(error).not.toBeNull();
    });
  });
});
