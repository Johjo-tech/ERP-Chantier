/**
 * Le PDF Factur-X.
 *
 * On ne se contente pas de produire un fichier : on le relit. Un PDF qui
 * *prétend* embarquer la facture et un PDF dont on ressort l'XML intact sont
 * deux choses différentes, et seule la seconde vaut quelque chose pour le
 * destinataire.
 */

import { describe, it, expect } from "vitest";
import { inflateSync } from "node:zlib";
import { PDFDocument, PDFDict, PDFName, PDFArray, PDFHexString, PDFRawStream } from "pdf-lib";
import { chargeEN16931 } from "@/api/regles-en16931";
import { NOM_FICHIER_FACTURX, versCII } from "@/api/regles-cii";
import { PROFIL_FACTURX, embarquerFacturX } from "@/integrations/facturx";
import { profilSRGB } from "@/integrations/srgb";

const XML = versCII(
  chargeEN16931(
    {
      numero: "FAC-2026-0428",
      date: "2026-09-09",
      totalHt: 630,
      totalTva: 63,
      totalTtc: 693,
    },
    { nom: "KTA PLOMBERIE", siren: "888982824", siret: "88898282400011" },
    { nom: "ALPES ISERE HABITAT", siret: "12345678901234" },
    [{ designation: "Dépose & pose", quantite: 4, prixUnitaire: 120, montantHt: 480, tva: 10, unite: "u" }]
  )
);

/** Un PDF minimal, qui tient lieu du document rendu par l'application. */
async function pdfVierge(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.addPage([595, 842]);
  return doc.save();
}

/**
 * Ressort une pièce jointe du PDF, exactement comme le ferait le destinataire.
 *
 * Deux détails qu'on ne devine pas : le nom du fichier est stocké en
 * hexadécimal UTF-16, et le flux est comprimé. Les lire à travers le texte brut
 * du PDF ne prouverait rien — il faut décoder.
 */
function extraireFichier(doc: PDFDocument, nom: string): string | null {
  const noms = doc.catalog.lookup(PDFName.of("Names"), PDFDict);
  const embarques = noms?.lookup(PDFName.of("EmbeddedFiles"), PDFDict);
  const tableau = embarques?.lookup(PDFName.of("Names"), PDFArray);
  if (!tableau) return null;

  for (let i = 0; i < tableau.size(); i += 2) {
    const cle = tableau.lookup(i);
    const libelle = cle instanceof PDFHexString ? cle.decodeText() : String(cle);
    if (!libelle.includes(nom)) continue;

    const spec = tableau.lookup(i + 1, PDFDict);
    const flux = spec.lookup(PDFName.of("EF"), PDFDict).lookup(PDFName.of("F"));
    if (!(flux instanceof PDFRawStream)) return null;
    return inflateSync(Buffer.from(flux.getContents())).toString("utf8");
  }
  return null;
}

/** La relation déclarée sur la pièce jointe : c'est elle qui dit « ceci est la facture ». */
function relationDeclaree(doc: PDFDocument, nom: string): string | null {
  const noms = doc.catalog.lookup(PDFName.of("Names"), PDFDict);
  const tableau = noms
    ?.lookup(PDFName.of("EmbeddedFiles"), PDFDict)
    ?.lookup(PDFName.of("Names"), PDFArray);
  if (!tableau) return null;

  for (let i = 0; i < tableau.size(); i += 2) {
    const cle = tableau.lookup(i);
    const libelle = cle instanceof PDFHexString ? cle.decodeText() : String(cle);
    if (!libelle.includes(nom)) continue;
    const spec = tableau.lookup(i + 1, PDFDict);
    return String(spec.lookup(PDFName.of("AFRelationship")));
  }
  return null;
}

