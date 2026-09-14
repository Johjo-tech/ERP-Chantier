/**
 * Lecture de l'export d'articles du logiciel de gestion.
 *
 * Le fichier n'est pas du CSV conforme, et ces cas tiennent chacune des raisons
 * pour lesquelles il ne l'est pas : encodage Windows-1252, guillemets non
 * échappés, libellés manquants, familles de TVA inconnues, lignes décalées.
 *
 * Logique pure : rien n'atteint la base ni le navigateur.
 */

import { describe, it, expect } from "vitest";
import {
  analyserExportArticles,
  decoderFichierArticles,
  decouperLigne,
  enteteConforme,
  rapportRejetsCsv,
  COLONNES_ATTENDUES,
} from "@/api/regles-import-articles";
import { codeUnite } from "@/api/regles-en16931";

const ENTETE = COLONNES_ATTENDUES.join(";");

/** Une ligne de l'export, dans l'ordre des 18 colonnes. */
function ligne(champs: Partial<Record<string, string>> = {}): string {
  const v: Record<string, string> = {
    Actif: "1",
    TypeArt: "SERV",
    CodeArticle: "PLB-001",
    PVHT: "11.220000",
    Libelle1: "Remplacement siphon",
    PVTTC: "12.34",
    BlocNote: "",
    Mesure: "UNI",
    "Date de création": "01/01/2020",
    "Date de modification": "02/02/2021",
    FamilleArt1: "PLOMBERIE",
    PANet: "5.500000",
    FamilleTVA: "INTER",
    FamilleComptableArt: "706",
    GereEnStock: "0",
    FamilleArt2: "",
    FamilleArt3: "",
    FamilleTarifs: "",
    ...champs,
  };
  return COLONNES_ATTENDUES.map((c) => v[c] ?? "").join(";");
}

const fichier = (...lignes: string[]) => [ENTETE, ...lignes].join("\r\n");

describe("Encodage du fichier", () => {
  /* Le défaut le plus coûteux : lu en UTF-8, tout le catalogue ressort avec des
     accents cassés, et personne ne s'en aperçoit avant d'imprimer un devis. */
  it("rend les accents français, encodés en Windows-1252", () => {
    // « Réfection d'une évacuation » en cp1252 : é = 0xE9
    const octets = Uint8Array.from([
      0x52, 0xe9, 0x66, 0x65, 0x63, 0x74, 0x69, 0x6f, 0x6e, 0x20, 0x64, 0x27,
      0x75, 0x6e, 0x65, 0x20, 0xe9, 0x76, 0x61, 0x63, 0x75, 0x61, 0x74, 0x69,
      0x6f, 0x6e,
    ]);
    expect(decoderFichierArticles(octets)).toBe("Réfection d'une évacuation");
  });

  it("ne casse pas sur un octet aberrant", () => {
    expect(() => decoderFichierArticles(Uint8Array.from([0x41, 0x81, 0x42]))).not.toThrow();
  });
});

describe("Découpe des lignes", () => {
  /* Un parseur CSV conforme prendrait ce guillemet pour un délimiteur, avalerait
     le point-virgule suivant, et le prix d'un article atterrirait dans sa TVA. */
  it("ne traite pas les guillemets comme des délimiteurs", () => {
    expect(decouperLigne('Tube 1/2";10.00;UNI')).toEqual(['Tube 1/2"', "10.00", "UNI"]);
  });

  it("garde les champs vides à leur place", () => {
    expect(decouperLigne("a;;c")).toEqual(["a", "", "c"]);
  });
});

describe("En-tête", () => {
  it("reconnaît l'en-tête de l'export", () => {
    expect(enteteConforme(ENTETE)).toBe(true);
  });

  // Un fichier exporté en UTF-8 porte souvent une marque d'ordre des octets.
  it("tolère une marque d'ordre des octets en tête", () => {
    expect(enteteConforme("﻿" + ENTETE)).toBe(true);
  });

  it("refuse un fichier qui n'est pas cet export", () => {
    expect(enteteConforme("Code;Libellé;Prix")).toBe(false);
  });
});

describe("Lecture d'un export", () => {
  it("lit une ligne ordinaire de bout en bout", () => {
    const { articles, rejets, signalements } = analyserExportArticles(fichier(ligne()));

    expect(rejets).toEqual([]);
    expect(signalements).toEqual([]);
    expect(articles).toEqual([
      {
        code: "PLB-001",
        designation: "Remplacement siphon",
        description: null,
        prix_unitaire: 11.22,
        prix_achat: 5.5,
        unite: "u",
        type_article: "service",
        tva: 10,
        actif: true,
        gere_en_stock: false,
        famille: "PLOMBERIE",
      },
    ]);
  });

  it("distingue un bien d'une prestation", () => {
    const { articles } = analyserExportArticles(
      fichier(ligne({ TypeArt: "BIEN", CodeArticle: "A" }), ligne({ TypeArt: "SERV", CodeArticle: "B" }))
    );
    expect(articles.map((a) => a.type_article)).toEqual(["bien", "service"]);
  });

  it("reprend la note complète en description", () => {
    const note = "Pose comprise, évacuation à reprendre si le support est dégradé.";
    const { articles } = analyserExportArticles(fichier(ligne({ BlocNote: note })));
    expect(articles[0].description).toBe(note);
  });
});

