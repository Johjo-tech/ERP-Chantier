import { describe, expect, it } from "vitest";
import { refusFichier, schemaReponse } from "./contrat";
import { essentielsManquants } from "./lecture";
import { versPreRemplissage } from "./prefill";

const lu = {
  client: "  OPAC du Rhône ",
  numeroBC: "BC-2026-77",
  dateBC: "2026-09-20",
  referenceChantier: null,
  natureTravaux: "Plomberie",
  dateFinTravaux: "20/10/2026",
  interlocuteur: null,
  adresse: "14 rue Garibaldi, apt 21",
  codePostal: "69003",
  ville: "Lyon",
  facturationAdresse: null,
  facturationCodePostal: null,
  facturationVille: null,
  numeroLogement: "21",
  logementStatut: "occupé",
  occupant: "M. A",
  etage: "2",
  notes: null,
  montantTotalHT: null,
  lignes: [{ type: "ligne", designation: " Remplacer joint ", qte: 2, unite: "u", prixUnitaire: null, tva: null }],
  avertissements: [],
};

describe("contrat de lecture", () => {
  it("accepte une extraction conforme et nettoie les textes", () => {
    const r = schemaReponse.parse({ extraction: lu });
    if (!("extraction" in r)) throw new Error("extraction attendue");
    expect(r.extraction.client).toBe("OPAC du Rhône");
    expect(r.extraction.lignes[0]?.designation).toBe("Remplacer joint");
  });

  it("une date qui n'est pas AAAA-MM-JJ ne passe pas dans le formulaire", () => {
    const r = schemaReponse.parse({ extraction: lu });
    expect("extraction" in r && r.extraction.dateFinTravaux).toBeNull();
  });

  it("un statut de logement inventé est écarté, pas recopié", () => {
    const r = schemaReponse.parse({ extraction: { ...lu, logementStatut: "habité" } });
    expect("extraction" in r && r.extraction.logementStatut).toBeNull();
  });

  it("refuse une forme inattendue (lignes qui ne sont pas un tableau)", () => {
    expect(schemaReponse.safeParse({ extraction: { ...lu, lignes: "aucune" } }).success).toBe(false);
  });

  it("transmet le message d'erreur du service", () => {
    expect(schemaReponse.parse({ erreur: "Fichier trop volumineux" })).toEqual({ erreur: "Fichier trop volumineux" });
  });
});

describe("essentiels et préremplissage", () => {
  it("signale numéro, adresse et lignes manquants", () => {
    expect(essentielsManquants({ numeroBC: null, adresse: " ", lignes: [{ type: "chapitre", designation: "Lot 1", qte: null, unite: null, prixUnitaire: null, tva: null }] })).toHaveLength(3);
    expect(essentielsManquants({ numeroBC: "1", adresse: "x", lignes: [{ type: "ligne", designation: "y", qte: null, unite: null, prixUnitaire: null, tva: null }] })).toEqual([]);
  });

  it("le lieu lu devient le lieu d'intervention, jamais l'adresse du client", () => {
    const r = schemaReponse.parse({ extraction: lu });
    if (!("extraction" in r)) throw new Error();
    expect(versPreRemplissage(r.extraction, "c1")).toMatchObject({ client_id: "c1", numero_bc: "BC-2026-77", adresse_locataire: "14 rue Garibaldi, apt 21", date_reception: "2026-09-20", lignes: [{ designation: "Remplacer joint", quantite: 2, prix_unitaire: null }] });
  });
});

describe("refusFichier", () => {
  it.each([
    [{ type: "image/heic", size: 10 }, /HEIC/],
    [{ type: "application/pdf", size: 15 * 1024 * 1024 }, /14 Mo/],
    [{ type: "application/pdf", size: 0 }, /vide/],
  ])("%o", (f, motif) => expect(refusFichier(f)).toMatch(motif));
  it("accepte un PDF raisonnable", () => expect(refusFichier({ type: "application/pdf", size: 200_000 })).toBeNull());
});
