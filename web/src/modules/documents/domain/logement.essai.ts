import { describe, expect, it } from "vitest";
import { nettoyerLogement, type ChampsLogement } from "./logement";

const tout: ChampsLogement = { logement_statut: null, occupant: "M. A", etage: "2", numero_logement: "21", precision_commune: "cave", ancien_locataire: "Mme B" };

describe("nettoyerLogement (parité cleanLogementFields)", () => {
  it.each([
    ["occupé", { occupant: "M. A", etage: "2", numero_logement: "21", precision_commune: null, ancien_locataire: null }],
    ["vacant", { occupant: null, etage: "2", numero_logement: "21", precision_commune: null, ancien_locataire: "Mme B" }],
    ["commune", { occupant: null, etage: null, numero_logement: null, precision_commune: "cave", ancien_locataire: null }],
    [null, { occupant: null, etage: null, numero_logement: null, precision_commune: null, ancien_locataire: null }],
  ] as const)("%s", (statut, attendu) => {
    expect(nettoyerLogement({ ...tout, logement_statut: statut })).toEqual({ ...attendu, logement_statut: statut });
  });
});
