import { describe, expect, it } from "vitest";
import type { Bloc } from "../domain/ppsps";
import { documentXml, ecrireDocx } from "./docx";
import { indiceColonne, lireClasseur } from "./xlsx";
import { crc32, ecrireZip, lireZip } from "./zip";

const e = new TextEncoder();
const d = new TextDecoder();

async function deflater(octets: Uint8Array): Promise<Uint8Array> {
  const source = new Response(octets as BodyInit).body;
  if (!source) throw new Error("flux vide");
  return new Uint8Array(await new Response(source.pipeThrough(new CompressionStream("deflate-raw"))).arrayBuffer());
}

/** Une archive dont une entrée est compressée (méthode 8), comme Excel les écrit. */
async function zipAvecDeflate(fichiers: { chemin: string; texte: string }[]): Promise<Uint8Array> {
  const morceaux: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let decalage = 0;
  for (const f of fichiers) {
    const brut = e.encode(f.texte);
    const comprime = await deflater(brut);
    const nom = e.encode(f.chemin);
    const l = new DataView(new ArrayBuffer(30));
    l.setUint32(0, 0x04034b50, true);
    l.setUint16(8, 8, true);
    l.setUint32(14, crc32(brut), true);
    l.setUint32(18, comprime.length, true);
    l.setUint32(22, brut.length, true);
    l.setUint16(26, nom.length, true);
    morceaux.push(new Uint8Array(l.buffer), nom, comprime);
    const c = new DataView(new ArrayBuffer(46));
    c.setUint32(0, 0x02014b50, true);
    c.setUint16(10, 8, true);
    c.setUint32(20, comprime.length, true);
    c.setUint32(24, brut.length, true);
    c.setUint16(28, nom.length, true);
    c.setUint32(42, decalage, true);
    central.push(new Uint8Array(c.buffer), nom);
    decalage += 30 + nom.length + comprime.length;
  }
  const taille = central.reduce((t, m) => t + m.length, 0);
  const fin = new DataView(new ArrayBuffer(22));
  fin.setUint32(0, 0x06054b50, true);
  fin.setUint16(8, fichiers.length, true);
  fin.setUint16(10, fichiers.length, true);
  fin.setUint32(12, taille, true);
  fin.setUint32(16, decalage, true);
  const tout = [...morceaux, ...central, new Uint8Array(fin.buffer)];
  const sortie = new Uint8Array(tout.reduce((t, m) => t + m.length, 0));
  let i = 0;
  for (const m of tout) {
    sortie.set(m, i);
    i += m.length;
  }
  return sortie;
}

describe("zip", () => {
  it("relit ce qu'il écrit, noms accentués compris", async () => {
    const z = ecrireZip([
      { chemin: "a.txt", contenu: e.encode("bonjour") },
      { chemin: "dossier/é.xml", contenu: e.encode("<x/>") },
    ]);
    const lu = await lireZip(z);
    expect(d.decode(lu.get("a.txt"))).toBe("bonjour");
    expect(d.decode(lu.get("dossier/é.xml"))).toBe("<x/>");
  });

  it("CRC-32 de référence", () => {
    expect(crc32(e.encode("123456789"))).toBe(0xcbf43926);
  });

  it("décompresse une entrée deflate", async () => {
    const z = await zipAvecDeflate([{ chemin: "t.txt", texte: "Réfection façade ".repeat(50) }]);
    expect(d.decode((await lireZip(z)).get("t.txt"))).toBe("Réfection façade ".repeat(50));
  });

  it("refuse ce qui n'est pas une archive", async () => {
    await expect(lireZip(e.encode("désignation;qté\nA;1"))).rejects.toThrow(/ZIP/);
  });
});

describe("xlsx", () => {
  it("indices de colonnes", () => {
    expect(indiceColonne("A1")).toBe(0);
    expect(indiceColonne("Z9")).toBe(25);
    expect(indiceColonne("AB12")).toBe(27);
  });

  it("lit feuilles, chaînes partagées, texte en ligne et trous", async () => {
    const z = await zipAvecDeflate([
      {
        chemin: "xl/workbook.xml",
        texte: `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Garde" sheetId="1" r:id="rId1"/><sheet name="DPGF" sheetId="2" r:id="rId2"/></sheets></workbook>`,
      },
      {
        chemin: "xl/_rels/workbook.xml.rels",
        texte: `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Target="/xl/worksheets/sheet2.xml"/></Relationships>`,
      },
      { chemin: "xl/sharedStrings.xml", texte: `<sst><si><t>Désignation</t></si><si><r><t>Peinture </t></r><r><t>murs</t></r></si></sst>` },
      { chemin: "xl/worksheets/sheet1.xml", texte: `<worksheet><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>Page de garde</t></is></c></row></sheetData></worksheet>` },
      {
        chemin: "xl/worksheets/sheet2.xml",
        texte: `<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="C1" t="str"><v>PU</v></c></row><row r="3"><c r="A3" t="s"><v>1</v></c><c r="B3"><v>12.5</v></c><c r="C3"><v>8</v></c></row></sheetData></worksheet>`,
      },
    ]);
    const c = await lireClasseur(z);
    expect(c.noms).toEqual(["Garde", "DPGF"]);
    expect(c.feuilles["Garde"]).toEqual([["Page de garde"]]);
    expect(c.feuilles["DPGF"]).toEqual([["Désignation", "", "PU"], [], ["Peinture murs", "12.5", "8"]]);
  });
});

describe("docx", () => {
  const blocs: Bloc[] = [
    { type: "titre", texte: "I - RENSEIGNEMENTS" },
    { type: "paragraphe", morceaux: [{ texte: "Lot : ", gras: true }, { texte: "Peinture <intérieure> & sols" }] },
    { type: "tableau", entetes: ["A", "B"], lignes: [["1", "ligne\nsuivante"]], largeurs: [4500, 4500] },
    { type: "saut-de-page" },
  ];

  it("échappe le texte et rend titres, tableaux et sauts de page", () => {
    const x = documentXml(blocs);
    expect(x).toContain("Peinture &lt;intérieure&gt; &amp; sols");
    expect(x).toContain('<w:br w:type="page"/>');
    expect(x).toContain('<w:gridCol w:w="4500"/>');
    expect(x.match(/<w:tc>/g)).toHaveLength(4);
  });

  it("produit une archive Word lisible (types, relations, document)", async () => {
    const lu = await lireZip(ecrireDocx(blocs));
    expect([...lu.keys()]).toEqual(["[Content_Types].xml", "_rels/.rels", "word/document.xml"]);
    const doc = new DOMParser().parseFromString(d.decode(lu.get("word/document.xml")), "application/xml");
    expect(doc.getElementsByTagName("parsererror")).toHaveLength(0);
  });
});
