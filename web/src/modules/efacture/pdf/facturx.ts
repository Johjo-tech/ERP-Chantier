/**
 * Le PDF Factur-X : la page que l'humain lit, et la facture structurée dedans
 * (EFA-04 — port de src/integrations/facturx.ts).
 *
 * Une facture électronique n'est pas un PDF ACCOMPAGNÉ d'un XML : c'est un
 * seul fichier dont le XML est une pièce jointe déclarée, au nom imposé
 * (`factur-x.xml`) et à la relation imposée (`/AFRelationship /Data`), avec
 * des métadonnées XMP qui déclarent le profil et une intention de sortie sRGB.
 *
 * L'ancien écran passait par pdf-lib. web/ n'ajoute pas de dépendance pour si
 * peu (D-EFA-03) : le PDF de jsPDF a une table xref classique, et on lui
 * APPOSE une mise à jour incrémentale (ISO 32000, § 7.5.6) — nouveaux objets,
 * catalogue redéfini, nouvelle table, `/Prev` vers l'ancienne. Les octets
 * d'origine ne sont pas touchés : un lecteur qui ignore la mise à jour lit
 * toujours la même page.
 *
 * ⚠ Comme l'ancien, ce fichier n'est pas VALIDEMENT PDF/A-3 : les polices
 * standard de jsPDF ne sont pas embarquées. Les données structurées, elles,
 * sont bien là et lisibles par la machine du destinataire.
 */
import { NOM_FICHIER_FACTURX } from "../domain/cii";
import { CONDITION_SORTIE, profilSRGB } from "./srgb";

/** Niveau de conformité déclaré dans les métadonnées. */
export const PROFIL_FACTURX = "EN 16931";

export interface OptionsFacturX {
  numero: string;
  /** AAAA-MM-JJ — la date de la facture, qui date aussi la pièce jointe. */
  date: string;
}

export class PdfNonEnrichissable extends Error {}

const encodeur = new TextEncoder();

/** Un octet = un caractère : les offsets d'une xref se comptent en octets. */
function enLatin1(octets: Uint8Array): string {
  let texte = "";
  const TRANCHE = 0x8000;
  for (let i = 0; i < octets.length; i += TRANCHE) texte += String.fromCharCode(...octets.subarray(i, i + TRANCHE));
  return texte;
}

const ascii = (texte: string) => Uint8Array.from(texte, (c) => c.charCodeAt(0));

/** Une chaîne PDF hors ASCII : UTF-16BE avec BOM, en hexadécimal. */
function chaineUnicode(texte: string): string {
  let hex = "FEFF";
  for (const c of texte) {
    const code = c.charCodeAt(0);
    hex += code.toString(16).toUpperCase().padStart(4, "0");
  }
  return `<${hex}>`;
}

