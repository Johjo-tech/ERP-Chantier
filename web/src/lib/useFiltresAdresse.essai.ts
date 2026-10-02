import { describe, expect, it } from "vitest";
import { pourLeConducteur, DESTINATIONS } from "@/modules/statistiques/domain/pilotage";
import { ecrireFiltres, lireFiltres } from "./useFiltresAdresse";
import { montantsCherchables } from "./recherche";
import { montant } from "./money";

const VIDES = { recherche: "", statut: "", client: "" };

describe("filtres dans l'adresse (D-CLI-10)", () => {
  it("lit les clés connues, ignore les autres, garde les défauts", () => {
    expect(lireFiltres(new URLSearchParams("statut=envoy%C3%A9&intrus=1"), VIDES)).toEqual({ recherche: "", statut: "envoyé", client: "" });
  });

  it("n'écrit ni valeur vide ni défaut, et laisse les paramètres qui ne sont pas des filtres", () => {
    const p = ecrireFiltres(new URLSearchParams("page=2&client=X"), { recherche: "joint", statut: "", client: "" }, VIDES);
    expect(p.toString()).toBe("page=2&recherche=joint");
  });

  it("le tableau de bord d'un conducteur ouvre SES bons ; sans fiche, la liste entière", () => {
    expect(DESTINATIONS.sav).toBe("/commandes?type=sav");
    expect(pourLeConducteur(DESTINATIONS.sav, "k1", "conducteurId")).toBe("/commandes?type=sav&conducteurId=k1");
    expect(pourLeConducteur(DESTINATIONS.aValiderConducteur, "Christophe Conducteur", "conducteur")).toBe("/planning?conducteur=Christophe+Conducteur");
    expect(pourLeConducteur(DESTINATIONS.aValiderConducteur, null, "conducteur")).toBe("/planning");
    expect(new URLSearchParams(DESTINATIONS.devisEnAttente.split("?")[1]).get("statut")).toBe("envoyé");
  });
});

describe("montants cherchables (TRV-06)", () => {
  it("la forme affichée et la forme décimale, au centime", () => {
    expect(montantsCherchables(montant("1234.5"), montant("-12.345"))).toEqual(["1 234,50 €", "1234.50", "-12,35 €", "-12.35"]);
  });
});
