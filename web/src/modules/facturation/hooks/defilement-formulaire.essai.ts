import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDefilementFormulaire } from "./useDefilementFormulaire";

describe("défilement jusqu'au formulaire de facture", () => {
  let zone: HTMLDivElement;
  let defiler: ReturnType<typeof vi.fn<(arg?: boolean | ScrollIntoViewOptions) => void>>;
  beforeEach(() => {
    zone = document.createElement("div");
    zone.id = "formZoneFacture";
    defiler = vi.fn<(arg?: boolean | ScrollIntoViewOptions) => void>();
    zone.scrollIntoView = defiler;
    document.body.appendChild(zone);
  });
  afterEach(() => zone.remove());

  it("attend que l'en-tête soit posé : lancé plus tôt, il s'arrêtait 16 px trop haut sur téléphone", () => {
    const { rerender } = renderHook(({ pret }) => useDefilementFormulaire("formZoneFacture", pret, "nouvelle"), { initialProps: { pret: false } });
    expect(defiler).not.toHaveBeenCalled();
    rerender({ pret: true });
    expect(defiler).toHaveBeenCalledTimes(1);
    expect(defiler).toHaveBeenCalledWith({ behavior: "smooth", block: "start" });
  });

  it("une fois par pièce : un nouveau rendu ne ramène pas l'écran en haut du formulaire, une autre pièce si", () => {
    const { rerender } = renderHook(({ cle }) => useDefilementFormulaire("formZoneFacture", true, cle), { initialProps: { cle: "f1" } });
    rerender({ cle: "f1" });
    expect(defiler).toHaveBeenCalledTimes(1);
    rerender({ cle: "f2" });
    expect(defiler).toHaveBeenCalledTimes(2);
  });
});
