/**
 * Qui peut quoi, éprouvé sous de vraies sessions.
 *
 * `a_permission` décrivait déjà finement les droits par module, mais les
 * tables filles ne la consultaient pas : elles s'en remettaient à
 * `peut_ecrire` — qui inclut le technicien — et à `est_membre`, c'est-à-dire
 * n'importe quel membre. Un compte terrain modifiait donc le prix d'une ligne
 * de facture émise, réécrivait un contrat de salarié et remettait le compteur
 * de factures à 1.
 *
 * Ces cas tiennent la matrice telle qu'elle a été arrêtée : le conducteur
 * chiffre devis et bons de commande mais ne supprime pas, le technicien ne
 * voit aucun prix de vente, et le compteur n'appartient qu'à l'administrateur.
 *
 * Les comptes de rôle viennent de `supabase/seed-tests.sql` : la suite ne
 * tourne que sur la base locale.
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

suite("Matrice des rôles", () => {
  const aujourdhui = new Date().toISOString().slice(0, 10);
  let societeId: Uuid;
  let conducteur: SupabaseClient;
  let technicien: SupabaseClient;

  beforeAll(async () => {
    const societe = await queries.getSocieteByCode(TEST_SOCIETE_CODE);
    if (!societe) throw new Error(`Société « ${TEST_SOCIETE_CODE} » introuvable`);
    societeId = societe.id;
    conducteur = await session("conducteur@local");
    technicien = await session("tech.a@local");
  });

  afterAll(async () => {
    await Promise.all([conducteur?.auth.signOut(), technicien?.auth.signOut()]);
  });

  /** Un devis neuf, chiffré, avec sa ligne. */
  async function devisChiffre() {
    return queries.createDevis(
      societeId,
      { client_nom: "CLIENT DE TEST", date: aujourdhui },
      [
        {
          type: "ligne",
          designation: "Reprise d'étanchéité",
          quantite: 10,
          unite: "m²",
          prix_unitaire: 40,
          tva: 10,
        },
      ]
    );
  }

  describe("Le conducteur", () => {
    it("chiffre un devis — c'est lui qui relève les quantités", async () => {
      const d = await devisChiffre();
      const { data, error } = await conducteur
        .from("devis_lignes")
        .update({ prix_unitaire: 55 })
        .eq("id", d.lignes[0].id)
        .select();

      expect(error).toBeNull();
      expect(data).toHaveLength(1);
      expect(Number(data![0].prix_unitaire)).toBe(55);
    });

    it("chiffre un bon de commande", async () => {
      const bc = await queries.createBonCommande(
        societeId,
        { client_nom: "CLIENT DE TEST", date: aujourdhui },
        [{ type: "ligne", designation: "Travaux", quantite: 1, prix_unitaire: 100, tva: 20 }]
      );
      const { data } = await conducteur
        .from("bon_commande_lignes")
        .update({ prix_unitaire: 250 })
        .eq("id", bc.lignes[0].id)
        .select();
      expect(data).toHaveLength(1);
    });

    /* Effacer un devis efface une trace commerciale : cela reste un geste
       d'administrateur ou de secrétaire. */
    it("ne supprime pas un devis", async () => {
      const d = await devisChiffre();
      await conducteur.from("devis").delete().eq("id", d.id);
      expect(await queries.getDevis(d.id)).not.toBeNull();
    });

    it("ne touche pas au compteur de factures", async () => {
      const { data } = await conducteur
        .from("compteurs")
        .update({ valeur: 1 })
        .eq("societe_id", societeId)
        .eq("type", "facture")
        .select();
      expect(data ?? []).toEqual([]);
    });
  });

  describe("Le technicien", () => {
    /* « Jamais » : sur un chantier, le prix de vente ne doit pas s'afficher
       devant le client. Le masque d'écran ne suffit pas — la donnée ne part
       plus du tout. */
    it("ne voit aucun prix de devis", async () => {
      await devisChiffre();
      const { data } = await technicien.from("devis_lignes").select("*").limit(5);
      expect(data).toEqual([]);
    });

    it("ne voit aucune ligne de facture", async () => {
      const { data } = await technicien.from("facture_lignes").select("*").limit(5);
      expect(data).toEqual([]);
    });

    it("ne chiffre pas un devis", async () => {
      const d = await devisChiffre();
      await technicien.from("devis_lignes").update({ prix_unitaire: 1 }).eq("id", d.lignes[0].id);

      const apres = await queries.listDevisLignes(d.id);
      expect(Number(apres[0].prix_unitaire)).toBe(40);
    });

    it("ne chiffre pas un bon de commande", async () => {
      const bc = await queries.createBonCommande(
        societeId,
        { client_nom: "CLIENT DE TEST", date: aujourdhui },
        [{ type: "ligne", designation: "Travaux", quantite: 1, prix_unitaire: 100, tva: 20 }]
      );
      await technicien
        .from("bon_commande_lignes")
        .update({ prix_unitaire: 1 })
        .eq("id", bc.lignes[0].id);

      const apres = await queries.listBonCommandeLignes(bc.id);
      expect(Number(apres[0].prix_unitaire)).toBe(100);
    });

    /* « Jamais » se vérifie sur la donnée qui traverse le réseau, pas sur le
       masque d'écran. Le pont lit une vue qui annule les colonnes sensibles :
       une source unique pour tous les rôles, donc rien à choisir et rien à
       oublier. La table brute, elle, lui est fermée. */
    it("reçoit ses bons de commande sans aucun montant", async () => {
      const { data: brut } = await technicien.from("bons_commande").select("*").limit(1);
      expect(brut).toEqual([]);

      const { data: vue } = await technicien
        .from("v_bons_commande_terrain")
        .select("client_nom, montant, montant_sous_traitant")
        .not("client_nom", "is", null)
        .limit(1);
      expect(vue).toHaveLength(1);
      expect(vue![0].client_nom).toBeTruthy();
      expect(vue![0].montant).toBeNull();
      expect(vue![0].montant_sous_traitant).toBeNull();
    });

    it("reçoit l'annuaire des salariés sans la paie ni les IBAN", async () => {
      const { data: brut } = await technicien.from("salaries").select("*").limit(1);
      expect(brut).toEqual([]);

      const { data: vue } = await technicien
        .from("v_salaries_annuaire")
        .select("nom, poste, salaire_mensuel_net, cout_horaire_charge, iban")
        .limit(1);
      expect(vue).toHaveLength(1);
      expect(vue![0].nom).toBeTruthy();
      expect(vue![0].salaire_mensuel_net).toBeNull();
      expect(vue![0].cout_horaire_charge).toBeNull();
      expect(vue![0].iban).toBeNull();
    });

    it("ne charge ni catalogue de prix, ni encaissements, ni devis, ni factures", async () => {
      for (const table of ["articles", "reglements", "devis", "factures"]) {
        const { data } = await technicien.from(table).select("*").limit(1);
        expect(data, table).toEqual([]);
      }
    });

    /* Le conducteur, lui, lit la même vue et y trouve les montants : c'est
       ce qui prouve que le masquage suit le rôle et non la source. */
    it("laisse le conducteur lire les montants dans la même vue", async () => {
      const { data } = await conducteur
        .from("v_bons_commande_terrain")
        .select("montant")
        .not("montant", "is", null)
        .limit(1);
      expect(data).toHaveLength(1);
      expect(Number(data![0].montant)).toBeGreaterThan(0);
    });

    /* Remettre la série à 1 arrêterait la facturation net : l'index unique
       refuserait le doublon dès la pièce suivante. */
    it("ne remet pas le compteur de factures à zéro", async () => {
      const avant = await queries.listCompteurs(societeId);
      const compteur = avant.find((c) => c.type === "facture");

      await technicien
        .from("compteurs")
        .update({ valeur: 1 })
        .eq("societe_id", societeId)
        .eq("type", "facture");

      const apres = await queries.listCompteurs(societeId);
      expect(apres.find((c) => c.type === "facture")?.valeur).toBe(compteur?.valeur);
    });
  });
});
