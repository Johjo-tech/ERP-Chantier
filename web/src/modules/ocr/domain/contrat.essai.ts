import { describe, expect, it } from "vitest";
import { decisionPreparation, dimensionsCible, nomEnJpeg } from "../api/preparer";
import { analyserReponse, schemaReponse } from "./contrat";
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
    expect(versPreRemplissage(r.extraction, "c1", "2026-09-25")).toMatchObject({ client_id: "c1", numero_bc: "BC-2026-77", mode: "normal", adresse_locataire: "14 rue Garibaldi, apt 21", date_reception: "2026-09-20", logement_statut: "occupé", numero_logement: "21", occupant: "M. A", etage: "2", lignes: [{ designation: "Remplacer joint", quantite: 2, prix_unitaire: null, tva: null }] });
  });
});

describe("préremplissage complet (OCR-12, relecture 3 M2)", () => {
  it("sans numéro lu : « Sans BC » et date du jour ; interlocuteur, notes, facturation, montant et TVA des lignes transmis", () => {
    const r = schemaReponse.parse({ extraction: { ...lu, numeroBC: null, dateBC: null, interlocuteur: "Mme B", notes: "Clés chez la gardienne", facturationAdresse: "1 av. Siège", facturationVille: "Lyon", montantTotalHT: 471.5, lignes: [{ ...lu.lignes[0], tva: 5.5 }] } });
    if (!("extraction" in r)) throw new Error();
    expect(versPreRemplissage(r.extraction, null, "2026-09-25")).toMatchObject({
      mode: "sans_bc", date_reception: "2026-09-25", interlocuteur: "Mme B", notes: "Clés chez la gardienne",
      facturation_adresse: "1 av. Siège", facturation_ville: "Lyon", montant: 471.5, lignes: [{ tva: 5.5 }],
    });
  });
});

describe("lecture partiellement incertaine (OCR-31)", () => {
  it("un champ hors contrat est vidé et nommé, le reste est gardé", () => {
    const a = analyserReponse({ extraction: { ...lu, montantTotalHT: "beaucoup", lignes: [lu.lignes[0], { type: "ligne", designation: 42 }] } });
    if (!a || !("extraction" in a)) throw new Error("extraction attendue");
    expect(a.incertaine).toEqual(expect.arrayContaining(["montantTotalHT", "lignes"]));
    expect(a.extraction.montantTotalHT).toBeNull();
    expect(a.extraction.numeroBC).toBe("BC-2026-77");
    expect(a.extraction.lignes).toHaveLength(1);
  });

  it("une réponse sans extraction exploitable est illisible ; une réponse conforme n'est pas incertaine", () => {
    expect(analyserReponse({ extraction: "rien" })).toBeNull();
    expect(analyserReponse({ erreur: "Trop lourd" })).toEqual({ erreur: "Trop lourd" });
    expect(analyserReponse({ extraction: lu })).toMatchObject({ incertaine: [] });
  });
});

describe("préparation du document (OCR-10)", () => {
  it.each([
    [{ type: "image/heic", size: 10 }, "recompresser"],
    [{ type: "image/jpeg", size: 3_000_001 }, "recompresser"],
    [{ type: "image/png", size: 200_000 }, "tel_quel"],
    [{ type: "application/pdf", size: 200_000 }, "tel_quel"],
    [{ type: "application/pdf", size: 14_000_001 }, "refus"],
    [{ type: "application/zip", size: 10 }, "refus"],
  ])("%o → %s", (f, quoi) => expect(decisionPreparation(f).quoi).toBe(quoi));

  it("côté le plus long à 2 200 px, jamais agrandi ; le nom dit le JPEG", () => {
    expect(dimensionsCible(4400, 3300)).toEqual({ largeur: 2200, hauteur: 1650 });
    expect(dimensionsCible(800, 600)).toEqual({ largeur: 800, hauteur: 600 });
    expect(nomEnJpeg("bon client.heic")).toBe("bon client.jpg");
  });
});

