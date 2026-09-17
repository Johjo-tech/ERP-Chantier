/**
 * L'avoir, éprouvé sur la base — pas seulement sur la règle.
 *
 * `avoir.test.ts` couvre l'arithmétique et les refus, sans jamais parler à
 * Postgres. Ce qui suit exécute le chemin réel, celui que l'écran déclenche :
 * `createAvoir` → insertion en brouillon → lignes → émission → numéro de la
 * série « AV ». C'est le seul test qui voit les déclencheurs, la RLS et les
 * colonnes telles qu'elles sont.
 */

import { describe, it, expect, beforeAll } from "vitest";
import * as queries from "@/api/queries";
import { supabase } from "@/api/client";
import type { Uuid } from "@/api/types";
import { resteAImputer } from "@/api/regles-avoir";
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

suite("Établir un avoir", () => {
  const NOM_CLIENT = "CLIENT DE TEST";
  const aujourdhui = new Date().toISOString().slice(0, 10);
  let societeId: Uuid;

  beforeAll(async () => {
    const societe = await queries.getSocieteByCode(TEST_SOCIETE_CODE);
    if (!societe) throw new Error(`Société « ${TEST_SOCIETE_CODE} » introuvable`);
    societeId = societe.id;
  });

  /** Une facture réellement émise, dont l'avoir aura quelque chose à rectifier. */
  async function factureEmise() {
    return queries.createFacture(
      societeId,
      { client_nom: NOM_CLIENT, date: aujourdhui },
      LIGNES_MINIMALES
    );
  }

  it("rectifie une facture émise, dans sa propre série", async () => {
    const facture = await factureEmise();
    expect(facture.numero).toBeTruthy();

    const avoir = await queries.createAvoir(
      societeId,
      facture.id as Uuid,
      "Métré erroné sur le lot 2"
    );

    expect(avoir.type_document).toBe("avoir");
    expect(avoir.numero).toMatch(/^AV-/);
    expect(avoir.facture_rectifiee_id).toBe(facture.id);
    expect(avoir.motif_rectification).toBe("Métré erroné sur le lot 2");
  });

  it("reprend les lignes de la facture, montants POSITIFS", async () => {
    const facture = await factureEmise();
    const avoir = await queries.createAvoir(societeId, facture.id as Uuid, "Prestation non réalisée");

    const lignesFacture = await queries.listFactureLignes(facture.id as Uuid);
    const lignesAvoir = await queries.listFactureLignes(avoir.id as Uuid);

    expect(lignesAvoir).toHaveLength(lignesFacture.length);
    /* Le signe vit dans le type, pas dans les lignes : `chargeEN16931` signe
       déjà l'export, et des quantités négatives le feraient signer deux fois. */
    for (const l of lignesAvoir) {
      expect(Number(l.quantite)).toBeGreaterThan(0);
      expect(Number(l.prix_unitaire)).toBeGreaterThanOrEqual(0);
    }
  });

  it("ne consomme pas la série des factures", async () => {
    const facture = await factureEmise();
    const avoir = await queries.createAvoir(societeId, facture.id as Uuid, "Double facturation");

    expect(avoir.numero?.startsWith("AV-")).toBe(true);
    expect(avoir.numero?.startsWith("FAC-")).toBe(false);
  });

  it("laisse la facture rectifiée intacte", async () => {
    const facture = await factureEmise();
    await queries.createAvoir(societeId, facture.id as Uuid, "Remise oubliée");

    const relue = await queries.getFacture(facture.id as Uuid);
    expect(relue?.numero).toBe(facture.numero);
    expect(relue?.type_document).toBe("facture");
    expect(relue?.statut).toBe(facture.statut);
  });

  it("refuse un brouillon : il se corrige lui-même", async () => {
    const brouillon = await queries.createFacture(
      societeId,
      { client_nom: NOM_CLIENT, date: aujourdhui, statut: "brouillon" },
      LIGNES_MINIMALES
    );
    expect(brouillon.numero ?? "").toBe("");

    const motif = await motifDuRefus(
      queries.createAvoir(societeId, brouillon.id as Uuid, "Erreur de saisie manifeste")
    );
    expect(motif).toMatch(/pas émise/i);
  });

  it("refuse un avoir sur un avoir", async () => {
    const facture = await factureEmise();
    const avoir = await queries.createAvoir(societeId, facture.id as Uuid, "Annulation totale");

    const motif = await motifDuRefus(
      queries.createAvoir(societeId, avoir.id as Uuid, "Annulation de l'annulation")
    );
    expect(motif).toMatch(/refacturer/i);
  });

  it("refuse un motif qui ne justifie rien", async () => {
    const facture = await factureEmise();
    const motif = await motifDuRefus(queries.createAvoir(societeId, facture.id as Uuid, "  "));
    expect(motif).toMatch(/motif/i);
  });

  it("sort de la vue des totaux comme la facture qu'il rectifie", async () => {
    const facture = await factureEmise();
    const avoir = await queries.createAvoir(societeId, facture.id as Uuid, "Erreur de destinataire");

    const totFacture = await queries.getFactureTotaux(facture.id as Uuid);
    const totAvoir = await queries.getFactureTotaux(avoir.id as Uuid);

    /* La vue ignore `type_document` : elle rend le montant BRUT, positif. C'est
       `signeDocument` qui l'oriente à l'affichage et à l'export — si un jour la
       vue se met à signer, ce test tombe, et c'est exactement ce qu'on veut. */
    expect(Number(totAvoir?.ttc)).toBeCloseTo(Number(totFacture?.ttc), 2);
    expect(Number(totAvoir?.ttc)).toBeGreaterThan(0);
  });

  it("désigne la facture rectifiée dans la facture électronique", async () => {
    const facture = await factureEmise();
    const avoir = await queries.createAvoir(societeId, facture.id as Uuid, "Prestation annulée");

    const { preparerEmission } = await import("@/api/operations/efacture");
    const { charge } = await preparerEmission(avoir.id as Uuid);

    expect(charge.en_invoice.type_code).toBe(381);
    expect(charge.en_invoice.preceding_invoice_references?.[0]?.preceding_invoice_reference).toBe(
      facture.numero
    );
    for (const ligne of charge.en_invoice.lines) {
      expect(Number(ligne.net_amount)).toBeLessThan(0);
    }
  });

  it("n'est pas visible par une société voisine", async () => {
    const facture = await factureEmise();
    const avoir = await queries.createAvoir(societeId, facture.id as Uuid, "Contrôle de cloisonnement");

    const { data } = await supabase
      .from("factures")
      .select("id")
      .eq("id", avoir.id)
      .neq("societe_id", societeId);
    expect(data ?? []).toHaveLength(0);
  });
});

