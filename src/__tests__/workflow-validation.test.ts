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
import { loadAllData } from "@/integrations/html-adapter";
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
      // Le numéro vient du client, pas de nous : il reste vide ici
      expect(bc.numero_bc).toBeNull();
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

suite("Interlocuteurs", () => {
  /**
   * `interlocuteurs` dépend de son client et n'a pas de `societe_id`. Le pont
   * l'ajoutait pourtant : PostgREST rejetait alors l'insertion entière
   * (PGRST204) et aucun interlocuteur ne pouvait être enregistré.
   */
  let societeId: Uuid;
  let clientId: Uuid;

  beforeAll(async () => {
    const societe = await queries.getSocieteByCode(TEST_SOCIETE_CODE);
    if (!societe) throw new Error("Société de test introuvable");
    societeId = societe.id;
    clientId = (await queries.resolveClientByNom(societeId, "CLIENT DE TEST")).id;
  });

  it("enregistre un interlocuteur rattaché à son client", async () => {
    const interlocuteur = await queries.createInterlocuteur({
      client_id: clientId,
      nom: "Marie Dupont",
      fonction: "Gestionnaire de patrimoine",
      telephone: "0476000000",
    });

    expect(interlocuteur.id).toBeTruthy();
    expect(interlocuteur.client_id).toBe(clientId);
    expect(interlocuteur.fonction).toBe("Gestionnaire de patrimoine");

    const liste = await queries.listInterlocuteurs(clientId);
    expect(liste.map((i) => i.id)).toContain(interlocuteur.id);

    await queries.deleteInterlocuteur(interlocuteur.id);
  });

  it("remonte la société depuis le client, pour le filtrage de l'app", async () => {
    // L'app filtre sur `societeId` : sans cette remontée, la liste est vide
    const data = await loadAllData(TEST_SOCIETE_CODE);
    const inconnus = data.interlocuteurs.filter((i) => !i.client_id);
    expect(inconnus).toEqual([]);
  });
});

suite("Pré-facture", () => {
  /**
   * La base impose en_cours → pret_a_chiffrer → chiffre → facture.
   * `validerPrefacture` franchit les deux passages intermédiaires, qui
   * découlent de l'état des tâches et du chiffrage, et refuse tant qu'une
   * décision métier manque.
   */
  const NOM_CLIENT = "CLIENT DE TEST";
  const aujourdhui = new Date().toISOString().slice(0, 10);
  let societeId: Uuid;
  let bcId: Uuid;
  let tacheId: Uuid;

  beforeAll(async () => {
    const societe = await queries.getSocieteByCode(TEST_SOCIETE_CODE);
    societeId = societe!.id;

    const bc = await queries.createBonCommande(
      societeId,
      { client_nom: NOM_CLIENT, date: aujourdhui, montant: 480 },
      [{ type: "ligne", designation: "Dépose et pose", quantite: 4, prix_unitaire: 120, tva: 10 }]
    );
    bcId = bc.id;

    tacheId = (
      await queries.planifierTache(societeId, {
        bon_commande_id: bcId,
        libelle: "Intervention",
        date_tache: aujourdhui,
      })
    ).id;
  });

  it("refuse tant que la tâche n'est pas validée", async () => {
    await expect(queries.validerPrefacture(bcId)).rejects.toThrow(/pas encore validées/);
  });

  it("refuse tant qu'un travail supplémentaire n'est pas chiffré", async () => {
    await queries.marquerRealisee(tacheId);
    await queries.validerTache(tacheId, true);

    const trav = await queries.ajouterTravailSupplementaire(societeId, {
      bon_commande_id: bcId,
      libelle: "Reprise d'étanchéité",
      origine: "technicien",
    });

    await expect(queries.validerPrefacture(bcId)).rejects.toThrow(/à chiffrer/);

    // Une fois chiffré, l'obstacle tombe
    await queries.chiffrerTravailSupplementaire(trav.id, 150, 10);
  });

  let factureId: Uuid;

  it("génère un brouillon sans numéro et clôt le bon de commande", async () => {
    factureId = await queries.validerPrefacture(bcId);

    const facture = await queries.getFactureComplete(factureId);
    expect(facture?.bon_commande_id).toBe(bcId);
    expect(facture?.statut).toBe("brouillon");
    // Le numéro n'est attribué qu'à l'émission : un brouillon n'en consomme pas
    expect(facture?.numero).toBeNull();

    // Le travail supplémentaire chiffré rejoint les lignes du bon de commande
    expect(facture?.lignes).toHaveLength(2);
    expect(facture?.lignes.map((l) => l.designation)).toContain("Reprise d'étanchéité");

    const bc = await queries.getBonCommande(bcId);
    expect(bc?.statut_workflow).toBe("facture");
  });

  it("attribue le numéro à l'émission, avec les corrections de la secrétaire", async () => {
    const emise = await queries.emettreFacture(factureId, {
      adresse: "Service comptabilité, 4 rue du Change",
    });

    expect(emise.numero).toMatch(/^FAC-/);
    expect(emise.statut).toBe("impayée");
    expect(emise.adresse).toBe("Service comptabilité, 4 rue du Change");
  });

  it("refuse de réémettre une facture déjà numérotée", async () => {
    await expect(queries.emettreFacture(factureId)).rejects.toThrow(/déjà émise/);
  });

  it("refuse de facturer deux fois le même bon", async () => {
    await expect(queries.validerPrefacture(bcId)).rejects.toThrow(/déjà été facturé/);
  });
});
