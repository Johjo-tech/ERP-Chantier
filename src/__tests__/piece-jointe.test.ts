/**
 * Le bon reçu du client : ce qu'on accepte, et comment on l'affiche.
 *
 * `apercuDe` est le cas qui motive ce fichier. La décision « image, PDF ou
 * rien » se prenait dans `index.html` par une expression régulière sur le
 * préfixe `data:` — invisible aux tests, et incapable de traiter une URL
 * signée, c'est-à-dire précisément ce que rend un bucket privé.
 */

import { describe, it, expect } from "vitest";
import {
  apercuDe,
  mimeDePieceJointe,
  nomSurPourStockage,
  TAILLE_MAX_PIECE_JOINTE,
  verifierPieceJointe,
} from "@/api/regles-piece-jointe";
import {
  completudeSociete,
  estSociete,
  recommandationsSociete,
} from "@/api/regles-efacture";

const URL_SIGNEE =
  "https://tjhljjuvfosmnpmzgbnl.supabase.co/storage/v1/object/sign/terrain/x.pdf?token=abc";

describe("Ce qu'on accepte comme bon du client", () => {
  it("accepte un PDF", () => {
    expect(verifierPieceJointe({ nom: "bon.pdf", type: "application/pdf", taille: 120_000 })).toEqual({
      ok: true,
    });
  });

  it("accepte une photo du bon", () => {
    expect(verifierPieceJointe({ nom: "bon.jpg", type: "image/jpeg", taille: 900_000 }).ok).toBe(true);
  });

  /* Le plafond suit celui de la lecture automatique. L'ancien champ s'arrêtait
     à 5 Mo : un PDF de 8 Mo passait la lecture puis se faisait refuser à
     l'archivage, et l'écran disait deux choses du même fichier. */
  it("accepte jusqu'au plafond de la lecture automatique", () => {
    const limite = { nom: "bon.pdf", type: "application/pdf", taille: TAILLE_MAX_PIECE_JOINTE };
    expect(verifierPieceJointe(limite).ok).toBe(true);
    expect(verifierPieceJointe({ ...limite, taille: TAILLE_MAX_PIECE_JOINTE + 1 }).ok).toBe(false);
  });

  it("refuse un format que la lecture ne sait pas traiter, en le nommant", () => {
    const verdict = verifierPieceJointe({ nom: "bon.docx", type: "application/msword", taille: 10 });
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.motif).toContain("application/msword");
  });

  /* Un copieur dépose souvent un fichier sans type annoncé : le nom reste le
     seul indice, et le refuser d'office écarterait des bons parfaitement
     lisibles. */
  it("se rabat sur l'extension quand le type est absent", () => {
    expect(mimeDePieceJointe("", "BON_2026.PDF")).toBe("application/pdf");
    expect(verifierPieceJointe({ nom: "BON_2026.PDF", type: "", taille: 10 }).ok).toBe(true);
  });

  it("refuse ce qu'on ne sait pas identifier du tout", () => {
    expect(verifierPieceJointe({ nom: "scan", type: "", taille: 10 }).ok).toBe(false);
  });
});

describe("Le nom de rangement", () => {
  /* `uploadFile` colle le nom dans la clé d'objet : les accents et le « ° » y
     produisent une clé que certains intermédiaires rejettent. Le nom d'origine,
     lui, reste affiché tel quel. */
  it("réduit un nom de bon à ce qu'une clé de stockage accepte", () => {
    expect(nomSurPourStockage("Bon n°12 – Résidence Côte d'Azur.pdf")).toBe(
      "Bon-n-12-Residence-Cote-d-Azur.pdf"
    );
  });

  it("ne rend jamais une chaîne vide", () => {
    expect(nomSurPourStockage("   ")).toBe("document");
    expect(nomSurPourStockage("///")).toBe("document");
    expect(nomSurPourStockage(null)).toBe("document");
  });
});

