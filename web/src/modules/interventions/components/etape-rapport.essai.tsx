import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { saisieInitiale } from "../domain/assistant";
import { EtapeRapport } from "./EtapesSuite";

/**
 * DEF-COR-28 (PLN-51, D-ECR-PLN-08, D-ECR-PLN-09) : l'ancien imprimait un
 * brouillon jamais enregistré, et son bouton IA appelait le fournisseur depuis
 * le navigateur, sans clé — un échec par construction.
 */
describe("rapport, étape 4 (DEF-COR-28)", () => {
  it("« Imprimer / PDF » et « Envoyer par email » passent par l'enregistrement", async () => {
    const imprimer = vi.fn();
    render(<EtapeRapport saisie={saisieInitiale("2026-09-28", "09:00", null)} onChange={() => undefined} onImprimer={imprimer} enCours={false} />);
    await userEvent.click(screen.getByRole("button", { name: "Imprimer / PDF" }));
    await userEvent.click(screen.getByRole("button", { name: "Envoyer par email" }));
    expect(imprimer).toHaveBeenCalledTimes(2);
  });

  it("le bouton IA dit franchement que la génération n'est pas disponible, sans rien appeler", async () => {
    const alerte = vi.spyOn(window, "alert").mockImplementation(() => undefined);
    const saisie = { ...saisieInitiale("2026-09-28", "09:00", null), constatations: "Fuite sous évier" };
    render(<EtapeRapport saisie={saisie} onChange={() => undefined} onImprimer={() => undefined} enCours={false} />);
    await userEvent.click(screen.getByRole("button", { name: "✨ Générer / améliorer avec l'IA" }));
    expect(alerte).toHaveBeenCalledWith("La génération automatique n'est pas disponible : complétez le rapport manuellement.");
    alerte.mockRestore();
  });
});
