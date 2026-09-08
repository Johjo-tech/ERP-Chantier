/**
 * Modification d'un bon de commande par le pont, avec l'objet exact que
 * produit le formulaire de l'application — champs hérités compris.
 */

import { describe, it, expect, beforeAll } from "vitest";
import * as queries from "@/api/queries";
import { stGet, stSet } from "@/integrations/html-adapter";
import { AUTH_DISPONIBLE, TEST_SOCIETE_CODE } from "./setup";

const suite = AUTH_DISPONIBLE ? describe : describe.skip;

suite("Pont — bon de commande", () => {
  let bcId: string;

  beforeAll(async () => {
    const societe = await queries.getSocieteByCode(TEST_SOCIETE_CODE);
    if (!societe) throw new Error("Société de test introuvable");
    const bc = await queries.createBonCommande(societe.id, {
      client_nom: "CLIENT DE TEST",
      date: new Date().toISOString().slice(0, 10),
    });
    bcId = bc.id;
  });

  it("enregistre une modification venue du formulaire", async () => {
    const objetApp: Record<string, unknown> = {
      id: bcId,
      societeId: TEST_SOCIETE_CODE,
      createdAt: new Date().toISOString(),
      client: "CLIENT DE TEST",
      sansBC: false,
      enAttenteBC: false,
      bonCommandeId: null,
      problemeDescription: "",
      photos: [],
      interlocuteur: "Marie Dupont",
      devisId: null,
      numeroBC: "BC-MODIF-001",
      adresse: "12 rue des Alpes",
      codePostal: "38000",
      ville: "Grenoble",
      logementStatut: "commune",
      occupant: "",
      etage: "",
      numeroLogement: "",
      precisionCommune: "Hall A",
      ancienLocataire: "",
      dateReception: new Date().toISOString().slice(0, 10),
      dateFinTravaux: "",
      montant: 1250.5,
      montantParMetier: null,
      lignes: [
        { type: "ligne", designation: "Reprise peinture", qte: 3, prixUnitaire: 120, tva: 10 },
      ],
      statut: "en attente",
      conducteur: "PAUL",
      referenceChantier: "REF-42",
      natureTravaux: "",
      metiers: ["PEINTURE"],
      metier: "PEINTURE",
      // Champs hérités sans colonne : ils ne doivent pas faire échouer l'écriture
      pieceJointeNom: "",
      pieceJointeData: null,
      metiersFait: {},
      dateOrigineFait: false,
      technicienCommentaire: "",
      technicienPhotos: [],
      technicienDessin: null,
      pieceACommander: false,
      datesSupplementaires: [],
      tentativesContact: [],
      rappelDate: null,
      travauxSupplementaires: [],
      valideConducteur: false,
      valideDirecteur: false,
      notes: "Modifié depuis le formulaire",
    };

    const ok = await stSet(`bonCommande:${bcId}`, objetApp);
    expect(ok).toBe(true);

    const relu = (await stGet(`bonCommande:${bcId}`)) as Record<string, unknown>;
    expect(relu).toBeTruthy();
    expect(relu.notes).toBe("Modifié depuis le formulaire");
    expect(relu.numeroBC).toBe("BC-MODIF-001");
    expect(relu.montant).toBe(1250.5);
    expect(relu.interlocuteur).toBe("Marie Dupont");
    expect((relu.lignes as unknown[])).toHaveLength(1);
  });
});
