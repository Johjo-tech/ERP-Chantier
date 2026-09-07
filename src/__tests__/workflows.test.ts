/**
 * Test Suite - Workflows métier complets
 *
 * Teste tous les workflows critiques:
 * ✅ Devis → Facture
 * ✅ BC → Facture
 * ✅ Intervention → Facture
 * ✅ Planification multi-métier
 * ✅ Réglement + statut facture
 * ✅ SAV
 * ✅ Notifications
 */

import { describe, it, expect, beforeAll } from "vitest";
import * as workflows from "@/api/operations/workflows";
import * as queries from "@/api/queries";
import { uid } from "@/api/client";

// Mock société pour les tests
const TEST_SOCIETE_ID = "test-societe-" + uid();

describe("Workflows Métier", () => {
  let testDevisId: string;
  let testBCId: string;
  let testInterventionId: string;
  let testFactureId: string;

  beforeAll(async () => {
    // Créer des données de test
    const devis = await queries.createDevis(TEST_SOCIETE_ID, {
      client: "TEST CLIENT",
      date: new Date().toISOString().split("T")[0],
    });
    testDevisId = devis.id;

    const bc = await queries.createBonCommande(TEST_SOCIETE_ID, {
      client: "TEST CLIENT",
      numero_bc: "TEST-BC-001",
      date_planifiee: new Date().toISOString().split("T")[0],
    });
    testBCId = bc.id;

    const intervention = await queries.createIntervention(TEST_SOCIETE_ID, {
      client: "TEST CLIENT",
      date: new Date().toISOString().split("T")[0],
    });
    testInterventionId = intervention.id;
  });

  describe("Devis → Facture", () => {
    it("devrait créer une facture depuis un devis accepté", async () => {
      const facture = await workflows.accepterDevisEtCreerFacture(
        TEST_SOCIETE_ID,
        testDevisId
      );

      expect(facture).toBeDefined();
      expect(facture.devis_id).toBe(testDevisId);
      expect(facture.statut).toBe("impayée");
      expect(facture.client).toBe("TEST CLIENT");

      testFactureId = facture.id;
    });

    it("devis devrait être marqué accepté", async () => {
      const devis = await queries.getDevis(testDevisId);

      expect(devis?.statut).toBe("accepté");
    });
  });

  describe("BC → Facture", () => {
    it("devrait créer une facture depuis un BC reçu", async () => {
      const facture = await workflows.clotureractureDepuisBC(
        TEST_SOCIETE_ID,
        testBCId,
        new Date().toISOString().split("T")[0]
      );

      expect(facture).toBeDefined();
      expect(facture.bon_commande_id).toBe(testBCId);
      expect(facture.statut).toBe("impayée");
    });

    it("BC devrait être marqué comme reçu", async () => {
      const bc = await queries.getBonCommande(testBCId);

      expect(bc?.date_reception).toBeDefined();
    });
  });

  describe("Rapport d'Intervention", () => {
    it("devrait compléter un rapport et créer facture", async () => {
      const facture = await workflows.completerRapportEtCreerFacture(
        TEST_SOCIETE_ID,
        testInterventionId,
        "Contrôle technique effectué",
        "Remplacement du joint détecté",
        "data:image/svg+xml;base64,PHN2Zz4...", // Signature base64 mock
        []
      );

      expect(facture).toBeDefined();
      expect(facture.intervention_id).toBe(testInterventionId);
    });

    it("intervention devrait avoir le rapport rempli", async () => {
      const intervention = await queries.getIntervention(testInterventionId);

      expect(intervention?.rapport?.constatations).toBe(
        "Contrôle technique effectué"
      );
      expect(intervention?.rapport?.preconisations).toBe(
        "Remplacement du joint détecté"
      );
    });
  });

  describe("Planification Multi-métier", () => {
    it("devrait planifier un BC pour plusieurs métiers", async () => {
      const bc = await workflows.planifierBCMultiMetier(testBCId, [
        {
          metier: "Plomberie",
          technicien: "Jean Dupont",
          datePlanifiee: "2024-09-15",
          datePlanifieeFin: "2024-09-16",
          heurePlanifiee: "08:00",
          dureeHeures: 16,
        },
        {
          metier: "Électricité",
          sousTraitant: "ACME Electric",
          datePlanifiee: "2024-09-17",
          datePlanifieeFin: "2024-09-17",
          heurePlanifiee: "14:00",
          dureeHeures: 8,
        },
      ]);

      expect(bc.schedule_par_metier).toBeDefined();
      expect(Object.keys(bc.schedule_par_metier!)).toHaveLength(2);
    });
  });

  describe("Réglement Facture", () => {
    it("devrait ajouter un réglement", async () => {
      const { reglement, facture } =
        await workflows.ajouterReglementEtMajStatut(
          testFactureId,
          100,
          "Chèque",
          new Date().toISOString().split("T")[0],
          "CHK-001"
        );

      expect(reglement).toBeDefined();
      expect(reglement.montant).toBe(100);
      expect(reglement.mode).toBe("Chèque");
    });

    it("devrait marquer facture comme payée si solde = 0", async () => {
      // Récupérer les totaux de la facture
      const totaux = await queries.getFactureTotaux(testFactureId);

      // Ajouter un réglement égal au total
      await workflows.ajouterReglementEtMajStatut(
        testFactureId,
        totaux.montant_ht + totaux.montant_tva,
        "Virement",
        new Date().toISOString().split("T")[0]
      );

      const facture = await queries.getFacture(testFactureId);
      expect(facture?.statut).toBe("payée");
    });
  });

  describe("SAV (Bon de commande lié)", () => {
    it("devrait créer un SAV pour un BC précédent", async () => {
      const sav = await workflows.creerSAV(
        TEST_SOCIETE_ID,
        testBCId,
        "Problème de fuite détecté après 2 jours",
        []
      );

      expect(sav).toBeDefined();
      expect(sav.bon_commande_id).toBe(testBCId);
      expect(sav.probleme_description).toBe(
        "Problème de fuite détecté après 2 jours"
      );
    });
  });

  describe("Notifications", () => {
    it("devrait calculer les notifications", async () => {
      const notifications = await workflows.calculerNotifications(
        TEST_SOCIETE_ID
      );

      expect(Array.isArray(notifications)).toBe(true);
      // Les notifications peuvent être vides si aucune alerte à date
      // C'est normal
    });
  });

  describe("Export & Backup", () => {
    it("devrait créer une sauvegarde des données", async () => {
      const blob = await workflows.sauvegarderSociete(TEST_SOCIETE_ID);

      expect(blob).toBeDefined();
      expect(blob.type).toBe("application/json");
      expect(blob.size).toBeGreaterThan(0);

      // Vérifier qu'on peut parser le JSON
      const text = await blob.text();
      const data = JSON.parse(text);
      expect(data.version).toBe(1);
      expect(data.societeId).toBe(TEST_SOCIETE_ID);
    });
  });
});

