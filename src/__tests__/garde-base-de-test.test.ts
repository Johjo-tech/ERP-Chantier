/**
 * Le garde-fou qui empêche les suites d'intégration d'écrire en production.
 *
 * Elles créent des clients, des devis, des bons, et consomment des numéros de
 * facture que rien ne réattribue. Lancées contre le projet distant, elles
 * polluent la vraie base — c'est arrivé du 7 au 16 septembre 2026, et il a
 * fallu compter 1 017 bons de commande « CLIENT DE TEST » pour s'en apercevoir.
 *
 * La version d'avant se contentait de ne rien dire quand `.env.test.local`
 * manquait. C'est ce silence que ces tests rendent impossible.
 */

import { describe, it, expect } from "vitest";
import { baseLocale, refusBaseDistante } from "./setup";

describe("Reconnaître une base locale", () => {
  it("accepte la pile de développement", () => {
    expect(baseLocale("http://127.0.0.1:54321")).toBe(true);
    expect(baseLocale("http://localhost:54321")).toBe(true);
  });

  /* L'URL du projet distant est celle qui a fait les dégâts : elle doit être
     reconnue comme non locale, quelle que soit sa forme. */
  it("refuse un projet hébergé", () => {
    expect(baseLocale("https://tjhljjuvfosmnpmzgbnl.supabase.co")).toBe(false);
    expect(baseLocale("https://autre.supabase.co/")).toBe(false);
  });

  /* Un hôte qui *contient* « localhost » sans en être un ne doit pas passer :
     c'est le genre de nom qu'un tunnel de développement fabrique. */
  it("ne se laisse pas prendre à un nom qui ressemble", () => {
    expect(baseLocale("https://localhost.exemple.com")).toBe(false);
    expect(baseLocale("https://127.0.0.1.exemple.com")).toBe(false);
  });

  it("refuse une URL absente ou illisible", () => {
    expect(baseLocale(undefined)).toBe(false);
    expect(baseLocale(null)).toBe(false);
    expect(baseLocale("")).toBe(false);
    expect(baseLocale("pas une url")).toBe(false);
  });
});

describe("L'écart des suites qui écrivent", () => {
  it("laisse passer la pile locale", () => {
    expect(refusBaseDistante("http://127.0.0.1:54321", undefined)).toBeNull();
  });

  /* Le message doit dire CE QUI est visé et COMMENT en sortir : un refus sans
     l'un ni l'autre se contourne en supprimant la garde. */
  it("écarte le distant, en nommant la base et le remède", () => {
    const refus = refusBaseDistante("https://tjhljjuvfosmnpmzgbnl.supabase.co", undefined);
    expect(refus).toBeTruthy();
    expect(refus).toContain("tjhljjuvfosmnpmzgbnl");
    expect(refus).toContain(".env.test.local");
    expect(refus).toContain("TEST_BASE_DISTANTE_ASSUMEE");
  });

  it("refuse aussi quand l'URL manque — on ne devine pas la cible", () => {
    expect(refusBaseDistante(undefined, undefined)).toBeTruthy();
  });

  /* L'échappatoire est nommée pour qu'on la choisisse, pas pour qu'on la
     subisse : n'importe quelle autre valeur ne lève rien. */
  it("ne cède qu'au mot exact", () => {
    const url = "https://tjhljjuvfosmnpmzgbnl.supabase.co";
    expect(refusBaseDistante(url, "oui")).toBeNull();
    expect(refusBaseDistante(url, "OUI")).toBeNull();
    expect(refusBaseDistante(url, "1")).toBeTruthy();
    expect(refusBaseDistante(url, "true")).toBeTruthy();
    expect(refusBaseDistante(url, "")).toBeTruthy();
  });
});
