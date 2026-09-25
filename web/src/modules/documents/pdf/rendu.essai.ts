import { jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";
import { describe, expect, it } from "vitest";
import { REGLAGES_IMPRESSION_DEFAUT, type IdentiteEmettrice } from "../domain/identite";
import { construireModele, type PieceImprimable } from "../domain/modele";
import { composer, composerAuMieux } from "./rendu";
import { texteWinAnsi } from "./texte";

const identite: IdentiteEmettrice = {
  nom: "ALPHA RÉNOVATION", formeJuridique: "SAS", adresse: "12 rue des Lilas", codePostal: "69003", ville: "Lyon",
  telephone: "04 00 00 00 00", email: "contact@alpha.example", siret: "12345678900012", siren: null, tvaIntracom: "FR12123456789",
  capitalSocial: 150000, rcsNumero: "123 456 789", rcsVille: "Lyon", codeNaf: "43.22A", iban: "FR76 3000 6000 0112 3456 7890 189", bic: "AGRIFRPP", logo: null,
};

function facture(nbLignes: number, extra: Partial<PieceImprimable> = {}): PieceImprimable {
  return {
    type: "facture", titre: "FACTURE", numero: "FAC-2026-000042", date: "2026-09-20", meta: [["Date d'échéance", "20/10/2026"]],
    client: { nom: "OPAC du Rhône", adresse: "12 rue de la République", interlocuteur: "M. Chargé" },
    lieu: { adresse_locataire: "14 rue Garibaldi", code_postal: "69003", ville: "Lyon", logement_statut: "occupé", occupant: "M. Martin", etage: "2", numero_logement: "12", precision_commune: null, ancien_locataire: null, ref_bon_commande_client: "CMD-7781" },
    lignes: Array.from({ length: nbLignes }, (_, i) => ({ type: "ligne" as const, designation: `Poste ${i + 1} (avancement 25% → 60%)`, quantite: 2, prix_unitaire: 35.5, unite: "m²", tva: i % 2 ? 10 : 20, commentaire: null })),
    remise: 0, signe: 1, deductions: { acomptes: 0, retenuePct: 5 }, reglement: { echeance: "2026-10-20", conditions: "30 jours net", mode: "virement" },
    ...extra,
  };
}

const modele = (p: PieceImprimable) => construireModele(p, identite, REGLAGES_IMPRESSION_DEFAUT, ["En cas de retard de paiement, pénalités au taux d'intérêt légal majoré de 10 points."]);
const texteDu = (doc: jsPDF) => new TextDecoder("latin1").decode(doc.output("arraybuffer"));

describe("PDF A4 d'une pièce (FAC-10, FAC-11)", () => {
  it("une facture courte tient sur UNE page, pied légal et « 1 / 1 » en texte réel", () => {
    const c = composerAuMieux(jsPDF, autoTable as never, modele(facture(5)));
    expect(c.pages).toBe(1);
    const texte = texteDu(c.doc);
    expect(texte).toContain("1 / 1");
    expect(texte).toContain("SIRET 12345678900012");
    expect(texte).toContain("Net à payer");
    expect(texte).toContain("IBAN : FR76");
  });

  it("une longue facture : chaque page porte le pied et sa pagination, sans page vide", () => {
    const c = composerAuMieux(jsPDF, autoTable as never, modele(facture(80)));
    expect(c.pages).toBeGreaterThan(1);
    const texte = texteDu(c.doc);
    for (let i = 1; i <= c.pages; i++) expect(texte).toContain(`${i} / ${c.pages}`);
    expect(c.partDernierePage).toBeGreaterThan(0);
  });

  it("une dernière page maigre fait recomposer serré, gardé seulement s'il gagne une page", () => {
    for (let n = 20; n <= 45; n++) {
      const m = modele(facture(n));
      const normal = composer(jsPDF, autoTable as never, m, false);
      const retenu = composerAuMieux(jsPDF, autoTable as never, m);
      expect(retenu.pages).toBeLessThanOrEqual(normal.pages);
      if (retenu.pages < normal.pages) expect(normal.partDernierePage).toBeLessThan(0.12);
    }
  });

  it("un devis : bloc de signature du client, aucune mention de facture", () => {
    const m = modele(facture(3, { type: "devis", titre: "DEVIS", reglement: undefined, deductions: undefined }));
    expect(m.signature).toMatch(/Bon pour accord/);
    expect(m.mentions).toBeNull();
    expect(texteDu(composer(jsPDF, autoTable as never, m, false).doc)).toContain("Bon pour accord");
  });

  it("un brouillon de facture le dit sur la pièce", () => {
    expect(modele(facture(2, { numero: null })).brouillon).toBe(true);
  });
});

describe("texte imprimable en Helvetica (WinAnsi)", () => {
  it("« → », espaces fines et symboles hors jeu deviennent lisibles", () => {
    expect(texteWinAnsi("25% → 60%")).toBe("25% -> 60%");
    expect(texteWinAnsi("1\u202F234,00\u00A0€")).toBe("1 234,00 €");
    expect(texteWinAnsi("Réf. « œuvre » — 5 m²")).toBe("Réf. « œuvre » — 5 m²");
    expect(texteWinAnsi("✅ fait")).toBe("? fait");
  });
});
