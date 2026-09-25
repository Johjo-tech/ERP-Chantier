/**
 * Contrat entre deux modules : ce que la lecture automatique envoie doit être
 * accepté TEL QUEL par le formulaire de bon (un champ non lu vaut null, pas absent).
 */
import { describe, expect, it } from "vitest";
import { lignesDepuisPreRemplissage, lirePreRemplissage } from "../src/modules/commandes/domain/bon";
import { schemaReponse } from "../src/modules/ocr/domain/contrat";
import { versPreRemplissage } from "../src/modules/ocr/domain/prefill";

describe("OCR → formulaire de bon", () => {
  it("un préremplissage avec des champs non lus (null) est accepté et donne des lignes à relire", () => {
    const r = schemaReponse.parse({
      extraction: {
        client: null, numeroBC: "BC-9", dateBC: null, referenceChantier: null, natureTravaux: null, dateFinTravaux: null, interlocuteur: null,
        adresse: "3 rue X", codePostal: null, ville: null, facturationAdresse: null, facturationCodePostal: null, facturationVille: null,
        numeroLogement: null, logementStatut: null, occupant: null, etage: null, notes: null, montantTotalHT: null,
        lignes: [
          { type: "chapitre", designation: "Plomberie", qte: null, unite: null, prixUnitaire: null, tva: null },
          { type: "ligne", designation: "Remplacer joint", qte: null, unite: null, prixUnitaire: null, tva: null },
        ],
        avertissements: [],
      },
    });
    if (!("extraction" in r)) throw new Error("extraction attendue");
    const lu = lirePreRemplissage({ prefill: versPreRemplissage(r.extraction, null) });
    expect(lu).not.toBeNull();
    expect(lu?.numero_bc).toBe("BC-9");
    const lignes = lignesDepuisPreRemplissage(lu, 10);
    expect(lignes.map((l) => [l.type, l.designation, l.quantite])).toEqual([["chapitre", "Plomberie", "0"], ["ligne", "Remplacer joint", "1"]]);
  });
});