describe("Désignation manquante", () => {
  /* Sans libellé mais avec une note, l'article reste utilisable : on prend le
     début de la note plutôt que de perdre la référence. */
  it("se rabat sur le début de la note, et le signale", () => {
    const note = "A".repeat(200);
    const { articles, signalements } = analyserExportArticles(
      fichier(ligne({ Libelle1: "", BlocNote: note }))
    );
    expect(articles[0].designation).toHaveLength(80);
    expect(signalements[0].motif).toMatch(/note/i);
  });

  it("rejette la ligne quand les deux sont vides", () => {
    const { articles, rejets } = analyserExportArticles(
      fichier(ligne({ Libelle1: "", BlocNote: "" }))
    );
    expect(articles).toEqual([]);
    expect(rejets[0].ligne).toBe(2);
    expect(rejets[0].motif).toMatch(/désignation/i);
  });
});

describe("Familles de TVA", () => {
  it.each([
    ["INTER", 10],
    ["NORMA", 20],
    ["EXO", 0],
    ["0", 0],
  ])("traduit « %s » en %i %%", (famille, attendu) => {
    const { articles, signalements } = analyserExportArticles(
      fichier(ligne({ FamilleTVA: famille }))
    );
    expect(articles[0].tva).toBe(attendu);
    expect(signalements).toEqual([]);
  });

  /* Une famille inconnue ne doit pas faire échouer l'import, mais elle ne doit
     pas non plus passer inaperçue : 20 % est le taux le plus probable, et le
     rapport dit sur quels articles on a tranché. */
  it("retombe sur 20 % et le signale quand la famille est inconnue", () => {
    const { articles, signalements } = analyserExportArticles(
      fichier(ligne({ FamilleTVA: "SUPER" }))
    );
    expect(articles[0].tva).toBe(20);
    expect(signalements[0].motif).toMatch(/SUPER.*inconnue/i);
  });
});

describe("Unités", () => {
  it.each([
    ["UNI", "u", "C62"],
    ["M2", "m²", "MTK"],
    ["M", "m", "MTR"],
    ["M3", "m³", "MTQ"],
    ["HR", "h", "HUR"],
    ["JOUR", "jour", "DAY"],
    ["PC", "pièce", "C62"],
    ["MM", "mm", "MMT"],
  ])("traduit « %s » en « %s », codé %s", (fichierUnite, unite, code) => {
    const { articles } = analyserExportArticles(fichier(ligne({ Mesure: fichierUnite })));
    expect(articles[0].unite).toBe(unite);
    // Le code UNECE suit, c'est lui qui part sur la facture électronique.
    expect(codeUnite(articles[0].unite)).toBe(code);
  });

  it("laisse l'unité vide et le signale quand elle est inconnue", () => {
    const { articles, signalements } = analyserExportArticles(
      fichier(ligne({ Mesure: "TONNEAU" }))
    );
    expect(articles[0].unite).toBeNull();
    expect(signalements[0].motif).toMatch(/TONNEAU/);
  });
});

describe("Prix", () => {
  it("met 0 et le signale quand le prix de vente manque", () => {
    const { articles, signalements } = analyserExportArticles(fichier(ligne({ PVHT: "" })));
    expect(articles[0].prix_unitaire).toBe(0);
    expect(signalements[0].motif).toMatch(/prix/i);
  });

  it("laisse le prix d'achat nul quand il manque", () => {
    const { articles } = analyserExportArticles(fichier(ligne({ PANet: "" })));
    expect(articles[0].prix_achat).toBeNull();
  });

  // Certains exports emploient la virgule décimale malgré le point-virgule.
  it("accepte la virgule décimale", () => {
    const { articles } = analyserExportArticles(fichier(ligne({ PVHT: "11,22" })));
    expect(articles[0].prix_unitaire).toBe(11.22);
  });
});

describe("Lignes inexploitables", () => {
  it("rejette une ligne qui n'a pas ses 18 champs, avec son numéro", () => {
    const { articles, rejets } = analyserExportArticles(
      fichier(ligne(), "1;SERV;TROP-COURT;10.00")
    );
    expect(articles).toHaveLength(1);
    expect(rejets[0].ligne).toBe(3);
    expect(rejets[0].motif).toMatch(/4 champs au lieu de 18/);
  });

  it("rejette une ligne sans code article", () => {
    const { rejets } = analyserExportArticles(fichier(ligne({ CodeArticle: "  " })));
    expect(rejets[0].motif).toMatch(/[Cc]ode article absent/);
  });

  /* Le dernier gagnerait silencieusement : on garde le premier et on nomme le
     conflit, sinon un prix écrasé ne se voit qu'à la facture. */
  it("garde le premier de deux codes identiques et rejette le second", () => {
    const { articles, rejets } = analyserExportArticles(
      fichier(ligne({ PVHT: "10.00" }), ligne({ PVHT: "99.00" }))
    );
    expect(articles).toHaveLength(1);
    expect(articles[0].prix_unitaire).toBe(10);
    expect(rejets[0].motif).toMatch(/déjà présent/);
  });

  it("refuse un fichier dont l'en-tête n'est pas celui de l'export", () => {
    const { rejets } = analyserExportArticles("Code;Libellé\r\nA;B");
    expect(rejets[0].ligne).toBe(1);
    expect(rejets[0].motif).toMatch(/En-tête/);
  });

  it("ignore les lignes vides de fin de fichier", () => {
    const { articles, rejets } = analyserExportArticles(fichier(ligne()) + "\r\n\r\n");
    expect(articles).toHaveLength(1);
    expect(rejets).toEqual([]);
  });
});

describe("Rapport des rejets", () => {
  it("se relit dans un tableur, guillemets compris", () => {
    const csv = rapportRejetsCsv([
      { ligne: 7, motif: 'Ligne « mal "formée" »', contenu: 'a;b;"c' },
    ]);
    expect(csv.split("\r\n")[0]).toBe("Ligne;Motif;Contenu");
    expect(csv).toContain('"Ligne « mal ""formée"" »"');
  });
});
