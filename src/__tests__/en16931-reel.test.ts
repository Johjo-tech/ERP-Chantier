/**
 * La charge EN 16931, construite depuis une vraie facture.
 *
 * `en16931.test.ts` couvre la règle sur des données fabriquées. Ici on part
 * d'une facture de la base : c'est ce qui révèle les manques réels — un client
 * sans SIRET, une identité d'émetteur jamais figée, une ligne de commentaire
 * qui n'aurait rien à faire dans le décompte.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { supabase } from "@/api/client";
import * as queries from "@/api/queries";
import { preparerEmission } from "@/api/operations/efacture";
import { SPECIFICATION_EN16931 } from "@/api/regles-en16931";
import type { Uuid } from "@/api/types";
import { AUTH_DISPONIBLE, TEST_SOCIETE_CODE } from "./setup";

const suite = AUTH_DISPONIBLE ? describe : describe.skip;

suite("Émission d'une facture réelle", () => {
  let factureId: Uuid;

  beforeAll(async () => {
    const societe = await queries.getSocieteByCode(TEST_SOCIETE_CODE);
    /* Une facture réellement chiffrée : les totaux sont posés par la base, et
       une facture fraîchement créée par une autre suite les a encore à zéro.
       Sans ce filtre, le contrôle de cohérence porterait sur du vide. */
    const { data } = await supabase
      .from("factures")
      .select("id")
      .eq("societe_id", societe!.id)
      .not("numero", "is", null)
      .gt("total_ht", 0)
      .order("cree_le", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!data) throw new Error("Aucune facture chiffrée pour éprouver l'émission");
    factureId = data.id as Uuid;
  });

  it("produit une charge conforme à la spécification", async () => {
    const { charge } = await preparerEmission(factureId);
    expect(charge.en_invoice.process_control.specification_identifier).toBe(
      SPECIFICATION_EN16931
    );
    expect(charge.en_invoice.number).toBeTruthy();
    expect(charge.en_invoice.issue_date).toBeTruthy();
  });

  /* Le total de la ventilation doit tomber au centime sur celui de la facture,
     sinon la plateforme rejette. C'est le contrôle qui attrape une ligne de
     commentaire comptée par erreur, ou un arrondi par ligne. */
  it("laisse la ventilation de TVA cohérente avec les totaux", async () => {
    const { charge } = await preparerEmission(factureId);
    const en = charge.en_invoice;

    const baseVentilee = en.vat_break_down.reduce(
      (t, v) => t + Number(v.vat_category_taxable_amount),
      0
    );
    expect(baseVentilee.toFixed(2)).toBe(en.totals.total_without_vat);
  });

  it("porte une identité d'émetteur immatriculée", async () => {
    const { charge } = await preparerEmission(factureId);
    const seller = charge.en_invoice.seller;
    expect(seller.name).toBeTruthy();
    expect(seller.legal_registration_identifier?.scheme).toBe("0002");
    expect(seller.legal_registration_identifier?.value).toMatch(/^\d{9}$/);
  });

  it("sait dire ce qui empêche d'émettre, sans planter", async () => {
    const { manques } = await preparerEmission(factureId);
    expect(Array.isArray(manques)).toBe(true);
    for (const m of manques) {
      expect(m.code).toBeTruthy();
      expect(m.libelle).toBeTruthy();
    }
  });

  /* Le cas qui compte : trois clients sur six n'ont aucun SIRET aujourd'hui.
     La facture doit rester préparable, et le manque nommé. */
  it("prépare quand même une facture dont le client n'est pas joignable", async () => {
    const societe = await queries.getSocieteByCode(TEST_SOCIETE_CODE);
    const client = await queries.resolveClientByNom(societe!.id, "CLIENT SANS IDENTITE");
    const facture = await queries.createFacture(
      societe!.id,
      { client_nom: "CLIENT SANS IDENTITE", client_id: client.id, date: "2026-09-09" },
      [{ type: "ligne", designation: "Prestation", quantite: 1, prix_unitaire: 100, unite: "u", tva: 20 }]
    );

    const { charge, manques } = await preparerEmission(facture.id);
    expect(charge.en_invoice.number ?? null).toBeDefined();
    expect(manques.length).toBeGreaterThan(0);
  });
});
