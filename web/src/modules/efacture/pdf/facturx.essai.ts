import { jsPDF } from "jspdf";
import { describe, expect, it } from "vitest";
import { embarquerFacturX, PdfNonEnrichissable } from "./facturx";
import { profilSRGB } from "./srgb";

const XML = `<?xml version="1.0" encoding="UTF-8"?>\n<rsm:CrossIndustryInvoice>Façade — 12,50 €</rsm:CrossIndustryInvoice>\n`;

function pdfJs(): Uint8Array {
  const d = new jsPDF();
  d.text("Facture FAC-2026-000001", 10, 10);
  return new Uint8Array(d.output("arraybuffer"));
}

const latin1 = (o: Uint8Array) => Array.from(o, (b) => String.fromCharCode(b)).join("");

/** Lit la DERNIÈRE table xref d'un PDF : numéro d'objet → offset. */
function derniereTable(texte: string): { entrees: Map<number, number>; trailer: string } {
  const startxref = Number([...texte.matchAll(/startxref\s+(\d+)/g)].pop()?.[1]);
  expect(texte.slice(startxref, startxref + 4)).toBe("xref");
  const [table = "", trailer = ""] = texte.slice(startxref).split("trailer");
  const lignes = table.split("\n").slice(1).filter(Boolean);
  const entrees = new Map<number, number>();
  for (let i = 0; i < lignes.length; ) {
    const [debut, nombre] = (lignes[i] ?? "").split(" ").map(Number) as [number, number];
    for (let k = 0; k < nombre; k++) entrees.set(debut + k, Number((lignes[i + 1 + k] ?? "").slice(0, 10)));
    i += nombre + 1;
  }
  return { entrees, trailer };
}

function objet(texte: string, offset: number): string {
  return texte.slice(offset, texte.indexOf("endobj", offset));
}

describe("PDF Factur-X par mise à jour incrémentale (EFA-04)", () => {
  const avant = pdfJs();
  const apres = embarquerFacturX(avant, XML, { numero: "FAC-2026-000001", date: "2026-09-15" });
  const texte = latin1(apres);
  const { entrees, trailer } = derniereTable(texte);

  it("ne touche à aucun octet du PDF rendu", () => {
    expect(apres.subarray(0, avant.length)).toEqual(avant);
  });

  it("chaque entrée de la nouvelle table pointe sur son objet ; /Prev sur l'ancienne table", () => {
    expect(entrees.size).toBe(6);
    for (const [n, off] of entrees) expect(texte.slice(off, off + `${n} 0 obj`.length)).toBe(`${n} 0 obj`);
    const ancienStart = /startxref\s+(\d+)/.exec(latin1(avant))?.[1];
    expect(trailer).toContain(`/Prev ${ancienStart}`);
    expect(trailer).toMatch(/\/ID \[/);
    expect(trailer).toMatch(/\/Info \d+ 0 R/);
    expect(texte.trimEnd().endsWith("%%EOF")).toBe(true);
  });

  it("le catalogue redéfini déclare la pièce jointe, sa relation, le XMP et l'intention de sortie", () => {
    const racine = Number(/\/Root (\d+) 0 R/.exec(trailer)?.[1]);
    const catalogue = objet(texte, entrees.get(racine) ?? -1);
    expect(catalogue).toMatch(/\/Type \/Catalog/);
    expect(catalogue).toMatch(/\/Pages \d+ 0 R/);
    expect(catalogue).toMatch(/\/AF \[\d+ 0 R\]/);
    expect(catalogue).toMatch(/\/EmbeddedFiles <<\/Names \[\(factur-x\.xml\) \d+ 0 R\]>>/);
    expect(catalogue).toMatch(/\/Metadata \d+ 0 R/);
    expect(catalogue).toMatch(/\/OutputIntents \[\d+ 0 R\]/);
    expect(texte).toMatch(/\/AFRelationship \/Data/);
    expect(texte).toMatch(/\/S \/GTS_PDFA1 \/OutputConditionIdentifier \(sRGB IEC61966-2\.1\)/);
    expect(texte).toContain("<fx:ConformanceLevel>EN 16931</fx:ConformanceLevel>");
    expect(texte).toContain("<fx:DocumentFileName>factur-x.xml</fx:DocumentFileName>");
  });

  it("le fichier embarqué est le XML, octet pour octet (UTF-8), avec sa longueur exacte", () => {
    const ef = [...entrees.entries()].map(([, off]) => objet(texte, off)).find((o) => o.includes("/Type /EmbeddedFile"));
    expect(ef).toBeDefined();
    const longueur = Number(/\/Length (\d+)/.exec(ef ?? "")?.[1]);
    const debut = (ef ?? "").indexOf("stream\n") + "stream\n".length;
    const octets = Uint8Array.from((ef ?? "").slice(debut, debut + longueur), (c) => c.charCodeAt(0));
    expect(new TextDecoder().decode(octets)).toBe(XML);
    expect((ef ?? "").slice(debut + longueur, debut + longueur + "\nendstream".length)).toBe("\nendstream");
  });

  it("le profil sRGB est embarqué entier, trois composantes", () => {
    expect(profilSRGB().length).toBe(588);
    expect(texte).toContain("/N 3 /Length 588>>");
  });

  it("refuse d'enrichir deux fois, ou ce qui n'est pas un PDF", () => {
    expect(() => embarquerFacturX(apres, XML, { numero: "X", date: "2026-09-15" })).toThrow(PdfNonEnrichissable);
    expect(() => embarquerFacturX(new TextEncoder().encode("bonjour"), XML, { numero: "X", date: "2026-09-15" })).toThrow(PdfNonEnrichissable);
  });
});