function metadonneesXmp(numero: string, date: string): string {
  const echapper = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const propriete = (nom: string, description: string) => `
                <rdf:li rdf:parseType="Resource">
                  <pdfaProperty:name>${nom}</pdfaProperty:name>
                  <pdfaProperty:valueType>Text</pdfaProperty:valueType>
                  <pdfaProperty:category>external</pdfaProperty:category>
                  <pdfaProperty:description>${description}</pdfaProperty:description>
                </rdf:li>`;
  return `<?xpacket begin="\uFEFF" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
    <rdf:Description rdf:about="" xmlns:dc="http://purl.org/dc/elements/1.1/">
      <dc:title><rdf:Alt><rdf:li xml:lang="x-default">Facture ${echapper(numero)}</rdf:li></rdf:Alt></dc:title>
      <dc:date><rdf:Seq><rdf:li>${echapper(date)}</rdf:li></rdf:Seq></dc:date>
    </rdf:Description>
    <rdf:Description rdf:about="" xmlns:pdfaid="http://www.aiim.org/pdfa/ns/id/">
      <pdfaid:part>3</pdfaid:part>
      <pdfaid:conformance>B</pdfaid:conformance>
    </rdf:Description>
    <rdf:Description rdf:about="" xmlns:pdfaExtension="http://www.aiim.org/pdfa/ns/extension/" xmlns:pdfaSchema="http://www.aiim.org/pdfa/ns/schema#" xmlns:pdfaProperty="http://www.aiim.org/pdfa/ns/property#">
      <pdfaExtension:schemas>
        <rdf:Bag>
          <rdf:li rdf:parseType="Resource">
            <pdfaSchema:schema>Factur-X PDFA Extension Schema</pdfaSchema:schema>
            <pdfaSchema:namespaceURI>urn:factur-x:pdfa:CrossIndustryDocument:invoice:1p0#</pdfaSchema:namespaceURI>
            <pdfaSchema:prefix>fx</pdfaSchema:prefix>
            <pdfaSchema:property>
              <rdf:Seq>${propriete("DocumentFileName", "Nom du fichier de facture embarqué")}${propriete("DocumentType", "INVOICE")}${propriete("Version", "Version du format")}${propriete("ConformanceLevel", "Niveau de conformité")}
              </rdf:Seq>
            </pdfaSchema:property>
          </rdf:li>
        </rdf:Bag>
      </pdfaExtension:schemas>
    </rdf:Description>
    <rdf:Description rdf:about="" xmlns:fx="urn:factur-x:pdfa:CrossIndustryDocument:invoice:1p0#">
      <fx:DocumentType>INVOICE</fx:DocumentType>
      <fx:DocumentFileName>${NOM_FICHIER_FACTURX}</fx:DocumentFileName>
      <fx:Version>1.0</fx:Version>
      <fx:ConformanceLevel>${PROFIL_FACTURX}</fx:ConformanceLevel>
    </rdf:Description>
  </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`;
}

interface Fin {
  xrefPrecedente: number;
  taille: number;
  racine: number;
  suiteTrailer: string;
}

/** Ce que dit la fin du fichier : où est l'ancienne table, combien d'objets, quel catalogue. */
function lireFin(texte: string): Fin {
  const startxref = [...texte.matchAll(/startxref\s+(\d+)/g)].pop();
  const trailer = texte.lastIndexOf("trailer");
  if (!startxref || trailer < 0) throw new PdfNonEnrichissable("PDF sans table de références classique.");
  const dict = texte.slice(trailer, startxref.index);
  const taille = /\/Size\s+(\d+)/.exec(dict);
  const racine = /\/Root\s+(\d+)\s+0\s+R/.exec(dict);
  if (!taille || !racine) throw new PdfNonEnrichissable("Trailer du PDF illisible.");
  // /Info et /ID se recopient : la mise à jour ne change pas l'identité du document.
  const info = /\/Info\s+\d+\s+\d+\s+R/.exec(dict)?.[0] ?? "";
  const id = /\/ID\s*\[[^\]]*\]/.exec(dict)?.[0] ?? "";
  return { xrefPrecedente: Number(startxref[1]), taille: Number(taille[1]), racine: Number(racine[1]), suiteTrailer: [info, id].filter(Boolean).join("\n") };
}

/** Le contenu du dictionnaire du catalogue, sans ses chevrons. */
function contenuCatalogue(texte: string, racine: number): string {
  const debut = [...texte.matchAll(new RegExp(`(?:^|\\s)${racine} 0 obj\\s*<<`, "g"))].pop();
  if (!debut || debut.index === undefined) throw new PdfNonEnrichissable("Catalogue du PDF introuvable.");
  const ouverture = debut.index + debut[0].length;
  const fin = texte.indexOf("endobj", ouverture);
  const fermeture = texte.lastIndexOf(">>", fin);
  const contenu = texte.slice(ouverture, fermeture);
  // Un catalogue qui porte déjà des pièces jointes ou des métadonnées se fusionnerait mal : on n'invente pas.
  if (/\/(Names|AF|Metadata|OutputIntents)\b/.test(contenu)) throw new PdfNonEnrichissable("Le PDF porte déjà des pièces jointes ou des métadonnées.");
  return contenu.trim();
}

const flux = (dict: string, donnees: Uint8Array): Uint8Array[] => [
  ascii(`<<${dict}/Length ${donnees.length}>>\nstream\n`),
  donnees,
  ascii("\nendstream"),
];

