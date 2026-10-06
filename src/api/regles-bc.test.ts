import { describe, expect, it } from "vitest";
import { cleNumeroDevis, devisCiteParLeBon } from "./regles-bc";

describe("cleNumeroDevis", () => {
  it.each([
    ["DEV-006275", "DEV6275"],
    ["dev 6275", "DEV6275"],
    ["DEV6275", "DEV6275"],
    ["D-2023-0147", "D2023147"],
  ])("« %s » se réduit à « %s »", (numero, cle) => {
    expect(cleNumeroDevis(numero)).toBe(cle);
  });
});

describe("devisCiteParLeBon", () => {
  const devis = [
    { id: "a", numero: "DEV-006275", client: "PLURALIS" },
    { id: "b", numero: "DEV-006276", client: "SDH" },
  ];

  it("lie le devis de l'ERP que le bon cite, quelle que soit la graphie", () => {
    expect(devisCiteParLeBon("DEV6275", devis, new Set())?.id).toBe("a");
  });

  it("ne trouve rien pour un devis fait sur Cegid, absent de l'ERP", () => {
    expect(devisCiteParLeBon("DEV6074", devis, new Set())).toBeNull();
  });

  it("ne lie pas une seconde fois un devis déjà lié à un autre bon", () => {
    expect(devisCiteParLeBon("DEV6275", devis, new Set(["a"]))).toBeNull();
  });

  it("écarte le devis d'un autre client quand le client du bon est connu", () => {
    expect(devisCiteParLeBon("DEV6275", devis, new Set(), "SDH")).toBeNull();
    expect(devisCiteParLeBon("DEV6275", devis, new Set(), "PLURALIS")?.id).toBe("a");
  });

  it("ne choisit pas entre deux devis qui répondent au même numéro", () => {
    const doublon = [...devis, { id: "c", numero: "DEV6275", client: "PLURALIS" }];
    expect(devisCiteParLeBon("DEV6275", doublon, new Set())).toBeNull();
  });

  it("ne cherche rien quand le bon ne cite pas de devis", () => {
    expect(devisCiteParLeBon(null, devis, new Set())).toBeNull();
    expect(devisCiteParLeBon("", devis, new Set())).toBeNull();
  });
});
