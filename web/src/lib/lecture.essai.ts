import { describe, expect, it } from "vitest";
import { z } from "zod";
import { messageErreur } from "./erreurs";
import { ListeTronquee, lireTout } from "./lecture";

const schema = z.object({ id: z.number() });
const lignes = (n: number) => Array.from({ length: n }, (_, i) => ({ id: i }));

/** Un serveur qui plafonne chaque réponse à `plafond` lignes et annonce le vrai compte. */
function serveur(total: number, plafond: number, compte: number | null = total) {
  const appels: [number, number][] = [];
  const lire = (debut: number, fin: number) => {
    appels.push([debut, fin]);
    const page = lignes(total).slice(debut, Math.min(fin + 1, debut + plafond));
    return Promise.resolve({ data: page, error: null, count: compte });
  };
  return { lire, appels };
}

describe("lireTout (TRV-10)", () => {
  it("lit toutes les pages jusqu'au compte annoncé", async () => {
    const s = serveur(2500, 1000);
    expect(await lireTout(s.lire, schema, "liste d'essai")).toHaveLength(2500);
    expect(s.appels).toEqual([[0, 999], [1000, 1999], [2000, 2999]]);
  });

  it("un serveur qui plafonne plus bas que la page ne tronque pas la liste : on repart de ce qui a été lu", async () => {
    const s = serveur(1200, 500);
    const tout = await lireTout(s.lire, schema, "liste d'essai");
    expect(tout.map((l) => l.id)).toEqual(lignes(1200).map((l) => l.id));
  });

  it("une lecture qui n'atteint pas le compte est un REFUS, jamais une liste partielle", async () => {
    // Le compte annonce 1500 lignes, mais le serveur n'en rend que 1000 puis plus rien.
    const s = serveur(1000, 1000, 1500);
    const erreur = await lireTout(s.lire, schema, "liste des clients").catch((e: unknown) => e);
    expect(erreur).toBeInstanceOf(ListeTronquee);
    expect(messageErreur(erreur)).toMatch(/liste des clients est incomplète \(1000 lignes sur 1500\)/);
  });

  it("sans compte demandé, s'arrête sur une page courte (comportement de `parPages`)", async () => {
    const s = serveur(10, 1000, null);
    expect(await lireTout(s.lire, schema, "liste d'essai")).toHaveLength(10);
  });

  it("une erreur de la base remonte telle quelle", async () => {
    const refus = { code: "42501", message: "refus" };
    await expect(lireTout(() => Promise.resolve({ data: null, error: refus }), schema, "x")).rejects.toBe(refus);
  });
});
