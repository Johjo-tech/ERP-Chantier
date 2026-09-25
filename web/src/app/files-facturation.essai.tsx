import { screen, within } from "@testing-library/react";
import { isValidElement } from "react";
import type { RouteObject } from "react-router";
import { describe, expect, it } from "vitest";
import { fileValidation } from "@/modules/commandes/domain/files";
import type { CircuitDuBon } from "@/modules/commandes/domain/workflow";
import { OngletsFacturation } from "@/modules/facturation/components/OngletsFacturation";
import { rendreAvecSession } from "@/test/session-factice";
import { NAVIGATION } from "./navigation";
import { routes } from "./routes";

/**
 * Relecture 4, B3 : la fusion avait laissé deux files « Validation » (et deux
 * « À facturer »), l'une sous l'onglet Facturation, l'autre au menu, qui ne
 * montraient pas les mêmes bons — un bon clôturé sans facturation ou déjà
 * facturé restait dans la première. Il n'en reste qu'une : les anciennes
 * adresses y mènent, l'onglet et le menu pointent au même endroit.
 */
function chercher(liste: readonly RouteObject[], chemin: string): RouteObject | undefined {
  for (const r of liste) {
    if (r.path === chemin) return r;
    const dedans = r.children ? chercher(r.children, chemin) : undefined;
    if (dedans) return dedans;
  }
  return undefined;
}

function redirection(chemin: string): unknown {
  const el = chercher(routes, chemin)?.element;
  return isValidElement<{ to?: unknown }>(el) ? el.props.to : undefined;
}

const circuit: CircuitDuBon = {
  nbTaches: 2,
  tachesNonPointees: [],
  metiersFait: {},
  dateOrigineFait: true,
  valideConducteur: true,
  valideDirecteur: false,
  piece: { pieceACommander: false, description: "", fournisseur: "", dateCommande: "", recueLe: "" },
};

describe("une seule file Validation, une seule À facturer", () => {
  it("les anciennes adresses de l'onglet Facturation mènent aux files du menu", () => {
    expect(redirection("factures/validation")).toBe("/facturation/validation");
    expect(redirection("factures/a-facturer")).toBe("/facturation/a-facturer");
  });

  it("l'onglet Facturation et le menu principal pointent aux mêmes adresses", () => {
    rendreAvecSession(<OngletsFacturation />, { role: "admin", chemin: "/factures" });
    const onglets = within(screen.getByRole("navigation", { name: "Facturation" }));
    const menu = new Map(NAVIGATION.map((e) => [e.libelle, e.chemin]));
    for (const libelle of ["Validation", "À facturer"]) {
      expect(onglets.getByRole("link", { name: libelle })).toHaveAttribute("href", menu.get(libelle));
    }
  });

  it("un bon au circuit clos (clôturé sans facturation, ou déjà facturé) n'est pas dans la file", () => {
    const clos = { id: "b1", statut_workflow: "cloture_gratuit", circuit, factures: [] as unknown[] };
    const facture = { id: "b2", statut_workflow: "en_cours", circuit, factures: [{ id: "f1" }] as unknown[] };
    expect(fileValidation([clos, facture])).toEqual([]);
  });
});
