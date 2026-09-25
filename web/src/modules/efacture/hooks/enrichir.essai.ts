import { jsPDF } from "jspdf";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { chargeEN16931 } from "../domain/norme";
import { enrichirFacturX } from "./useEfacture";

const api = vi.hoisted(() => ({ preparerEmission: vi.fn(), deposerFacture: vi.fn() }));
vi.mock("../api/emission", async (original) => ({ ...(await original<typeof import("../api/emission")>()), ...api }));

const pdf = () => new Blob([new jsPDF().output("arraybuffer")], { type: "application/pdf" });
const charge = chargeEN16931(
  { numero: "FAC-2026-000009", date: "2026-09-15", totalHt: 100, totalTva: 20, totalTtc: 120 },
  { nom: "ALPHA", siren: "732829320" },
  { nom: "OPH", siret: "27380003700015" },
  [{ designation: "Pose", quantite: 1, prixUnitaire: 100, montantHt: 100, tva: 20 }]
);

beforeEach(() => vi.clearAllMocks());
vi.spyOn(console, "error").mockImplementation(() => undefined);

describe("le PDF d'une facture émise emporte sa facture structurée (EFA-04)", () => {
  it("dossier complet : le fichier rendu porte factur-x.xml", async () => {
    api.preparerEmission.mockResolvedValue({ charge, manques: [] });
    const r = await enrichirFacturX(pdf(), "f1");
    expect(r.structuree).toBe(true);
    const texte = new TextDecoder("latin1").decode(await r.fichier.arrayBuffer());
    expect(texte).toContain("(factur-x.xml)");
    expect(texte).toContain("<ram:ID>FAC-2026-000009</ram:ID>");
  });

  it("un manque ne prive jamais du PDF : le fichier d'origine part, le motif est dit", async () => {
    api.preparerEmission.mockResolvedValue({ charge, manques: [{ code: "BR-FR-10", champ: "emetteur.siren", libelle: "Le SIREN de l'émetteur est obligatoire." }] });
    const origine = pdf();
    const r = await enrichirFacturX(origine, "f1");
    expect(r).toEqual({ fichier: origine, structuree: false, manques: ["Le SIREN de l'émetteur est obligatoire."] });
  });

  it("une panne de lecture non plus", async () => {
    api.preparerEmission.mockRejectedValue(new Error("réseau coupé"));
    const origine = pdf();
    const r = await enrichirFacturX(origine, "f1");
    expect(r.fichier).toBe(origine);
    expect(r.manques).toEqual(["réseau coupé"]);
  });
});
