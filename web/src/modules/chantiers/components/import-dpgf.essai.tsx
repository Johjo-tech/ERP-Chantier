import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { LigneDpgfBase } from "../api/dpgf";
import { ImportDpgf } from "./ImportDpgf";

const importer = vi.hoisted(() => ({ mutate: vi.fn(), isPending: false }));
vi.mock("../hooks/useChantiers", () => ({ useImporterDpgf: () => importer }));

const ligne = (id: string, position: number): LigneDpgfBase => ({
  id, chantier_id: "ch1", position, type: "ligne", designation: `Ligne ${id}`, quantite: 1, prix_unitaire: 100, unite: "u",
  avancement_cumule: 0, devis_source_id: null, metier: null,
});
const csv = () => new File(["Désignation;Qté;PU\nCarrelage;10;25\n"], "dpgf.csv", { type: "text/csv" });

/**
 * DEF-COR-06 / D-CHA-07 : l'ancien remplaçait le DPGF sans rien dire, lignes
 * facturées comprises. L'annonce avait disparu au passage « identique à
 * l'ancienne » du 26/09 ; elle est remise, et seulement quand il y a des lignes.
 */
describe("import du DPGF : ce qui est remplacé est annoncé (DEF-COR-06)", () => {
  it("annonce les lignes remplacées et celles, figées, qui restent ; seules les non figées partent", async () => {
    render(<ImportDpgf chantierId="ch1" fichier={csv()} lignes={[ligne("a", 0), ligne("b", 1), ligne("f", 2)]} figees={new Set(["f"])} fermer={() => undefined} />);
    expect(await screen.findByText(/L'import remplace les 2 ligne\(s\) actuelle\(s\) du DPGF ; 1 ligne\(s\) déjà facturée\(s\) ou planifiée\(s\) sont conservées\./)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Importer ces lignes" }));
    expect(importer.mutate).toHaveBeenCalledWith(expect.objectContaining({ aRemplacer: ["a", "b"], positionSuivante: 3 }), expect.anything());
  });

  it("un DPGF vide n'annonce rien : la modale reste celle de l'ancien", async () => {
    render(<ImportDpgf chantierId="ch1" fichier={csv()} lignes={[]} figees={new Set()} fermer={() => undefined} />);
    await screen.findByText("Importer le DPGF — indiquez les colonnes");
    expect(screen.queryByText(/L'import remplace/)).toBeNull();
  });
});
