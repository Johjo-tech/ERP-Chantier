import { describe, expect, it } from "vitest";
import { avancementChantier } from "./dpgf";

describe("avancementChantier", () => {
  it("DPGF chiffré à 2 855 € HT, facturé en partie", () => {
    const a = avancementChantier([
      { type: "chapitre", quantite: 0, prix_unitaire: 0, avancement_cumule: 0 },
      { type: "ligne", quantite: 10, prix_unitaire: 227.5, avancement_cumule: 100 },
      { type: "ligne", quantite: 1, prix_unitaire: 580, avancement_cumule: 45 },
    ]);
    expect(a.total.toString()).toBe("2855");
    expect(a.facture.toString()).toBe("2536");
    expect(a.reste.toString()).toBe("319");
    expect(a.pourcentage).toBe(89);
  });

  it("un DPGF vide ou sans ligne chiffrée vaut 0 %", () => {
    expect(avancementChantier([]).pourcentage).toBe(0);
    expect(avancementChantier([{ type: "chapitre", quantite: 3, prix_unitaire: 9, avancement_cumule: 50 }]).total.toString()).toBe("0");
  });

  it("reste exact là où le flottant dérivait", () => {
    const a = avancementChantier([{ type: "ligne", quantite: 3, prix_unitaire: 0.1, avancement_cumule: 33 }]);
    expect(a.total.toString()).toBe("0.3");
    expect(a.facture.toString()).toBe("0.099");
  });
});
