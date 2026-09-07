/**
 * Circuit complet, du devis à la facture émise.
 *
 * Devis → bon de commande → planning → constat du technicien → arbitrage du
 * conducteur → bon prêt à chiffrer → facture.
 *
 * Le test parcourt la chaîne sur la vraie base : il vérifie les transitions
 * d'état, pas seulement que les appels n'échouent pas. Le chemin de refus est
 * couvert autant que celui d'acceptation — c'est lui qui casse en silence.
 */

import { describe, it, expect, beforeAll } from "vitest";
import * as queries from "@/api/queries";
import { supabase } from "@/api/client";
import type { Uuid } from "@/api/types";
import { AUTH_DISPONIBLE, TEST_SOCIETE_CODE } from "./setup";

const suite = AUTH_DISPONIBLE ? describe : describe.skip;

suite("Circuit de validation devis → facture", () => {
  const NOM_CLIENT = "CLIENT DE TEST";
  const aujourdhui = new Date().toISOString().slice(0, 10);

  let societeId: Uuid;
  let clientId: Uuid;
  let bcId: Uuid;
  let tacheId: Uuid;

  beforeAll(async () => {
    const societe = await queries.getSocieteByCode(TEST_SOCIETE_CODE);
    if (!societe) throw new Error(`Société « ${TEST_SOCIETE_CODE} » introuvable`);
    societeId = societe.id;
    clientId = (await queries.resolveClientByNom(societeId, NOM_CLIENT)).id;
  });

  describe("1 · Devis", () => {
    it("crée un devis chiffré et le fait accepter", async () => {
      const devis = await queries.createDevis(
        societeId,
        { client_nom: NOM_CLIENT, client_id: clientId, date: aujourdhui },
        [
          {
            type: "ligne",
            designation: "Réfection étanchéité terrasse",
            quantite: 12,
            unite: "m²",
            prix_unitaire: 45,
            tva: 10,
          },
        ]
      );

      expect(devis.statut).toBe("brouillon");
      expect(devis.lignes).toHaveLength(1);

      const accepte = await queries.updateDevisStatut(devis.id, "accepté");
      expect(accepte.statut).toBe("accepté");

      // Les totaux sont calculés en base, pas recomposés côté client
      const totaux = await queries.getDevisTotaux(devis.id);
      expect(totaux?.ht).toBeCloseTo(540, 2);
    });
  });

  describe("2 · Bon de commande", () => {
    it("ouvre un bon de commande pour les travaux", async () => {
      const bc = await queries.createBonCommande(
        societeId,
        { client_nom: NOM_CLIENT, client_id: clientId, date: aujourdhui },
        [
          {
            type: "ligne",
            designation: "Réfection étanchéité terrasse",
            quantite: 12,
            unite: "m²",
            prix_unitaire: 45,
            tva: 10,
          },
        ]
      );

      bcId = bc.id;
      expect(bc.numero_bc).toBeTruthy();
      expect(bc.lignes).toHaveLength(1);
    });
  });

  describe("3 · Mise au planning", () => {
    it("planifie la tâche, en attente d'intervention", async () => {
      const tache = await queries.planifierTache(societeId, {
        bon_commande_id: bcId,
        libelle: "Réfection étanchéité terrasse",
        date_tache: aujourdhui,
        heure_debut: "08:00",
        heure_fin: "12:00",
      });

      tacheId = tache.id;
      expect(tache.statut).toBe("planifiee");
      expect(tache.realisee_le).toBeNull();
      expect(tache.validee_le).toBeNull();
    });

    it("rattache la tâche au bon de commande", async () => {
      const taches = await queries.listTachesBonCommande(bcId);
      expect(taches.map((t) => t.id)).toContain(tacheId);
    });
  });

  describe("4 · Le technicien intervient", () => {
    it("enregistre ses constats sans clore la tâche", async () => {
      await queries.sauvegarderTerrain(tacheId, {
        commentaire: "Support sain, membrane posée",
        pieceACommander: true,
        pieceDescription: "Profilé alu 3 m",
      });

      const tache = await queries.getTache(tacheId);
      expect(tache?.commentaire).toBe("Support sain, membrane posée");
      expect(tache?.piece_a_commander).toBe(true);
      // Sauvegarder n'est pas terminer : la tâche reste planifiée
      expect(tache?.statut).toBe("planifiee");
    });

    it("déclare les travaux faits", async () => {
      await queries.marquerRealisee(tacheId, { commentaire: "Terminé" });

      const tache = await queries.getTache(tacheId);
      expect(tache?.statut).toBe("realisee");
      expect(tache?.realisee_le).toBeTruthy();
    });

    it("fait apparaître la tâche dans la file du conducteur", async () => {
      const aValider = await queries.listTachesAValider(societeId);
      expect(aValider.map((t) => t.id)).toContain(tacheId);
    });
  });

  describe("5 · Le conducteur arbitre", () => {
    it("exige un motif pour refuser", async () => {
      await expect(queries.validerTache(tacheId, false)).rejects.toThrow(/motivé/);
    });

    it("renvoie la tâche au technicien avec le motif", async () => {
      await queries.validerTache(tacheId, false, "Reprendre les relevés d'angle");

      const tache = await queries.getTache(tacheId);
      expect(tache?.statut).toBe("refusee");
      expect(tache?.refus_motif).toBe("Reprendre les relevés d'angle");
    });

    it("valide après reprise", async () => {
      await queries.marquerRealisee(tacheId, { commentaire: "Relevés repris" });
      await queries.validerTache(tacheId, true);

      const tache = await queries.getTache(tacheId);
      expect(tache?.statut).toBe("validee");
      expect(tache?.validee_le).toBeTruthy();
    });
  });

  describe("6 · Travaux supplémentaires", () => {
    it("consigne un travail hors bon, à chiffrer", async () => {
      const trav = await queries.ajouterTravailSupplementaire(societeId, {
        bon_commande_id: bcId,
        planning_tache_id: tacheId,
        libelle: "Remplacement crapaudine",
        quantite: 1,
        unite: "u",
        origine: "technicien",
      });

      expect(trav.statut).toBe("a_chiffrer");
      expect(trav.prix_vente_ht).toBeNull();

      const chiffre = await queries.chiffrerTravailSupplementaire(trav.id, 85, 10);
      expect(chiffre.statut).toBe("chiffre");
      expect(chiffre.prix_vente_ht).toBe(85);
    });
  });

  describe("7 · Bon prêt à chiffrer", () => {
    it("bascule le bon de commande une fois les tâches validées", async () => {
      await queries.passerPretAChiffrer(bcId);

      const bc = await queries.getBonCommande(bcId);
      expect(bc?.statut_workflow).toBe("pret_a_chiffrer");
    });
  });

  describe("8 · Émission de la facture", () => {
    it("facture le bon de commande en reprenant ses lignes", async () => {
      const facture = await queries.createFactureFromBC(societeId, bcId);

      expect(facture.bon_commande_id).toBe(bcId);
      expect(facture.numero).toMatch(/^FAC-/);
      expect(facture.statut).toBe("impayée");
      expect(facture.lignes).toHaveLength(1);
      expect(facture.lignes[0].designation).toBe("Réfection étanchéité terrasse");

      const solde = await queries.getFactureSolde(facture.id);
      expect(solde?.reste).toBeCloseTo(594, 2); // 540 HT + 10 % TVA
    });
  });
});

