import { describe, expect, it } from "vitest";
import { lignesOntDuContenu, modeDuBon, montantAEnregistrer, numeroAEnregistrer, numeroSaisissable, refBonCommandeClient } from "./regles";

describe("numéro du bon (BC-31)", () => {
  it("un numéro saisi fait sortir du mode sans BC / en attente", () => {
    expect(numeroAEnregistrer("attente_bc", " CMD-1 ")).toEqual({ numero_bc: "CMD-1", sans_bc: false, en_attente_bc: false });
    expect(numeroAEnregistrer("sans_bc", "X")).toEqual({ numero_bc: "X", sans_bc: false, en_attente_bc: false });
  });

  it("champ vide : la sentinelle garde la trace du mode ; en mode normal, null et jamais \"\"", () => {
    expect(numeroAEnregistrer("attente_bc", "  ")).toEqual({ numero_bc: "En attente de BC", sans_bc: false, en_attente_bc: true });
    expect(numeroAEnregistrer("sans_bc", "")).toEqual({ numero_bc: "Sans BC", sans_bc: true, en_attente_bc: false });
    expect(numeroAEnregistrer("normal", "")).toEqual({ numero_bc: null, sans_bc: false, en_attente_bc: false });
  });

  it("une sentinelle ne se présente pas comme un numéro à corriger", () => {
    expect(numeroSaisissable("En attente de BC")).toBe("");
    expect(numeroSaisissable("CMD 1\nCMD 2")).toBe("CMD 1\nCMD 2");
    expect(modeDuBon({ sans_bc: true, en_attente_bc: true })).toBe("attente_bc");
  });

  it("la référence client (BT-13) est la première ligne utile (BC-32)", () => {
    expect(refBonCommandeClient("  BC-123 \nautre")).toBe("BC-123");
    expect(refBonCommandeClient("SAV-2026-000004")).toBeNull();
  });
});

describe("montant du bon (BC-33)", () => {
  it("un bon sans ligne garde son montant saisi", () => {
    expect(montantAEnregistrer([], 25323.48)).toBe(25323.48);
    expect(montantAEnregistrer([{ type: "chapitre", designation: "Plomberie" }], "471,5")).toBe(471.5);
  });

  it("dès qu'une ligne est renseignée, les lignes font foi (sans remise), arrondi au centime au bord", () => {
    const lignes = [
      { type: "ligne", designation: "Gaine", quantite: 3, prix_unitaire: 12.333, tva: 20 },
      { type: "ligne", designation: "", quantite: 1, prix_unitaire: 0, tva: 20 },
    ];
    expect(lignesOntDuContenu(lignes)).toBe(true);
    expect(montantAEnregistrer(lignes, 9999)).toBe(37);
  });

  it("une ligne à prix positif sans désignation compte (ancien test)", () => {
    expect(lignesOntDuContenu([{ type: "ligne", designation: "", prix_unitaire: "5" }])).toBe(true);
    expect(lignesOntDuContenu([{ type: "commentaire", designation: "Note", prix_unitaire: "5" }])).toBe(false);
  });
});
