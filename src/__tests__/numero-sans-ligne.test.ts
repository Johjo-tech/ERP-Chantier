/**
 * Un numéro ne s'accorde pas à une facture vide.
 *
 * 55 factures numérotées de production ne portent aucune ligne — les suites
 * d'intégration tournaient encore contre la vraie base, entre le 7 et le 9
 * septembre. Elles ont consommé des numéros de la série réelle sans rien
 * facturer.
 *
 * Rien ne l'empêchait : le trigger d'attribution s'exécute `before insert`, et
 * à cet instant les lignes n'existent pas encore. La règle `BG-25` de la norme
 * EN 16931 — « une facture sans ligne ne peut pas être émise » — n'était
 * consultée qu'à l'envoi de la facture électronique, bien après le numéro.
 *
 * Ces cas fixent l'ordre juste : brouillon, puis lignes, puis émission.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import * as queries from "@/api/queries";
import { supabase } from "@/api/client";
import { emissionADifferer, stGet, stSet } from "@/integrations/html-adapter";
import { AUTH_DISPONIBLE, TEST_SOCIETE_CODE } from "./setup";
import type { TablesInsert, Uuid } from "@/api/types";

type StatutFacture = NonNullable<TablesInsert<"factures">["statut"]>;

const suite = AUTH_DISPONIBLE ? describe : describe.skip;

suite("Pas de numéro sans ligne", () => {
  let societeId: Uuid;
  const aEffacer: Uuid[] = [];

  beforeAll(async () => {
    const societe = await queries.getSocieteByCode(TEST_SOCIETE_CODE);
    if (!societe) throw new Error("Société de test introuvable");
    societeId = societe.id;
  });

  /* Une facture numérotée ne se supprime plus — c'est la continuité de la
     série. On ne nettoie donc que les brouillons. */
  afterAll(async () => {
    for (const id of aEffacer) {
      await supabase.from("facture_lignes").delete().eq("facture_id", id);
      await supabase.from("factures").delete().eq("id", id);
    }
  });

  async function creer(statut: StatutFacture) {
    return supabase
      .from("factures")
      .insert({
        societe_id: societeId,
        client_nom: "CLIENT DE TEST",
        date: new Date().toISOString().slice(0, 10),
        statut,
      })
      .select("id, numero")
      .single();
  }

  /* Le cas qui a produit les 55 : une insertion directe au statut émis. */
  it("refuse de créer une facture émise sans ligne", async () => {
    const { data, error } = await creer("impayée");

    expect(data).toBeNull();
    expect(error?.message).toMatch(/sans ligne/i);
  });

  it("dit quoi faire à la place", async () => {
    const { error } = await creer("impayée");
    expect(error?.message).toMatch(/brouillon/i);
    expect(error?.message).toMatch(/BG-25/);
  });

  it("laisse naître un brouillon vide, sans numéro", async () => {
    const { data, error } = await creer("brouillon");

    expect(error).toBeNull();
    expect(data?.numero).toBeNull();
    if (data) aEffacer.push(data.id);
  });

  /* L'ordre juste, de bout en bout : brouillon, lignes, émission. */
  it("numérote à l'émission, une fois les lignes posées", async () => {
    const { data: brouillon } = await creer("brouillon");
    if (!brouillon) throw new Error("Brouillon non créé");
    aEffacer.push(brouillon.id);

    await supabase.from("facture_lignes").insert({
      facture_id: brouillon.id,
      position: 0,
      type: "ligne",
      designation: "Réfection d'un siphon",
      quantite: 1,
      prix_unitaire: 120,
      tva: 10,
    });

    const { data: emise, error } = await supabase
      .from("factures")
      .update({ statut: "impayée" })
      .eq("id", brouillon.id)
      .select("numero")
      .single();

    expect(error).toBeNull();
    expect(emise?.numero).toMatch(/^FAC-\d{4}-\d{6}$/);
  });

  /* Un commentaire n'est pas une prestation : une facture qui n'en porte que
     ne facture toujours rien. */
  it("ne compte pas un commentaire comme une ligne facturable", async () => {
    const { data: brouillon } = await creer("brouillon");
    if (!brouillon) throw new Error("Brouillon non créé");
    aEffacer.push(brouillon.id);

    await supabase.from("facture_lignes").insert({
      facture_id: brouillon.id,
      position: 0,
      type: "commentaire",
      designation: "Merci de votre confiance",
    });

    const { error } = await supabase
      .from("factures")
      .update({ statut: "impayée" })
      .eq("id", brouillon.id);

    expect(error?.message).toMatch(/sans ligne/i);
  });

  /* Le chemin de l'application : le formulaire enregistre la facture et ses
     lignes en un geste, par le pont. Le pont la fait naître brouillon, pose
     les lignes, puis l'émet — l'utilisateur ne voit qu'un enregistrement. */
  it("numérote une facture enregistrée depuis l'écran, lignes comprises", async () => {
    const cle = "facture:" + crypto.randomUUID();
    const enregistre = await stSet(cle, {
      societeId: TEST_SOCIETE_CODE,
      client: "CLIENT DE TEST",
      date: new Date().toISOString().slice(0, 10),
      statut: "impayée",
      lignes: [
        { type: "ligne", designation: "Réfection", qte: 1, unite: "u", prixUnitaire: 240, tva: 10 },
      ],
    });

    expect(enregistre, "le pont a refusé l'enregistrement").toBe(true);

    const relue = (await stGet(cle)) as { numero?: string | null } | null;
    expect(relue?.numero).toMatch(/^FAC-\d{4}-\d{6}$/);
  });
});

/* La règle est isolée pour être lisible sans base : c'est elle qui décide si
   l'émission doit attendre les lignes. */
describe("Quelle création doit passer par un brouillon", () => {
  it("diffère une facture émise sans numéro", () => {
    expect(emissionADifferer("facture", { statut: "impayée" })).toBe(true);
  });

  it("ne diffère pas un brouillon, qui n'est pas émis", () => {
    expect(emissionADifferer("facture", { statut: "brouillon" })).toBe(false);
  });

  /* Une facture de sous-traitance porte sa propre série, hors compteur : le
     trigger la laisse passer, rien à différer. */
  it("ne diffère pas une facture qui apporte son numéro", () => {
    expect(emissionADifferer("facture", { statut: "impayée", numero: "FST-2026-1" })).toBe(false);
  });

  it("ne touche pas aux autres documents", () => {
    expect(emissionADifferer("devis", { statut: "impayée" })).toBe(false);
    expect(emissionADifferer("bonCommande", { statut: "impayée" })).toBe(false);
  });
});