suite("Travaux supplémentaires et constats", () => {
  const NOM_CLIENT = "CLIENT DE TEST";
  let societeId: Uuid;
  let bcId: Uuid;
  let tacheId: Uuid;

  beforeAll(async () => {
    const societe = await queries.getSocieteByCode(TEST_SOCIETE_CODE);
    if (!societe) throw new Error("Société de test introuvable");
    societeId = societe.id;

    const bc = await queries.createBonCommande(societeId, {
      client_nom: NOM_CLIENT,
      date: new Date().toISOString().slice(0, 10),
    });
    bcId = bc.id;

    const tache = await queries.planifierTache(societeId, {
      bon_commande_id: bcId,
      libelle: "Intervention",
      date_tache: new Date().toISOString().slice(0, 10),
    });
    tacheId = tache.id;
  });

  it("enregistre les constats sans changer l'état de la tâche", async () => {
    await queries.sauvegarderTerrain(tacheId, {
      commentaire: "Accès difficile, prévoir nacelle",
      pieceACommander: true,
      pieceDescription: "Joint EPDM 40 mm",
    });

    const tache = await queries.getTache(tacheId);
    expect(tache?.commentaire).toBe("Accès difficile, prévoir nacelle");
    expect(tache?.piece_description).toBe("Joint EPDM 40 mm");
    expect(tache?.statut).toBe("planifiee");
  });

  it("consigne un travail en plus, rattaché à la tâche et au bon", async () => {
    const trav = await queries.ajouterTravailSupplementaire(societeId, {
      bon_commande_id: bcId,
      planning_tache_id: tacheId,
      libelle: "Reprise scellement garde-corps",
      quantite: 2,
      unite: "u",
      origine: "technicien",
    });

    expect(trav.statut).toBe("a_chiffrer");
    expect(trav.planning_tache_id).toBe(tacheId);

    const liste = await queries.listTravauxSupplementaires(bcId);
    expect(liste.map((t) => t.id)).toContain(trav.id);
  });

  it("laisse le chiffrage à qui voit les prix", async () => {
    const [trav] = await queries.listTravauxSupplementaires(bcId);
    const chiffre = await queries.chiffrerTravailSupplementaire(trav.id, 240, 20);

    expect(chiffre.statut).toBe("chiffre");
    expect(chiffre.prix_vente_ht).toBe(240);
    expect(chiffre.tva).toBe(20);
  });

  it("supprime un travail consigné par erreur", async () => {
    const trav = await queries.ajouterTravailSupplementaire(societeId, {
      bon_commande_id: bcId,
      libelle: "Saisie erronée",
      origine: "technicien",
    });

    await queries.supprimerTravailSupplementaire(trav.id);

    const liste = await queries.listTravauxSupplementaires(bcId);
    expect(liste.map((t) => t.id)).not.toContain(trav.id);
  });
});

