import { describe, expect, it } from "vitest";
import type { SocieteAccessible } from "./types";
import { societeRetenue, simulationRetenue } from "./selection";

const alpha: SocieteAccessible = { id: "a", code: "alpha", nom: "ALPHA", role: "admin", niveauAbonnement: null };
const beta: SocieteAccessible = { id: "b", code: "beta", nom: "BETA", role: "technicien", niveauAbonnement: null };

describe("societeRetenue", () => {
  it("reprend la société mémorisée si le compte y est encore membre", () => {
    expect(societeRetenue([alpha, beta], "b")).toBe(beta);
  });
  it("retombe sur la première si la mémoire désigne une société perdue", () => {
    expect(societeRetenue([alpha, beta], "zzz")).toBe(alpha);
    expect(societeRetenue([], "a")).toBeNull();
  });
});

describe("simulationRetenue", () => {
  it("n'a cours que pour un admin de la société active", () => {
    expect(simulationRetenue(alpha, "technicien")).toBe("technicien");
    expect(simulationRetenue(beta, "admin")).toBeNull();
  });
  it("ignore une valeur mémorisée qui n'est pas un rôle", () => {
    expect(simulationRetenue(alpha, "superadmin")).toBeNull();
    expect(simulationRetenue(alpha, null)).toBeNull();
  });
});
