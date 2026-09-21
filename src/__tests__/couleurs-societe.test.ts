/**
 * Les deux couleurs d'une société.
 *
 * La couleur dominante existait déjà et se déclinait en trois tons. Il en
 * manquait une seconde — celle des en-têtes de tableau et des cartouches, qui
 * étaient d'un gris n'appartenant à personne.
 *
 * La contrainte qui commande tout : un réglage qu'on n'a pas touché ne doit
 * RIEN changer à ce qu'on imprime. D'où un défaut secondaire égal au bleu
 * ardoise déjà employé par l'application, et une palette principale qui rend
 * la palette historique telle quelle plutôt que son recalcul.
 */

import { describe, it, expect } from "vitest";
import {
  ACCENT_DEFAUT,
  paletteSecondaire,
  paletteSociete,
  SECONDAIRE_DEFAUT,
} from "@/api/regles-theme";
import { REGLAGES_DEFAUT, fusionnerReglages } from "@/integrations/reglages";

describe("La seconde couleur", () => {
  it("retombe sur le bleu ardoise déjà employé, pour ne rien déplacer", () => {
    expect(paletteSecondaire(null).secondaire).toBe(SECONDAIRE_DEFAUT);
    expect(paletteSecondaire("").secondaire).toBe(SECONDAIRE_DEFAUT);
    expect(paletteSecondaire("pas une couleur").secondaire).toBe(SECONDAIRE_DEFAUT);
  });

  it("accepte la couleur choisie et la normalise en majuscules", () => {
    expect(paletteSecondaire("#1e8fd5").secondaire).toBe("#1E8FD5");
  });

  it("accepte la forme courte à trois chiffres", () => {
    expect(paletteSecondaire("#08f").secondaire).toBe("#0088FF");
  });

  it("choisit une encre lisible sur un fond sombre comme sur un fond clair", () => {
    expect(paletteSecondaire("#101D34").surSecondaire).toBe("#FFFFFF");
    expect(paletteSecondaire("#FFE066").surSecondaire).toBe("#182233");
  });

  it("dérive un fond de cartouche très clair, jamais la couleur pleine", () => {
    const p = paletteSecondaire("#1E8FD5");
    expect(p.secondaireClair).not.toBe(p.secondaire);
    /* Assez clair pour porter du texte sombre. */
    expect(p.secondaireClair.toUpperCase()).toMatch(/^#[0-9A-F]{6}$/);
  });
});

describe("Les deux couleurs ensemble", () => {
  it("rendent une palette complète, en un seul appel", () => {
    const p = paletteSociete("#1E8FD5", "#101D34");

    expect(p.accent).toBe("#1E8FD5");
    expect(p.secondaire).toBe("#101D34");
    expect(p.accentFonce).toBeDefined();
    expect(p.surSecondaire).toBe("#FFFFFF");
  });

  it("ne déplacent pas la palette historique quand rien n'est choisi", () => {
    /* Les trois tons d'origine ont été accordés à la main ; les recalculer
       déplacerait la teinte des documents de toutes les sociétés qui n'ont
       rien réglé. */
    const p = paletteSociete(null, null);

    expect(p.accent).toBe(ACCENT_DEFAUT);
    expect(p.accentFonce).toBe("#C24E00");
    expect(p.accentClair).toBe("#FFE7D6");
    expect(p.secondaire).toBe(SECONDAIRE_DEFAUT);
  });

  it("restent indépendantes : changer l'une ne touche pas l'autre", () => {
    const a = paletteSociete("#D92B4B", null);
    const b = paletteSociete(null, "#D92B4B");

    expect(a.secondaire).toBe(SECONDAIRE_DEFAUT);
    expect(b.accent).toBe(ACCENT_DEFAUT);
  });
});

describe("Le réglage voyage avec les autres", () => {
  it("a un défaut, et c'est le même que celui de la palette", () => {
    expect(REGLAGES_DEFAUT.documents.couleurSecondaire).toBe(SECONDAIRE_DEFAUT);
  });

  it("se relit d'un document de réglages", () => {
    const r = fusionnerReglages({ documents: { couleurSecondaire: "#1E8FD5" } });
    expect(r.documents.couleurSecondaire).toBe("#1E8FD5");
  });

  it("retombe sur le défaut quand il est absent — le cas de toutes les sociétés", () => {
    const r = fusionnerReglages({ documents: { couleurAccent: "#D92B4B" } });
    expect(r.documents.couleurAccent).toBe("#D92B4B");
    expect(r.documents.couleurSecondaire).toBe(SECONDAIRE_DEFAUT);
  });
});
