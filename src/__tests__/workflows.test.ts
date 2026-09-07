/**
 * Workflows métier de bout en bout, sur la vraie base.
 *
 * Les tables sont sous RLS : sans identifiants de test dans `.env.local`
 * (voir setup.ts), toute la suite est ignorée plutôt que rouge.
 */

import { describe, it, expect, beforeAll } from "vitest";
import * as workflows from "@/api/operations/workflows";
import * as queries from "@/api/queries";
import type { Uuid } from "@/api/types";
import { AUTH_DISPONIBLE, TEST_SOCIETE_CODE } from "./setup";

const suite = AUTH_DISPONIBLE ? describe : describe.skip;

suite("Workflows métier", () => {
  const NOM_CLIENT = "CLIENT DE TEST";
  let societeId: Uuid;
  let clientId: Uuid;
  let devisId: Uuid;
  let bcId: Uuid;
  let interventionId: Uuid;

  beforeAll(async () => {
    const societe = await queries.getSocieteByCode(TEST_SOCIETE_CODE);
    if (!societe) throw new Error(`Société « ${TEST_SOCIETE_CODE} » introuvable`);
    societeId = societe.id;

    const client = await queries.resolveClientByNom(societeId, NOM_CLIENT);
    clientId = client.id;

    const aujourdhui = new Date().toISOString().slice(0, 10);

    const devis = await queries.createDevis(
      societeId,
      { client_nom: NOM_CLIENT, client_id: clientId, date: aujourdhui },
      [{ type: "ligne", designation: "Prestation test", quantite: 2, prix_unitaire: 100, tva: 10 }]
    );
    devisId = devis.id;

    const bc = await queries.createBonCommande(
      societeId,
      { client_nom: NOM_CLIENT, client_id: clientId, date: aujourdhui },
      [{ type: "ligne", designation: "Fourniture test", quantite: 1, prix_unitaire: 250, tva: 20 }]
    );
    bcId = bc.id;

    const intervention = await queries.createIntervention(societeId, {
      client_nom: NOM_CLIENT,
      client_id: clientId,
      date: aujourdhui,
    });
    interventionId = intervention.id;
  });

  describe("Devis → Facture", () => {
    it("recopie l'en-tête et les lignes du devis", async () => {
      const facture = await workflows.accepterDevisEtCreerFacture(societeId, devisId);

      expect(facture.devis_id).toBe(devisId);
      expect(facture.client_id).toBe(clientId);
      expect(facture.statut).toBe("impayée");
      expect(facture.lignes).toHaveLength(1);
      expect(facture.lignes[0].designation).toBe("Prestation test");
    });

    it("passe le devis en « accepté »", async () => {
      const devis = await queries.getDevis(devisId);
      expect(devis?.statut).toBe("accepté");
    });
  });

  describe("Bon de commande → Facture", () => {
    it("facture le BC et enregistre sa réception", async () => {
      const date = new Date().toISOString().slice(0, 10);
      const facture = await workflows.facturerBonCommande(societeId, bcId, date);

      expect(facture.bon_commande_id).toBe(bcId);
      expect(facture.lignes).toHaveLength(1);

      const bc = await queries.getBonCommande(bcId);
      expect(bc?.date_reception).toBe(date);
    });
  });

  describe("Rapport d'intervention", () => {
    it("aplatit le rapport en deux colonnes puis facture", async () => {
      const facture = await workflows.completerRapportEtCreerFacture(
        societeId,
        interventionId,
        "Fuite sur colonne",
        "Tirage multicouche 16 ml"
      );

      expect(facture.intervention_id).toBe(interventionId);

      const intervention = await queries.getIntervention(interventionId);
      expect(intervention?.constatations).toBe("Fuite sur colonne");
      expect(intervention?.preconisations).toBe("Tirage multicouche 16 ml");
    });
  });

  describe("Planification multi-métier", () => {
    it("écrit un créneau par métier", async () => {
      const bc = await workflows.planifierBCMultiMetier(bcId, [
        {
          metier: "Plomberie",
          technicien: "Jean Dupont",
          datePlanifiee: "2026-09-15",
          heurePlanifiee: "08:00",
          dureeHeures: 16,
        },
        {
          metier: "Électricité",
          sousTraitant: "ACME Electric",
          datePlanifiee: "2026-09-17",
          heurePlanifiee: "14:00",
          dureeHeures: 8,
        },
      ]);

      const schedule = (bc.schedule_par_metier ?? {}) as Record<
        string,
        { technicien?: string }
      >;
      expect(Object.keys(schedule)).toHaveLength(2);
      expect(schedule.Plomberie.technicien).toBe("Jean Dupont");
    });
  });

  describe("Règlement", () => {
    it("laisse la facture impayée sur un règlement partiel", async () => {
      const facture = await queries.createFacture(
        societeId,
        {
          client_nom: NOM_CLIENT,
          client_id: clientId,
          date: new Date().toISOString().slice(0, 10),
        },
        [{ type: "ligne", designation: "Test solde", quantite: 1, prix_unitaire: 100, tva: 0 }]
      );

      const { facture: apres, soldeRestant } =
        await workflows.ajouterReglementEtMajStatut(
          societeId,
          facture.id,
          40,
          "virement",
          new Date().toISOString().slice(0, 10)
        );

      expect(soldeRestant).toBeCloseTo(60, 2);
      expect(apres.statut).toBe("impayée");
    });

    it("solde la facture quand le total est atteint", async () => {
      const facture = await queries.createFacture(
        societeId,
        {
          client_nom: NOM_CLIENT,
          client_id: clientId,
          date: new Date().toISOString().slice(0, 10),
        },
        [{ type: "ligne", designation: "Test soldé", quantite: 1, prix_unitaire: 100, tva: 0 }]
      );

      const { facture: apres, soldeRestant } =
        await workflows.ajouterReglementEtMajStatut(
          societeId,
          facture.id,
          100,
          "virement",
          new Date().toISOString().slice(0, 10)
        );

      expect(soldeRestant).toBeCloseTo(0, 2);
      expect(apres.statut).toBe("payée");
    });
  });

  describe("CRUD", () => {
    it("crée, modifie puis supprime un article", async () => {
      const article = await queries.createArticle(societeId, {
        code: "ART-TEST",
        designation: "Article de test",
        prix_unitaire: 99.99,
        tva: 20,
      });

      const modifie = await queries.updateArticle(article.id, { designation: "Modifié" });
      expect(modifie.designation).toBe("Modifié");

      await queries.deleteArticle(article.id);
      expect(await queries.getArticle(article.id)).toBeNull();
    });
  });
});
