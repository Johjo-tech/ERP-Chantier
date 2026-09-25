/**
 * Parité des formats d'affichage (TRV-01, TRV-05) contre `money` et
 * `moneyDisplay` de l'ancien écran, extraits de `app.js` et évalués (D-045).
 */
import { afterEach, describe, expect, it } from "vitest";
import { formatEuros, montant } from "../../src/lib/money";
import { definirModeDiscret, formatEurosEcran, MONTANT_MASQUE } from "../../src/lib/modeDiscret";
import { generateur } from "./aleatoire";
import { sourceDe } from "./source-app";

const g = generateur(20260926);
const TIRAGES = 3000;

const ancien = (state: { ghostMode: boolean }) =>
  new Function("state", `${sourceDe("money")}\n${sourceDe("moneyDisplay")}\nreturn { money, moneyDisplay };`)(state) as {
    money: (n: unknown) => string;
    moneyDisplay: (n: unknown) => string;
  };

/** Des montants au centime : c'est ce que portent les colonnes `numeric(…, 2)`. */
function centimesAleatoires(): number {
  const signe = g.reel() < 0.15 ? -1 : 1;
  const ordre = g.parmi([1, 100, 10_000, 1_000_000, 100_000_000]);
  return (signe * g.entier(0, ordre * 100)) / 100;
}

describe("parité des montants affichés", () => {
  afterEach(() => definirModeDiscret(false));

  it(`${TIRAGES} montants : même texte, espaces fines insécables comprises (U+202F, U+00A0)`, () => {
    const { money } = ancien({ ghostMode: false });
    for (let i = 0; i < TIRAGES; i++) {
      const n = centimesAleatoires();
      expect(formatEuros(montant(n)), String(n)).toBe(money(n));
    }
    expect(formatEuros(montant(1234.5))).toBe("1 234,50 €");
  });

  it("« rien » vaut 0,00 € comme `money(undefined)`", () => {
    const { money } = ancien({ ghostMode: false });
    for (const vide of [undefined, null, "", 0]) expect(formatEuros(montant(vide))).toBe(money(vide));
  });

  it("mode discret : « ••• € » partout à l'écran, comme `moneyDisplay`", () => {
    const { moneyDisplay } = ancien({ ghostMode: true });
    definirModeDiscret(true);
    for (const n of [0, 12.5, -1000, 1_234_567.89]) expect(formatEurosEcran(montant(n))).toBe(moneyDisplay(n));
    expect(formatEurosEcran(montant(5))).toBe(MONTANT_MASQUE);
    // La pièce imprimée, elle, garde ses montants.
    expect(formatEuros(montant(5))).toBe(ancien({ ghostMode: true }).money(5));
  });

  it("hors mode discret, l'écran montre le montant exact", () => {
    const { moneyDisplay } = ancien({ ghostMode: false });
    expect(formatEurosEcran(montant(987.65))).toBe(moneyDisplay(987.65));
  });
});