suite("Transitions interdites", () => {
  const NOM_CLIENT = "CLIENT DE TEST";
  const aujourdhui = new Date().toISOString().slice(0, 10);
  let societeId: Uuid;
  let bcId: Uuid;
  let tacheId: Uuid;

  beforeAll(async () => {
    const societe = await queries.getSocieteByCode(TEST_SOCIETE_CODE);
    if (!societe) throw new Error("Société de test introuvable");
    societeId = societe.id;

    const bc = await queries.createBonCommande(societeId, {
      client_nom: NOM_CLIENT,
      date: aujourdhui,
    });
    bcId = bc.id;

    tacheId = (
      await queries.planifierTache(societeId, {
        bon_commande_id: bcId,
        libelle: "Contrôle des transitions",
        date_tache: aujourdhui,
      })
    ).id;
  });

  it("refuse de valider des travaux jamais déclarés faits", async () => {
    await expect(queries.validerTache(tacheId, true)).rejects.toThrow(/planifiee/);
  });

  it("refuse de chiffrer un bon dont une tâche reste en attente", async () => {
    await expect(queries.passerPretAChiffrer(bcId)).rejects.toThrow(/pas encore validées/);
  });

  it("refuse de rouvrir une tâche déjà validée", async () => {
    await queries.marquerRealisee(tacheId);
    await queries.validerTache(tacheId, true);

    await expect(queries.marquerRealisee(tacheId)).rejects.toThrow(/validee/);
  });

  it("autorise le chiffrage une fois toutes les tâches validées", async () => {
    await queries.passerPretAChiffrer(bcId);

    const bc = await queries.getBonCommande(bcId);
    expect(bc?.statut_workflow).toBe("pret_a_chiffrer");
  });
});
