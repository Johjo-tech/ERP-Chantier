// @vitest-environment node
// pdf-lib vérifie ses entrées par `instanceof Uint8Array` : sous jsdom, le TextEncoder
// rend un Uint8Array d'un autre royaume, que le navigateur, lui, ne produit jamais.
import { PDFArray, PDFDict, PDFDocument, PDFHexString, PDFName, PDFRawStream, decodePDFRawStream } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { embarquerFacturX } from "./facturx";
import { profilSRGB } from "./srgb";

const XML = `<?xml version="1.0" encoding="UTF-8"?>\n<rsm:CrossIndustryInvoice>Façade — 12,50 €</rsm:CrossIndustryInvoice>\n`;

async function pdfRendu(): Promise<Uint8Array> {
  const d = await PDFDocument.create();
  d.addPage([595, 842]).drawText("Facture FAC-2026-000001");
  return d.save();
}

/** Un flux brut, ou l'échec du test : pdf-lib type ses objets au plus large. */
function brut(o: unknown): PDFRawStream {
  if (!(o instanceof PDFRawStream)) throw new Error("flux attendu");
  return o;
}
const texteDe = (flux: PDFRawStream) => new TextDecoder().decode(decodePDFRawStream(flux).decode());

describe("PDF Factur-X : le même assemblage pdf-lib que l'ancien (EFA-04, D-PDF-05)", async () => {
  const sortie = await embarquerFacturX(await pdfRendu(), XML, { numero: "FAC-2026-000001", date: "2026-09-15", emetteur: "ALPHA Rénovation" });
  const doc = await PDFDocument.load(sortie);
  const cat = doc.catalog;

  it("la page lue par l'humain reste la même", () => {
    expect(doc.getPageCount()).toBe(1);
    expect(doc.getTitle()).toBe("Facture FAC-2026-000001");
    expect(doc.getAuthor()).toBe("ALPHA Rénovation");
    // Comme l'ancien : `save()` réécrit le producteur (pdf-lib) par-dessus « ERP-Chantier ».
    expect(doc.getProducer()).toMatch(/^pdf-lib/);
  });

  it("la pièce jointe s'appelle factur-x.xml, relation Data, et porte le XML octet pour octet", () => {
    const noms = cat.lookup(PDFName.of("Names"), PDFDict).lookup(PDFName.of("EmbeddedFiles"), PDFDict).lookup(PDFName.of("Names"), PDFArray);
    expect(noms.lookup(0, PDFHexString).decodeText()).toBe("factur-x.xml");
    const spec = noms.lookup(1, PDFDict);
    expect(spec.get(PDFName.of("AFRelationship"))).toBe(PDFName.of("Data"));
    const fichier = brut(spec.lookup(PDFName.of("EF"), PDFDict).lookup(PDFName.of("F")));
    expect(texteDe(fichier)).toBe(XML);
    expect(cat.lookup(PDFName.of("AF"), PDFArray).size()).toBe(1);
  });

  it("le XMP déclare Factur-X EN 16931 et PDF/A-3 ; l'intention de sortie porte le profil sRGB", () => {
    const xmp = new TextDecoder().decode(brut(cat.lookup(PDFName.of("Metadata"))).contents);
    expect(xmp).toContain("<fx:ConformanceLevel>EN 16931</fx:ConformanceLevel>");
    expect(xmp).toContain("<fx:DocumentFileName>factur-x.xml</fx:DocumentFileName>");
    expect(xmp).toContain("<pdfaid:part>3</pdfaid:part>");
    const intention = cat.lookup(PDFName.of("OutputIntents"), PDFArray).lookup(0, PDFDict);
    expect(intention.get(PDFName.of("S"))).toBe(PDFName.of("GTS_PDFA1"));
    const icc = brut(intention.lookup(PDFName.of("DestOutputProfile")));
    expect(decodePDFRawStream(icc).decode().length).toBe(profilSRGB().length);
  });
});