/** Appose la facture structurée au PDF rendu, et rend le fichier complet. */
export function embarquerFacturX(pdf: Uint8Array, xml: string, options: OptionsFacturX): Uint8Array {
  const texte = enLatin1(pdf);
  if (!texte.startsWith("%PDF-")) throw new PdfNonEnrichissable("Ce fichier n'est pas un PDF.");
  const fin = lireFin(texte);
  const catalogue = contenuCatalogue(texte, fin.racine);

  const [ef, spec, meta, icc, intention] = [0, 1, 2, 3, 4].map((i) => fin.taille + i) as [number, number, number, number, number];
  const xmlOctets = encodeur.encode(xml);
  const datePdf = `D:${options.date.replace(/-/g, "").slice(0, 8)}000000Z`;

  const objets: [number, Uint8Array[]][] = [
    [ef, flux(`/Type /EmbeddedFile /Subtype /application#2Fxml /Params <</Size ${xmlOctets.length} /CreationDate (${datePdf}) /ModDate (${datePdf})>> `, xmlOctets)],
    [
      spec,
      // Sans /AFRelationship /Data, la pièce jointe n'est qu'un fichier joint : c'est elle qui dit « ceci est la facture ».
      [ascii(`<</Type /Filespec /F (${NOM_FICHIER_FACTURX}) /UF (${NOM_FICHIER_FACTURX}) /Desc ${chaineUnicode("Facture électronique au format Factur-X")} /AFRelationship /Data /EF <</F ${ef} 0 R /UF ${ef} 0 R>>>>`)],
    ],
    [meta, flux("/Type /Metadata /Subtype /XML ", encodeur.encode(metadonneesXmp(options.numero, options.date)))],
    [icc, flux("/N 3 ", profilSRGB())],
    [intention, [ascii(`<</Type /OutputIntent /S /GTS_PDFA1 /OutputConditionIdentifier (${CONDITION_SORTIE}) /Info (${CONDITION_SORTIE}) /DestOutputProfile ${icc} 0 R>>`)]],
    [
      fin.racine,
      [ascii(`<<\n${catalogue}\n/Metadata ${meta} 0 R\n/OutputIntents [${intention} 0 R]\n/AF [${spec} 0 R]\n/Names <</EmbeddedFiles <</Names [(${NOM_FICHIER_FACTURX}) ${spec} 0 R]>>>>\n>>`)],
    ],
  ];

  const morceaux: Uint8Array[] = [pdf, ascii("\n")];
  let position = pdf.length + 1;
  const offsets = new Map<number, number>();
  for (const [numero, corps] of objets) {
    offsets.set(numero, position);
    for (const m of [ascii(`${numero} 0 obj\n`), ...corps, ascii("\nendobj\n")]) {
      morceaux.push(m);
      position += m.length;
    }
  }

  const entree = (n: number) => `${String(offsets.get(n)).padStart(10, "0")} 00000 n \n`;
  const table =
    `xref\n${fin.racine} 1\n${entree(fin.racine)}${ef} 5\n${[ef, spec, meta, icc, intention].map(entree).join("")}` +
    `trailer\n<<\n/Size ${intention + 1}\n/Root ${fin.racine} 0 R\n${fin.suiteTrailer}\n/Prev ${fin.xrefPrecedente}\n>>\nstartxref\n${position}\n%%EOF\n`;
  morceaux.push(ascii(table));

  const sortie = new Uint8Array(position + table.length);
  let curseur = 0;
  for (const m of morceaux) {
    sortie.set(m, curseur);
    curseur += m.length;
  }
  return sortie;
}

/** Le même, en `Blob` : c'est ce que le navigateur télécharge. */
export async function pdfFacturX(pdf: Blob, xml: string, options: OptionsFacturX): Promise<Blob> {
  const octets = embarquerFacturX(new Uint8Array(await pdf.arrayBuffer()), xml, options);
  return new Blob([octets as BlobPart], { type: "application/pdf" });
}
