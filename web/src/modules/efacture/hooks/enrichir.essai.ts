// @vitest-environment node
// pdf-lib vérifie ses entrées par `instanceof Uint8Array` : sous jsdom, le TextEncoder
// rend un Uint8Array d'un autre royaume, que le navigateur, lui, ne produit jamais.
import { PDFArray, PDFDict, PDFDocument, PDFHexString, PDFName, PDFRawStream, decodePDFRawStream } from "pdf-lib";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { chargeEN16931 } from "../domain/norme";
import { enrichirFacturX } from "./useEfacture";

const api = vi.hoisted(() => ({ preparerEmission: vi.fn(), deposerFacture: vi.fn() }));
vi.mock("../api/emission", async (original) => ({ ...(await original<typeof import("../api/emission")>()), ...api }));

const rendu = await (async () => {
  const d = await PDFDocument.create();
  d.addPage();
  return d.save();
})();
const pdf = () => new Blob([rendu as BlobPart], { type: "application/pdf" });

/** Le XML embarqué sous le nom `factur-x.xml`, lu comme le lirait la machine du destinataire. */
async function xmlEmbarque(fichier: Blob): Promise<{ nom: string; xml: string }> {
  const doc = await PDFDocument.load(await fichier.arrayBuffer());
  const noms = doc.catalog.lookup(PDFName.of("Names"), PDFDict).lookup(PDFName.of("EmbeddedFiles"), PDFDict).lookup(PDFName.of("Names"), PDFArray);
  const flux = noms.lookup(1, PDFDict).lookup(PDFName.of("EF"), PDFDict).lookup(PDFName.of("F"));
  if (!(flux instanceof PDFRawStream)) throw new Error("pièce jointe illisible");
  return { nom: noms.lookup(0, PDFHexString).decodeText(), xml: new TextDecoder().decode(decodePDFRawStream(flux).decode()) };
}
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
    const { nom, xml } = await xmlEmbarque(r.fichier);
    expect(nom).toContain("factur-x.xml");
    expect(xml).toContain("<ram:ID>FAC-2026-000009</ram:ID>");
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
