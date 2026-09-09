/**
 * Le PDF Factur-X : le document lisible, et la facture structurée dedans.
 *
 * Une facture électronique n'est pas un PDF *accompagné* d'un XML. C'est un
 * seul fichier : un PDF dont l'XML est une pièce jointe déclarée, portant un
 * nom imposé (`factur-x.xml`) et une relation imposée (`Data`). C'est ce qui
 * permet à la machine du destinataire de lire les données pendant que
 * l'humain lit la page.
 *
 * Trois choses sont donc écrites ici et pas ailleurs :
 *
 *  - la pièce jointe, avec sa relation `AFRelationship` — sans elle, un lecteur
 *    conforme ne trouve pas la facture ;
 *  - les métadonnées XMP qui déclarent le profil suivi — c'est là que se lit le
 *    niveau de conformité, pas dans le nom du fichier ;
 *  - la déclaration PDF/A-3, exigée par la norme.
 *
 * ⚠ Ce que ce module ne fait pas : il ne rend pas le PDF *validement* PDF/A-3.
 * Une conformité stricte demande un profil colorimétrique de sortie et des
 * polices intégrées, ce que le PDF produit par capture d'image ne porte pas.
 * Les données structurées, elles, sont bien là et exploitables. La conformité
 * complète est un chantier à part, qui suppose de fabriquer le PDF autrement.
 */

import { AFRelationship, PDFDocument, PDFName, PDFString } from "pdf-lib";
import { NOM_FICHIER_FACTURX } from "@/api/regles-cii";
import { CONDITION_SORTIE, profilSRGB } from "./srgb";

/** Niveau de conformité déclaré dans les métadonnées. */
export const PROFIL_FACTURX = "EN 16931";

/**
 * Métadonnées XMP.
 *
 * L'extension `fx:` est celle que la norme réserve à Factur-X : elle nomme le
 * fichier embarqué et le niveau suivi. Un lecteur qui n'en veut pas l'ignore ;
 * un lecteur conforme s'en sert pour savoir quoi lire.
 */
function metadonneesXmp(numero: string, date: string): string {
  return `<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
    <rdf:Description rdf:about="" xmlns:dc="http://purl.org/dc/elements/1.1/">
      <dc:title><rdf:Alt><rdf:li xml:lang="x-default">Facture ${numero}</rdf:li></rdf:Alt></dc:title>
      <dc:date><rdf:Seq><rdf:li>${date}</rdf:li></rdf:Seq></dc:date>
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
              <rdf:Seq>
                <rdf:li rdf:parseType="Resource">
                  <pdfaProperty:name>DocumentFileName</pdfaProperty:name>
                  <pdfaProperty:valueType>Text</pdfaProperty:valueType>
                  <pdfaProperty:category>external</pdfaProperty:category>
                  <pdfaProperty:description>Nom du fichier de facture embarqué</pdfaProperty:description>
                </rdf:li>
                <rdf:li rdf:parseType="Resource">
                  <pdfaProperty:name>DocumentType</pdfaProperty:name>
                  <pdfaProperty:valueType>Text</pdfaProperty:valueType>
                  <pdfaProperty:category>external</pdfaProperty:category>
                  <pdfaProperty:description>INVOICE</pdfaProperty:description>
                </rdf:li>
                <rdf:li rdf:parseType="Resource">
                  <pdfaProperty:name>Version</pdfaProperty:name>
                  <pdfaProperty:valueType>Text</pdfaProperty:valueType>
                  <pdfaProperty:category>external</pdfaProperty:category>
                  <pdfaProperty:description>Version du format</pdfaProperty:description>
                </rdf:li>
                <rdf:li rdf:parseType="Resource">
                  <pdfaProperty:name>ConformanceLevel</pdfaProperty:name>
                  <pdfaProperty:valueType>Text</pdfaProperty:valueType>
                  <pdfaProperty:category>external</pdfaProperty:category>
                  <pdfaProperty:description>Niveau de conformité</pdfaProperty:description>
                </rdf:li>
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

export interface OptionsFacturX {
  numero: string;
  date: string;
  emetteur?: string | null;
}

/**
 * Embarque le XML dans le PDF et renvoie le fichier complet.
 *
 * L'entrée est le PDF déjà rendu — on ne le refabrique pas, on l'enrichit.
 */
export async function embarquerFacturX(
  pdf: ArrayBuffer | Uint8Array,
  xml: string,
  options: OptionsFacturX
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(pdf);

  doc.setTitle(`Facture ${options.numero}`);
  doc.setSubject("Facture électronique — Factur-X / EN 16931");
  doc.setKeywords(["facture", "Factur-X", "EN 16931", options.numero]);
  if (options.emetteur) doc.setAuthor(options.emetteur);
  doc.setProducer("ERP-Chantier");

  const horodatage = new Date(`${options.date}T00:00:00`);
  const quand = Number.isNaN(horodatage.getTime()) ? new Date() : horodatage;

  await doc.attach(new TextEncoder().encode(xml), NOM_FICHIER_FACTURX, {
    mimeType: "application/xml",
    description: "Facture électronique au format Factur-X",
    creationDate: quand,
    modificationDate: quand,
    // Sans cette relation, la pièce jointe n'est qu'un fichier joint : c'est
    // elle qui dit « ceci est la facture ».
    afRelationship: AFRelationship.Data,
  });

  // Les métadonnées XMP, que pdf-lib n'expose pas directement.
  const flux = doc.context.stream(metadonneesXmp(options.numero, options.date), {
    Type: "Metadata",
    Subtype: "XML",
  });
  doc.catalog.set(PDFName.of("Metadata"), doc.context.register(flux));

  poserIntentionDeSortie(doc);

  return doc.save();
}

/**
 * L'intention de sortie : dans quel espace lire les couleurs du document.
 *
 * PDF/A refuse une page qui emploie `DeviceRGB` ou `DeviceGray` sans dire à
 * quoi ces valeurs correspondent — soit toutes nos pages. C'était le seul
 * défaut relevé par le validateur, deux assertions sur six cent deux.
 */
function poserIntentionDeSortie(doc: PDFDocument): void {
  const icc = doc.context.flateStream(profilSRGB(), {
    // Trois composantes : c'est un profil RVB.
    N: 3,
  });
  const refIcc = doc.context.register(icc);

  const intention = doc.context.obj({
    Type: "OutputIntent",
    S: "GTS_PDFA1",
    OutputConditionIdentifier: PDFString.of(CONDITION_SORTIE),
    Info: PDFString.of(CONDITION_SORTIE),
    DestOutputProfile: refIcc,
  });

  doc.catalog.set(
    PDFName.of("OutputIntents"),
    doc.context.obj([doc.context.register(intention)])
  );
}

/** Le même, rendu en `Blob` : c'est ce que le navigateur télécharge. */
export async function pdfFacturX(
  pdf: Blob,
  xml: string,
  options: OptionsFacturX
): Promise<Blob> {
  const octets = await embarquerFacturX(await pdf.arrayBuffer(), xml, options);
  return new Blob([octets as BlobPart], { type: "application/pdf" });
}
