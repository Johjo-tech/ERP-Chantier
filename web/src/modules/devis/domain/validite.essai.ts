import { describe, expect, it } from "vitest";
import { finDeValidite } from "./validite";

describe("finDeValidite", () => {
  it("ajoute la validité en jours nets", () => {
    expect(finDeValidite("2026-09-24", 30)).toBe("2026-10-24");
  });
  it("rien si la validité est nulle ou négative", () => {
    expect(finDeValidite("2026-09-24", 0)).toBeNull();
    expect(finDeValidite("2026-09-24", -5)).toBeNull();
  });
});
