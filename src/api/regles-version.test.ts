import { describe, expect, it } from "vitest";
import { versionChangee, versionDuHtml } from "./regles-version";

describe("versionDuHtml", () => {
  it("lit le marqueur posé par la construction", () => {
    const html = `<head><meta charset="utf-8"><meta name="version-construite" content="fbf3c75 · 2026-10-01 08:06"></head>`;
    expect(versionDuHtml(html)).toBe("fbf3c75 · 2026-10-01 08:06");
  });

  it("accepte l'attribut content placé avant name", () => {
    expect(versionDuHtml(`<meta content="abc1234 · x" name="version-construite">`)).toBe("abc1234 · x");
  });

  it("rend null quand la page n'en porte pas", () => {
    expect(versionDuHtml("<html><head></head></html>")).toBeNull();
  });
});

describe("versionChangee", () => {
  it("un onglet resté sur le bundle d'avant le déploiement", () => {
    expect(versionChangee("e8bac74 · 2026-10-01 08:02", "fbf3c75 · 2026-10-01 08:06")).toBe(true);
  });

  it("la même version : rien à signaler", () => {
    expect(versionChangee("fbf3c75 · x", "fbf3c75 · x")).toBe(false);
  });

  it("une reconstruction du même commit ne demande pas de recharger", () => {
    expect(versionChangee("fbf3c75 · 2026-10-01 08:06", "fbf3c75 · 2026-10-01 09:40")).toBe(false);
  });

  it("le séparateur mal décodé ne fait pas croire à une nouvelle version", () => {
    expect(versionChangee("fbf3c75 Â· 2026-10-01 08:06", "fbf3c75 · 2026-10-01 08:06")).toBe(false);
  });

  it("dans le doute, aucun bandeau", () => {
    expect(versionChangee("inconnue", "fbf3c75 · x")).toBe(false);
    expect(versionChangee("fbf3c75 · x", null)).toBe(false);
    expect(versionChangee("", "")).toBe(false);
  });
});
