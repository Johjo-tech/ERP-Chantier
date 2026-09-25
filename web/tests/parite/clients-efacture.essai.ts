/**
 * Parité des blocs de la fiche client par cadre de facturation (CLI-03,
 * CLI-05) : sections visibles, champs attendus, complétude, adresse
 * électronique proposée — contre `regles-efacture.ts` importé tel quel.
 */
import { describe, expect, it } from "vitest";
import * as ancien from "../../../src/api/regles-efacture";
import * as nouveau from "../../src/modules/clients/domain/efacture";
import { generateur } from "./aleatoire";

const g = generateur(20260926);
const CADRES = ["B2C", "B2B_national", "B2G", "B2B_international", null, undefined] as const;
const VALEURS = ["", " ", null, undefined, "x", "Lyon"];

describe("parité e-facture de la fiche client", () => {
  it("sections et champs attendus, cadre par cadre", () => {
    for (const c of CADRES) {
      expect(nouveau.sectionsEfactureVisibles(c)).toEqual(ancien.sectionsEfactureVisibles(c));
      expect(nouveau.champsAttendus(c)).toEqual(ancien.champsAttendus(c));
      expect(nouveau.relveDeLaFactureElectronique(c)).toBe(ancien.relveDeLaFactureElectronique(c));
    }
  });

  it("1 000 fiches tirées : même complétude, même phrase, même adresse proposée", () => {
    for (let i = 0; i < 1000; i++) {
      const fiche = {
        nom: g.parmi(VALEURS), adresse: g.parmi(VALEURS), codePostal: g.parmi(VALEURS), ville: g.parmi(VALEURS),
        siret: g.parmi([...VALEURS, g.chiffres(14), `${g.chiffres(3)} ${g.chiffres(3)} ${g.chiffres(3)} ${g.chiffres(5)}`]),
        siren: g.parmi([...VALEURS, g.chiffres(9), g.chiffres(8)]),
        tvaIntracom: g.parmi(VALEURS), adresseElectroniqueValeur: g.parmi(VALEURS),
        codeService: g.parmi(VALEURS), referenceEngagement: g.parmi(VALEURS),
        cadreFacturation: g.parmi([...CADRES]),
      };
      const manques = nouveau.completudeClient(fiche);
      expect(manques).toEqual(ancien.completudeClient(fiche));
      expect(nouveau.phraseManques(manques)).toBe(ancien.messageAnomalies(ancien.completudeClient(fiche)));
      expect(nouveau.adresseElectroniqueParDefaut(fiche)).toEqual(ancien.adresseElectroniqueParDefaut(fiche));
    }
  });
});
