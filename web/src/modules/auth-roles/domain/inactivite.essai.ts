import { describe, expect, it } from "vitest";
import { DELAI_INACTIVITE_MS, estInactif, lireHeure } from "./inactivite";

describe("inactivité (D-AUTH-SEC-01)", () => {
  const t0 = 1_700_000_000_000;

  it("une heure pile sans geste suffit à déconnecter, une minute de moins non", () => {
    expect(estInactif(t0, t0 + DELAI_INACTIVITE_MS)).toBe(true);
    expect(estInactif(t0, t0 + DELAI_INACTIVITE_MS - 60_000)).toBe(false);
  });

  it("sans heure connue, on ne déconnecte pas sur un doute", () => {
    expect(estInactif(null, t0)).toBe(false);
    expect(lireHeure(null)).toBeNull();
    expect(lireHeure("abc")).toBeNull();
    expect(lireHeure("-5")).toBeNull();
    expect(lireHeure(String(t0))).toBe(t0);
  });
});
