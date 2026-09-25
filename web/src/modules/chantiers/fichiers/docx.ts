import type { Bloc } from "../domain/ppsps";
import { ecrireZip } from "./zip";

/**
 * Un document Word (.docx) minimal à partir de blocs neutres : paragraphes,
 * titres, tableaux, sauts de page. Pas de feuille de styles : la mise en forme
 * est portée par chaque morceau de texte, comme le faisait l'ancien générateur.
 */
const W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";

const echapper = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function run(texte: string, o: { gras?: boolean | undefined; italique?: boolean | undefined; taille?: number | undefined } = {}): string {
  const props = [o.gras ? "<w:b/>" : "", o.italique ? "<w:i/>" : "", o.taille ? `<w:sz w:val="${o.taille}"/>` : ""].join("");
  return `<w:r>${props ? `<w:rPr>${props}</w:rPr>` : ""}<w:t xml:space="preserve">${echapper(texte)}</w:t></w:r>`;
}

const paragraphe = (runs: string, o: { centre?: boolean | undefined; apres?: number } = {}) =>
  `<w:p><w:pPr>${o.centre ? '<w:jc w:val="center"/>' : ""}<w:spacing w:after="${o.apres ?? 120}"/></w:pPr>${runs}</w:p>`;

function cellule(texte: string, largeur: number, entete: boolean): string {
  const fond = entete ? '<w:shd w:val="clear" w:color="auto" w:fill="D9D9D9"/>' : "";
  // Un retour à la ligne dans une cellule devient un paragraphe, comme dans l'ancien document.
  const contenu = (texte.split("\n").map((l) => paragraphe(run(l, { gras: entete }), { apres: 40 })).join("")) || paragraphe("");
  return `<w:tc><w:tcPr><w:tcW w:w="${largeur}" w:type="dxa"/>${fond}</w:tcPr>${contenu}</w:tc>`;
}

function tableau(b: Extract<Bloc, { type: "tableau" }>): string {
  const bord = '<w:top w:val="single" w:sz="4"/><w:left w:val="single" w:sz="4"/><w:bottom w:val="single" w:sz="4"/><w:right w:val="single" w:sz="4"/><w:insideH w:val="single" w:sz="4"/><w:insideV w:val="single" w:sz="4"/>';
  const grille = b.largeurs.map((l) => `<w:gridCol w:w="${l}"/>`).join("");
  const rangee = (cellules: string[], entete: boolean) => `<w:tr>${cellules.map((c, i) => cellule(c, b.largeurs[i] ?? 2000, entete)).join("")}</w:tr>`;
  return `<w:tbl><w:tblPr><w:tblW w:w="9000" w:type="dxa"/><w:tblBorders>${bord}</w:tblBorders></w:tblPr><w:tblGrid>${grille}</w:tblGrid>${rangee(b.entetes, true)}${b.lignes.map((l) => rangee(l, false)).join("")}</w:tbl>${paragraphe("")}`;
}

function bloc(b: Bloc): string {
  switch (b.type) {
    case "titre":
      return paragraphe(run(b.texte, { gras: true, taille: 32 }), { apres: 200 });
    case "sous-titre":
      return paragraphe(run(b.texte, { gras: true, taille: 24 }));
    case "paragraphe":
      return paragraphe(b.morceaux.map((m) => run(m.texte, { gras: m.gras, italique: m.italique, taille: b.taille })).join(""), { centre: b.centre });
    case "tableau":
      return tableau(b);
    case "saut-de-page":
      return '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';
  }
}

export function documentXml(blocs: readonly Bloc[]): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="${W}"><w:body>${blocs.map(bloc).join("")}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr></w:body></w:document>`;
}

const TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`;
const RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`;

export const MIME_DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export function ecrireDocx(blocs: readonly Bloc[]): Uint8Array {
  const e = new TextEncoder();
  return ecrireZip([
    { chemin: "[Content_Types].xml", contenu: e.encode(TYPES) },
    { chemin: "_rels/.rels", contenu: e.encode(RELS) },
    { chemin: "word/document.xml", contenu: e.encode(documentXml(blocs)) },
  ]);
}
