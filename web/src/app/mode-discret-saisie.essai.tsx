import { act, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { Route, Routes } from "react-router";
import { afterEach, describe, expect, it } from "vitest";
import { Layout } from "@/app/Layout";
import { definirModeDiscret, formatEurosEcran, useModeDiscret } from "@/lib/modeDiscret";
import { montant } from "@/lib/money";
import { rendreAvecSession } from "@/test/session-factice";

/** Un formulaire quelconque : une saisie non encore enregistrée (brouillon de devis, de facture…). */
function Formulaire() {
  useModeDiscret();
  const [designation, setDesignation] = useState("");
  return (
    <>
      <label>
        Désignation
        <input value={designation} onChange={(e) => setDesignation(e.target.value)} />
      </label>
      <output aria-label="Total">{formatEurosEcran(montant(1250))}</output>
    </>
  );
}

describe("mode discret pendant une saisie", () => {
  afterEach(() => definirModeDiscret(false));

  it("basculer le mode discret ne perd pas ce qui est en cours de saisie", async () => {
    rendreAvecSession(
      <Routes>
        <Route element={<Layout />}>
          <Route path="*" element={<Formulaire />} />
        </Route>
      </Routes>,
      { role: "admin", chemin: "/devis/nouveau" }
    );
    await userEvent.type(screen.getByLabelText("Désignation"), "Réfection salle de bains");
    // Le cas d'usage du mode : on reçoit un client en pleine saisie et on masque les montants.
    act(() => definirModeDiscret(true));
    expect(screen.getByLabelText("Désignation")).toHaveValue("Réfection salle de bains");
    // … et le montant, lui, s'est bien masqué (il s'est redessiné sans que l'écran remonte).
    expect(screen.getByLabelText("Total")).toHaveTextContent("••• €");
    act(() => definirModeDiscret(false));
    expect(screen.getByLabelText("Total")).not.toHaveTextContent("••• €");
    expect(screen.getByLabelText("Désignation")).toHaveValue("Réfection salle de bains");
  });
});