describe("PDF Factur-X", () => {
  it("produit un PDF relisible", async () => {
    const octets = await embarquerFacturX(await pdfVierge(), XML, {
      numero: "FAC-2026-0428",
      date: "2026-09-09",
    });
    expect(octets.length).toBeGreaterThan(0);
    const relu = await PDFDocument.load(octets);
    expect(relu.getPageCount()).toBe(1);
  });

  /* Le cœur du format : le destinataire doit ressortir la facture du PDF. */
  it("embarque le XML, et on le retrouve intact", async () => {
    const octets = await embarquerFacturX(await pdfVierge(), XML, {
      numero: "FAC-2026-0428",
      date: "2026-09-09",
    });
    const relu = await PDFDocument.load(octets);

    const contenu = extraireFichier(relu, NOM_FICHIER_FACTURX);
    expect(contenu).toBeTruthy();
    expect(contenu).toContain("rsm:CrossIndustryInvoice");
    expect(contenu).toContain("<ram:ID>FAC-2026-0428</ram:ID>");
    expect(contenu).toContain("urn:cen.eu:en16931:2017");
  });

  it("nomme la pièce jointe comme la norme l'impose", async () => {
    const octets = await embarquerFacturX(await pdfVierge(), XML, {
      numero: "FAC-2026-0428",
      date: "2026-09-09",
    });
    const relu = await PDFDocument.load(octets);
    expect(extraireFichier(relu, NOM_FICHIER_FACTURX)).not.toBeNull();
  });

  /* Sans `AFRelationship`, la pièce jointe n'est qu'un fichier joint : rien ne
     dit au lecteur que c'est la facture. */
  it("déclare la relation Data sur la pièce jointe", async () => {
    const octets = await embarquerFacturX(await pdfVierge(), XML, {
      numero: "FAC-2026-0428",
      date: "2026-09-09",
    });
    const relu = await PDFDocument.load(octets);
    expect(relationDeclaree(relu, NOM_FICHIER_FACTURX)).toBe("/Data");
  });

  it("déclare le profil et le niveau dans les métadonnées XMP", async () => {
    const octets = await embarquerFacturX(await pdfVierge(), XML, {
      numero: "FAC-2026-0428",
      date: "2026-09-09",
      emetteur: "KTA PLOMBERIE",
    });
    const brut = new TextDecoder().decode(octets);
    expect(brut).toContain("urn:factur-x:pdfa:CrossIndustryDocument:invoice:1p0#");
    expect(brut).toContain("<fx:DocumentType>INVOICE</fx:DocumentType>");
    expect(brut).toContain(`<fx:ConformanceLevel>${PROFIL_FACTURX}</fx:ConformanceLevel>`);
    expect(brut).toContain("<pdfaid:part>3</pdfaid:part>");
  });

  it("titre le document par son numéro", async () => {
    const octets = await embarquerFacturX(await pdfVierge(), XML, {
      numero: "FAC-2026-0428",
      date: "2026-09-09",
      emetteur: "KTA PLOMBERIE",
    });
    const relu = await PDFDocument.load(octets);
    expect(relu.getTitle()).toBe("Facture FAC-2026-0428");
    expect(relu.getAuthor()).toBe("KTA PLOMBERIE");
  });

  /* Sans intention de sortie, PDF/A refuse toute page employant DeviceRGB ou
     DeviceGray — c'est-à-dire toutes les nôtres. C'était le seul défaut relevé
     par Mustangproject, deux assertions sur six cent deux. */
  it("déclare l'intention de sortie qui rend le PDF/A valide", async () => {
    const octets = await embarquerFacturX(await pdfVierge(), XML, {
      numero: "FAC-2026-0428",
      date: "2026-09-09",
    });
    const relu = await PDFDocument.load(octets);

    const intentions = relu.catalog.lookup(PDFName.of("OutputIntents"), PDFArray);
    expect(intentions?.size()).toBe(1);

    const intention = intentions!.lookup(0, PDFDict);
    expect(String(intention.lookup(PDFName.of("S")))).toBe("/GTS_PDFA1");
    expect(intention.lookup(PDFName.of("DestOutputProfile"))).toBeTruthy();
  });

  it("embarque un profil colorimétrique valide", async () => {
    const icc = profilSRGB();
    // Signature ICC, à l'offset 36 : sans elle le profil est refusé.
    expect(new TextDecoder().decode(icc.slice(36, 40))).toBe("acsp");
    expect(new TextDecoder().decode(icc.slice(16, 20)).trim()).toBe("RGB");
  });

  it("ne se laisse pas arrêter par une date invalide", async () => {
    const octets = await embarquerFacturX(await pdfVierge(), XML, {
      numero: "FAC-2026-0428",
      date: "date-cassée",
    });
    expect(octets.length).toBeGreaterThan(0);
  });
});
