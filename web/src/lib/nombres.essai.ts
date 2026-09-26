import { describe, expect, it } from "vitest";
import { schemaNombreFr } from "./nombres";

describe("schemaNombreFr", () => {
  it.each([
    ["1 234,56", 1234.56],
    ["12.5", 12.5],
    ["-3", -3],
    ["0", 0],
  ])("%s → %s", (saisie, attendu) => {
    expect(schemaNombreFr.parse(saisie)).toBe(attendu);
  });

  it.each(["", "abc", "12abc", "1,2,3", "--1"])("refuse « %s »", (saisie) => {
    expect(schemaNombreFr.safeParse(saisie).success).toBe(false);
  });
});