describe("Comment afficher le document", () => {
  it("lit le type dans une data-URL, comme avant", () => {
    expect(apercuDe("data:application/pdf;base64,JVBER")).toBe("pdf");
    expect(apercuDe("data:image/png;base64,iVBOR")).toBe("image");
  });

  /* Le cas nouveau : une URL signée ne porte pas son type. Sans le mime rangé
     à côté, l'aperçu retombait sur « non disponible » pour tous les documents
     d'un bucket privé. */
  it("accepte une URL signée dont on lui donne le type", () => {
    expect(apercuDe(URL_SIGNEE, "application/pdf")).toBe("pdf");
    expect(apercuDe(URL_SIGNEE, "image/jpeg")).toBe("image");
  });

  it("devine par le nom quand le type manque aussi", () => {
    expect(apercuDe(URL_SIGNEE, null, "bon-de-commande.pdf")).toBe("pdf");
    expect(apercuDe(URL_SIGNEE, "", "photo.png")).toBe("image");
  });

  it("ne prétend rien afficher quand il n'a aucun indice", () => {
    expect(apercuDe(URL_SIGNEE)).toBe("aucun");
    expect(apercuDe("")).toBe("aucun");
    expect(apercuDe(null)).toBe("aucun");
  });
});

/**
 * Ce qu'une fiche société doit porter pour qu'une facture soit régulière.
 *
 * La distinction compte : le comptable qui a relu la facture a rangé le
 * téléphone et l'e-mail parmi les « mentions obligatoires », et oublié le RCS
 * qui, lui, l'est. Confondre les deux, c'est ne plus savoir par quoi commencer.
 */
describe("La complétude de la fiche société", () => {
  const SASU = {
    raisonSocialeLegale: "KTA PLOMBERIE",
    formeJuridique: "SASU",
    siret: "88898282400011",
    tvaIntracom: "FR26888982824",
    adresse: "12 rue des Lilas",
    codePostal: "38000",
    ville: "Grenoble",
    adresseElectroniqueValeur: "888982824",
    capitalSocial: 10000,
    rcsNumero: "888982824",
    rcsVille: "Grenoble",
  };

  it("ne reproche rien à une société complète", () => {
    expect(completudeSociete(SASU)).toEqual([]);
  });

  /* Art. R123-238 : capital et RCS sur tout document commercial — d'une
     société. Le comptable ne les avait pas cités. */
  it("réclame le capital et le RCS d'une société", () => {
    const champs = completudeSociete({ ...SASU, capitalSocial: null, rcsNumero: "" })
      .map((a) => a.champ);
    expect(champs).toContain("capitalSocial");
    expect(champs).toContain("rcsNumero");
  });

  /* Une entreprise individuelle n'a ni capital ni immatriculation au RCS : les
     réclamer afficherait un reproche impossible à satisfaire. */
  it("ne les réclame pas à une entreprise individuelle", () => {
    const ei = { ...SASU, formeJuridique: "EI", capitalSocial: null, rcsNumero: null, rcsVille: null };
    expect(completudeSociete(ei)).toEqual([]);
  });

  it("reconnaît les formes sans capital, quelle qu'en soit la casse", () => {
    expect(estSociete("SASU")).toBe(true);
    expect(estSociete("SARL")).toBe(true);
    expect(estSociete("ei")).toBe(false);
    expect(estSociete("Entreprise individuelle")).toBe(false);
    expect(estSociete("auto-entrepreneur")).toBe(false);
    // Tant que la forme n'est pas connue, on ne présume rien.
    expect(estSociete("")).toBe(false);
  });

  /* Le téléphone et l'e-mail rendent la facture utilisable, ils ne la rendent
     pas régulière : ils ne doivent jamais apparaître parmi les manques. */
  it("range le téléphone et l'e-mail parmi les recommandations", () => {
    expect(completudeSociete(SASU)).toEqual([]);
    const conseils = recommandationsSociete(SASU).map((a) => a.champ);
    expect(conseils).toEqual(["telephone", "email", "iban", "bic"]);
  });
});
