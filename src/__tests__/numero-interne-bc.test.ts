/**
 * Le numéro interne des bons de commande.
 *
 * Le champ était lu par l'écran — en-tête du PDF, bandeau de validation
 * directeur — mais plus rien ne l'écrivait : 38 bons sur 826 en portaient un,
 * tous créés par la version précédente de l'application. Le compteur, lui,
 * avait continué d'avancer, consommant 34 numéros que nulle ligne ne porte.
 *
 * Il est désormais attribué par la base, à la création, dans la même
 * transaction — donc jamais consommé pour rien.
 */

import { describe, it, expect, beforeAll } from "vitest";
import * as queries from "@/api/queries";
import { supabase } from "@/api/client";
import { correspond } from "@/integrations/recherche";
import type { Uuid } from "@/api/types";
import { AUTH_DISPONIBLE, TEST_SOCIETE_CODE } from "./setup";

const suite = AUTH_DISPONIBLE ? describe : describe.skip;

async function compteurBC(societeId: Uuid, annee: number): Promise<number> {
  const { data } = await supabase
    .from("compteurs")
    .select("valeur")
    .eq("societe_id", societeId)
    .eq("type", "bon_commande")
    .eq("annee", annee)
    .maybeSingle();
  return (data?.valeur as number) ?? 0;
}

suite("Numéro interne des bons de commande", () => {
  const aujourdhui = new Date().toISOString().slice(0, 10);
  const annee = new Date().getFullYear();
  let societeId: Uuid;

  beforeAll(async () => {
    const societe = await queries.getSocieteByCode(TEST_SOCIETE_CODE);
    if (!societe) throw new Error(`Société « ${TEST_SOCIETE_CODE} » introuvable`);
    societeId = societe.id;
  });

  it("attribue un numéro à la création, pris sur le compteur", async () => {
    const avant = await compteurBC(societeId, annee);

    const bc = await queries.createBonCommande(societeId, {
      client_nom: "CLIENT DE TEST",
      date: aujourdhui,
    });

    expect(bc.numero_interne).toMatch(/^BC-\d{4}-\d{4}$/);
    /* Le rang exact n'est pas prévisible : d'autres suites créent des bons sur
       la même base et s'intercalent légitimement. Ce qui doit tenir, c'est que
       le numéro vient du compteur et l'a fait avancer. */
    expect(Number(bc.numero_interne!.slice(-4))).toBeGreaterThan(avant);
    expect(await compteurBC(societeId, annee)).toBeGreaterThanOrEqual(avant + 1);
  });

  it("respecte un numéro fourni", async () => {
    const impose = `BC-REPRISE-${Date.now()}`;
    const bc = await queries.createBonCommande(societeId, {
      client_nom: "CLIENT DE TEST",
      date: aujourdhui,
      numero_interne: impose,
    });
    expect(bc.numero_interne).toBe(impose);
  });

  it("ne le réécrit pas à la modification", async () => {
    const bc = await queries.createBonCommande(societeId, {
      client_nom: "CLIENT DE TEST",
      date: aujourdhui,
    });
    const maj = await queries.updateBonCommande(bc.id, { client_nom: "CLIENT DE TEST 2" });
    expect(maj.numero_interne).toBe(bc.numero_interne);
  });

  /* C'est ce que la reprise a corrigé : chaque bon en porte un, et deux bons
     n'en partagent jamais un. */
  it("ne donne jamais deux fois le même", async () => {
    const bcs = await Promise.all(
      Array.from({ length: 6 }, () =>
        queries.createBonCommande(societeId, {
          client_nom: "CLIENT DE TEST",
          date: aujourdhui,
        })
      )
    );
    const numeros = bcs.map((b) => b.numero_interne!);
    expect(new Set(numeros).size).toBe(numeros.length);
  });

  /* `createSAV` recopie l'en-tête du bon d'origine. Tant que le numéro interne
     restait vide partout, la copie passait inaperçue ; elle viole désormais
     l'index unique. Un SAV est un bon distinct : il a son propre numéro. */
  it("donne au SAV son propre numéro, pas celui de son bon d'origine", async () => {
    const origine = await queries.createBonCommande(societeId, {
      client_nom: "CLIENT DE TEST",
      numero_bc: "BC-CLIENT-SONDE",
      date: aujourdhui,
    });
    const sav = await queries.createSAV(societeId, origine.id, "Fuite persistante");

    expect(sav.numero_interne).toMatch(/^BC-\d{4}-\d{4}$/);
    expect(sav.numero_interne).not.toBe(origine.numero_interne);
  });

  it("laisse tous les bons de la société numérotés", async () => {
    const { count } = await supabase
      .from("bons_commande")
      .select("id", { count: "exact", head: true })
      .eq("societe_id", societeId)
      .is("numero_interne", null);
    expect(count).toBe(0);
  });

  /* Sans lui dans la liste des champs cherchés, impossible de retrouver un bon
     depuis le numéro imprimé sur le papier qu'on a en main. */
  it("se retrouve par la recherche", () => {
    const bon = { client: "ALPES ISERE", numeroBC: "2630203", numeroInterne: "BC-2026-0073" };
    expect(correspond(bon, "BC-2026-0073")).toBe(true);
    expect(correspond(bon, "0073")).toBe(true);
    expect(correspond(bon, "BC-2026-9999")).toBe(false);
  });
});