suite("Imputer un avoir sur une facture", () => {
  const NOM_CLIENT = "CLIENT DE TEST";
  const aujourdhui = new Date().toISOString().slice(0, 10);
  let societeId: Uuid;

  beforeAll(async () => {
    const societe = await queries.getSocieteByCode(TEST_SOCIETE_CODE);
    if (!societe) throw new Error(`Société « ${TEST_SOCIETE_CODE} » introuvable`);
    societeId = societe.id;
  });

  async function factureEmise(client = NOM_CLIENT) {
    return queries.createFacture(
      societeId,
      { client_nom: client, date: aujourdhui },
      LIGNES_MINIMALES
    );
  }

  /** Le couple facture + avoir de même montant, prêt à s'annuler. */
  async function couple() {
    const facture = await factureEmise();
    const avoir = await queries.createAvoir(societeId, facture.id as Uuid, "Prestation non réalisée");
    const totaux = await queries.getFactureTotaux(facture.id as Uuid);
    return { facture, avoir, ttc: Number(totaux?.ttc ?? 0) };
  }

  it("écrit les deux côtés de l'écriture", async () => {
    const { facture, avoir, ttc } = await couple();

    const ecrits = await queries.imputerAvoir(
      societeId,
      avoir.id as Uuid,
      facture.id as Uuid,
      ttc
    );

    expect(ecrits).toHaveLength(2);
    const surFacture = ecrits.find((r) => r.facture_id === facture.id);
    const surAvoir = ecrits.find((r) => r.facture_id === avoir.id);

    expect(surFacture?.mode).toBe("avoir");
    expect(surFacture?.reference).toBe(avoir.numero);
    expect(surAvoir?.mode).toBe("imputation");
    expect(surAvoir?.reference).toBe(facture.numero);
    /* Positifs des deux côtés : `reglements.montant` porte un CHECK (> 0). */
    expect(Number(surFacture?.montant)).toBeGreaterThan(0);
    expect(Number(surAvoir?.montant)).toBeGreaterThan(0);
  });

  it("solde la facture et consomme l'avoir", async () => {
    const { facture, avoir, ttc } = await couple();
    await queries.imputerAvoir(societeId, avoir.id as Uuid, facture.id as Uuid, ttc);

    const solde = await queries.getFactureSolde(facture.id as Uuid);
    expect(Number(solde?.reste ?? 0)).toBeCloseTo(0, 2);

    const reglementsAvoir = await queries.listReglementsFacture(avoir.id as Uuid);
    const totauxAvoir = await queries.getFactureTotaux(avoir.id as Uuid);
    expect(resteAImputer(totauxAvoir?.ttc, reglementsAvoir)).toBe(0);
  });

  it("n'impute pas deux fois le même crédit", async () => {
    const { facture, avoir, ttc } = await couple();
    await queries.imputerAvoir(societeId, avoir.id as Uuid, facture.id as Uuid, ttc);

    const autre = await factureEmise();
    const motif = await motifDuRefus(
      queries.imputerAvoir(societeId, avoir.id as Uuid, autre.id as Uuid, ttc)
    );
    expect(motif).toMatch(/déjà entièrement imputé/i);
  });

  it("laisse le surplus disponible sur une imputation partielle", async () => {
    const { facture, avoir, ttc } = await couple();
    const moitie = Math.round((ttc / 2) * 100) / 100;

    await queries.imputerAvoir(societeId, avoir.id as Uuid, facture.id as Uuid, moitie);

    const totauxAvoir = await queries.getFactureTotaux(avoir.id as Uuid);
    const reste = resteAImputer(totauxAvoir?.ttc, await queries.listReglementsFacture(avoir.id as Uuid));
    expect(reste).toBeCloseTo(ttc - moitie, 2);

    const solde = await queries.getFactureSolde(facture.id as Uuid);
    expect(Number(solde?.reste ?? 0)).toBeCloseTo(ttc - moitie, 2);
  });

  it("refuse d'éteindre la créance d'un autre client", async () => {
    const { avoir, ttc } = await couple();
    const ailleurs = await factureEmise("AUTRE CLIENT DE TEST");

    const motif = await motifDuRefus(
      queries.imputerAvoir(societeId, avoir.id as Uuid, ailleurs.id as Uuid, ttc)
    );
    expect(motif).toMatch(/CLIENT DE TEST/);
  });

  it("refuse de dépasser ce que la facture doit", async () => {
    const { facture, avoir, ttc } = await couple();
    const motif = await motifDuRefus(
      queries.imputerAvoir(societeId, avoir.id as Uuid, facture.id as Uuid, ttc + 100)
    );
    expect(motif).toMatch(/ne dispose plus que|ne doit plus que/i);
  });
});
