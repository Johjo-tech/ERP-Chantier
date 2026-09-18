/**
 * L'émission d'une facture, éprouvée sur la base.
 *
 * `emettreFacture` existait depuis longtemps, testée et exposée sur `window` —
 * et **rien ne l'appelait** : ni bouton, ni sélecteur de statut. Une facture née
 * d'un devis, d'un rapport ou d'une situation de travaux restait donc en
 * brouillon SANS NUMÉRO. 46 en base locale au moment du constat, dont 13 hors
 * jeu d'essai, la plus ancienne du 31 juillet.
 *
 * Le seul déblocage qui restait était d'y saisir un règlement : le statut
 * basculait et la base numérotait — le numéro légal attribué par un
 * encaissement, hors de tout ordre chronologique. C'est précisément ce que la
 * numérotation en base interdit, au nom de l'article 242 nonies A de l'annexe II
 * au CGI.
 *
 * Ce qui suit éprouve le geste rétabli, et les deux refus qui l'encadrent.
 */

import { describe, it, expect, beforeAll } from "vitest";
import * as queries from "@/api/queries";
import type { Uuid } from "@/api/types";
import { AUTH_DISPONIBLE, TEST_SOCIETE_CODE } from "./setup";
import { LIGNES_MINIMALES } from "./facture-de-test";

const suite = AUTH_DISPONIBLE ? describe : describe.skip;

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

suite("Émettre une facture restée en brouillon", () => {
  const NOM_CLIENT = "CLIENT DE TEST";
  const aujourdhui = new Date().toISOString().slice(0, 10);
  let societeId: Uuid;

  beforeAll(async () => {
    const societe = await queries.getSocieteByCode(TEST_SOCIETE_CODE);
    if (!societe) throw new Error(`Société « ${TEST_SOCIETE_CODE} » introuvable`);
    societeId = societe.id;
  });

  /** Une facture comme en produisent les quatre chemins de l'écran : brouillon, sans numéro. */
  async function brouillon(lignes = LIGNES_MINIMALES) {
    return queries.createFacture(
      societeId,
      { client_nom: NOM_CLIENT, date: aujourdhui, statut: "brouillon" },
      lignes
    );
  }

  it("naît sans numéro, comme le veut le circuit", async () => {
    const f = await brouillon();
    expect(f.statut).toBe("brouillon");
    expect(f.numero ?? "").toBe("");
  });

  it("reçoit son numéro à l'émission, et lui seul le lui donne", async () => {
    const f = await brouillon();
    const emise = await queries.emettreFacture(f.id as Uuid);

    expect(emise.numero).toMatch(/^FAC-/);
    expect(emise.statut).toBe("impayée");
  });

  it("refuse d'être émise deux fois", async () => {
    const f = await brouillon();
    const emise = await queries.emettreFacture(f.id as Uuid);

    const motif = await motifDuRefus(queries.emettreFacture(f.id as Uuid));
    expect(motif).toContain(String(emise.numero));
  });

  it("refuse d'être numérotée sans ligne — la règle BG-25, posée en base", async () => {
    /* C'est le refus que l'écran doit SAVOIR MONTRER : son message dit quoi
       faire, là où l'emballage `SupabaseError` ne dit que « Failed to update ». */
    const vide = await brouillon([]);
    const motif = await motifDuRefus(queries.emettreFacture(vide.id as Uuid));

    expect(motif).toMatch(/sans ligne/i);
    expect(motif).toMatch(/brouillon/i);
  });

  it("prend un numéro de la série des factures, dans l'ordre", async () => {
    const a = await queries.emettreFacture((await brouillon()).id as Uuid);
    const b = await queries.emettreFacture((await brouillon()).id as Uuid);

    const suite_ = (n: string | null) => Number(String(n).slice(String(n).lastIndexOf("-") + 1));
    expect(suite_(b.numero)).toBe(suite_(a.numero) + 1);
  });
});