describe("Mutations de données", () => {
  describe("CRUD Clients", () => {
    let clientId: string;

    it("devrait créer un client", async () => {
      const client = await queries.createClient(TEST_SOCIETE_ID, {
        nom: "Nouveau Client",
        email: "contact@client.com",
      });

      expect(client).toBeDefined();
      expect(client.nom).toBe("Nouveau Client");
      clientId = client.id;
    });

    it("devrait mettre à jour un client", async () => {
      const updated = await queries.updateClient(clientId, {
        email: "new@client.com",
      });

      expect(updated.email).toBe("new@client.com");
    });

    it("devrait récupérer un client", async () => {
      const client = await queries.getClient(clientId);

      expect(client?.id).toBe(clientId);
    });

    it("devrait lister les clients", async () => {
      const clients = await queries.listClients(TEST_SOCIETE_ID);

      expect(Array.isArray(clients)).toBe(true);
      expect(clients.length).toBeGreaterThanOrEqual(1);
    });

    it("devrait supprimer un client", async () => {
      await queries.deleteClient(clientId);

      const client = await queries.getClient(clientId);
      expect(client).toBeNull();
    });
  });

  describe("CRUD Articles", () => {
    it("devrait créer et supprimer un article", async () => {
      const article = await queries.createArticle(TEST_SOCIETE_ID, {
        code: "ART-TEST",
        designation: "Article de test",
        prix_vente: 99.99,
      });

      expect(article).toBeDefined();

      await queries.deleteArticle(article.id);

      const deleted = await queries.getArticle(article.id);
      expect(deleted).toBeNull();
    });
  });
});

describe("Sécurité & Validation", () => {
  it("devrait refuser stGet avec clé invalide", async () => {
    const result = await queries.getDevis("invalid-id");

    expect(result).toBeNull();
  });

  it("devrait gérer les erreurs Supabase", async () => {
    try {
      // Tenter une opération invalide
      await queries.deleteDevis("non-existent-devis-id");
    } catch (err) {
      expect(err).toBeDefined();
    }
  });
});
