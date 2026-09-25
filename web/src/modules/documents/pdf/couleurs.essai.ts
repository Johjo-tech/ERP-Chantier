import { jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";
import { describe, expect, it } from "vitest";
import { couleursDocument } from "../api/identite";
import { stylesCouleurs } from "../components/couleurs";
import { cheminLogoDuSeau, lireReglagesImpression, REGLAGES_IMPRESSION_DEFAUT, type IdentiteEmettrice } from "../domain/identite";
import { construireModele, type PieceImprimable } from "../domain/modele";
import { composer, encresDe, rvbDe } from "./rendu";

const identite: IdentiteEmettrice = {
  nom: "ALPHA RÉNOVATION", formeJuridique: "SAS", adresse: "12 rue des Lilas", codePostal: "69003", ville: "Lyon", telephone: null, email: null,
  siret: "12345678900012", siren: null, tvaIntracom: null, capitalSocial: null, rcsNumero: null, rcsVille: null, codeNaf: null, iban: null, bic: null, logo: null,
};
const piece: PieceImprimable = {
  type: "devis", titre: "DEVIS", numero: "DEV-2026-000001", date: "2026-09-20", meta: [],
  client: { nom: "OPAC du Rhône", adresse: null, interlocuteur: null },
  lieu: { adresse_locataire: null, code_postal: null, ville: null, logement_statut: null, occupant: null, etage: null, numero_logement: null, precision_commune: null, ancien_locataire: null, ref_bon_commande_client: null },
  lignes: [{ type: "ligne", designation: "Peinture", quantite: 1, prix_unitaire: 100, unite: "u", tva: 10, commentaire: null }],
  remise: 0, signe: 1,
};

describe("couleurs de la société sur les pièces (SOC-04)", () => {
  it("les réglages d'impression lisent les deux couleurs, défauts de l'ancien écran", () => {
    expect(lireReglagesImpression({ reglages: { documents: { couleurAccent: "#1E8FD5", couleurSecondaire: "#0B3D2E" } } })).toMatchObject({ couleurAccent: "#1E8FD5", couleurSecondaire: "#0B3D2E" });
    expect(lireReglagesImpression(null)).toMatchObject({ couleurAccent: "#FF6A1A", couleurSecondaire: "#182233" });
  });

  it("sans réglage : la palette historique (orange foncé, bleu nuit) — la même que l'écran", () => {
    expect(couleursDocument(REGLAGES_IMPRESSION_DEFAUT)).toEqual({ accent: "#FF6A1A", accentFonce: "#C24E00", secondaire: "#182233", surSecondaire: expect.stringMatching(/^#/) });
  });

  it("le PDF porte le ton foncé au titre et la seconde couleur au bandeau du tableau", () => {
    const couleurs = couleursDocument({ couleurAccent: "#1E8FD5", couleurSecondaire: "#0B3D2E" });
    const m = construireModele(piece, { ...identite, couleurs }, REGLAGES_IMPRESSION_DEFAUT, []);
    expect(m.couleurs).toEqual(couleurs);
    const encres = encresDe(m);
    expect(encres.bandeau).toEqual([11, 61, 46]);
    expect(encres.titre).toEqual(rvbDe(couleurs.accentFonce, [0, 0, 0]));
    // Le document se compose sans erreur avec ses couleurs.
    expect(composer(jsPDF, autoTable as never, m, false).pages).toBe(1);
  });

  it("sans couleurs, le document reste à l'encre sombre ; une couleur malformée ne lève jamais", () => {
    const m = construireModele(piece, identite, REGLAGES_IMPRESSION_DEFAUT, []);
    expect(encresDe(m)).toEqual({ titre: [24, 34, 51], filet: null, bandeau: [24, 34, 51], surBandeau: [255, 255, 255] });
    expect(rvbDe("rouge", [1, 2, 3])).toEqual([1, 2, 3]);
  });

  it("l'aperçu HTML prend les couleurs du modèle, sinon les variables de la société", () => {
    expect(stylesCouleurs({ couleurs: couleursDocument({ couleurAccent: "", couleurSecondaire: "#0B3D2E" }) }).bandeau.backgroundColor).toBe("#0B3D2E");
    expect(stylesCouleurs({}).bandeau.backgroundColor).toBe("var(--color-secondaire-societe, #182233)");
    expect(stylesCouleurs({}).filet.borderColor).toContain("--color-accent-societe");
  });
});

describe("logo du seau (SOC-04, SOC-08)", () => {
  it("suit un chemin PNG ou JPEG de SA société, jamais d'une autre, ni si une data-URL existe", () => {
    expect(cheminLogoDuSeau(null, "alpha/societe/logo-1.png", "alpha")).toBe("alpha/societe/logo-1.png");
    expect(cheminLogoDuSeau(null, "alpha/societe/logo-1.JPG", "alpha")).toBe("alpha/societe/logo-1.JPG");
    expect(cheminLogoDuSeau(null, "beta/societe/logo-1.png", "alpha")).toBeNull();
    expect(cheminLogoDuSeau(null, "alpha/societe/logo-1.svg", "alpha")).toBeNull();
    expect(cheminLogoDuSeau({ logo: "data:image/png;base64,AAAA" }, "alpha/societe/logo-1.png", "alpha")).toBeNull();
    expect(cheminLogoDuSeau(null, null, "alpha")).toBeNull();
  });
});
