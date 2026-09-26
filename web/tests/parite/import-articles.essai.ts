/**
 * Parité de l'import d'articles (ART-05, ART-21, IMP-01 à IMP-06, RM-06) : le
 * port de web/ doit lire chaque fichier EXACTEMENT comme le module historique,
 * importé tel quel — mêmes articles, mêmes rejets, mêmes signalements, même
 * encodage constaté, même rapport CSV.
 *
 * Les fichiers sont tirés au hasard à graine fixe, en visant ce qui a déjà
 * cassé ou pourrait casser : en-têtes dans le désordre, colonnes absentes,
 * inconnues ou en double, guillemets non échappés, `;` égarés, codes TVA en
 * minuscules ou inconnus, encodages différents fournis en OCTETS.
 */
import { describe, expect, it } from "vitest";
import * as ancienEncodage from "../../../src/api/regles-encodage";
import * as ancien from "../../../src/api/regles-import-articles";
import * as nouveau from "../../src/modules/articles/domain/import";
import { generateur } from "./aleatoire";

const g = generateur(20260925);
const TIRAGES = 600;

const INCONNUES = ["Remarque", "CodeBarre", "PVHT2", "", " ", "codearticle"];
const CODES_TVA = ["INTER", "inter", "Norma", "NORMA", "EXO", "exo", "0", " 0 ", "", "TVA55", "5.5", "norma "];
const MESURES = ["UNI", "uni", "M", "M2", "m3", "HR", "PC", "MM", "JOUR", "jour", "ML", "", " M2 ", "KG"];
const MOTS = ["Réfection", "Tube 1/2\"", "Évier", "Plâtre", "Cloison \"BA13\"", "Œuvre", "Prix 12€", "Façade", "Ragréage", "câble 2,5mm²"];
const PRIX = ["12,50", "12.50", "0", "", " 7 ", "abc", "1e3", "1 200,00", "-4,2", "3,14,15", "0x10"];

function valeur(colonne: string, i: number, codes: string[]): string {
  switch (colonne) {
    case "CodeArticle": {
      // Des codes répétés, et parfois vides : le premier seul doit passer.
      const code = g.reel() < 0.1 && codes.length ? g.parmi(codes) : g.reel() < 0.05 ? "" : `A${i}${g.chiffres(2)}`;
      codes.push(code);
      return g.reel() < 0.1 ? ` ${code} ` : code;
    }
    case "Libelle1":
      return g.reel() < 0.1 ? "" : `${g.parmi(MOTS)} ${g.chiffres(2)}`;
    case "BlocNote":
      return g.reel() < 0.5 ? "" : Array.from({ length: g.entier(1, 20) }, () => g.parmi(MOTS)).join(" ");
    case "PVHT":
    case "PANet":
    case "PVTTC":
      return g.parmi(PRIX);
    case "FamilleTVA":
      return g.parmi(CODES_TVA);
    case "Mesure":
      return g.parmi(MESURES);
    case "TypeArt":
      return g.parmi(["BIEN", "bien", "SERV", "", " Bien "]);
    case "Actif":
    case "GereEnStock":
      return g.parmi(["1", "0", "", " 1", "oui"]);
    case "FamilleArt1":
      return g.parmi(["PLOMB", "ÉLEC", "", " Peinture "]);
    default:
      return g.reel() < 0.5 ? "" : g.chiffres(3);
  }
}

function enteteAleatoire(): string[] {
  const colonnes = ancien.COLONNES_ATTENDUES.filter((c) => {
    const requise = (ancien.COLONNES_REQUISES as readonly string[]).includes(c);
    // Une requise manque rarement (fichier refusé en bloc), les autres souvent.
    return g.reel() < (requise ? 0.96 : 0.7);
  });
  const entete: string[] = [...colonnes];
  if (g.reel() < 0.3) entete.push(g.parmi(INCONNUES));
  if (g.reel() < 0.15 && colonnes.length) entete.push(g.parmi(colonnes));
  // Mélange de Fisher-Yates : l'ordre du fichier ne doit rien changer.
  for (let i = entete.length - 1; i > 0; i--) {
    const j = g.entier(0, i);
    [entete[i], entete[j]] = [entete[j] as string, entete[i] as string];
  }
  return entete.map((c) => (g.reel() < 0.1 ? ` ${c} ` : c));
}

function fichierAleatoire(): string {
  const entete = enteteAleatoire();
  const codes: string[] = [];
  const lignes = [entete.join(";")];
  const nb = g.entier(0, 25);
  for (let i = 0; i < nb; i++) {
    if (g.reel() < 0.05) {
      lignes.push(g.parmi(["", "   "]));
      continue;
    }
    let ligne = entete.map((c) => valeur(c.trim(), i, codes)).join(";");
    // Un `;` égaré dans un libellé : la ligne doit être rejetée, pas décalée.
    if (g.reel() < 0.08) ligne = ligne.replace(";", ";;");
    if (g.reel() < 0.05) ligne = ligne.slice(0, ligne.lastIndexOf(";"));
    lignes.push(ligne);
  }
  const fin = g.parmi(["\r\n", "\n", "\r"]);
  const texte = lignes.join(fin) + (g.reel() < 0.5 ? fin : "");
  return g.reel() < 0.1 ? `\uFEFF${texte}` : texte;
}

/** Windows-1252 : latin-1 pour l'essentiel, plus les quelques signes de 0x80-0x9F qu'on emploie. */
const SPECIAUX_1252: Record<string, number> = { "€": 0x80, "Œ": 0x8c, "œ": 0x9c };
function en1252(texte: string): Uint8Array | null {
  const octets: number[] = [];
  for (const c of texte) {
    const special = SPECIAUX_1252[c];
    const point = c.codePointAt(0) ?? 0;
    if (special !== undefined) octets.push(special);
    else if (point < 0x80 || (point >= 0xa0 && point <= 0xff)) octets.push(point);
    else return null;
  }
  return Uint8Array.from(octets);
}

function enUtf16(texte: string, petitBoutiste: boolean): Uint8Array {
  const octets = [petitBoutiste ? 0xff : 0xfe, petitBoutiste ? 0xfe : 0xff];
  for (let i = 0; i < texte.length; i++) {
    const u = texte.charCodeAt(i);
    octets.push(...(petitBoutiste ? [u & 0xff, u >> 8] : [u >> 8, u & 0xff]));
  }
  return Uint8Array.from(octets);
}

function octetsAleatoires(texte: string): Uint8Array {
  const sansBom = texte.replace(/^\uFEFF/, "");
  const choix = g.entier(0, 4);
  if (choix === 0) return new TextEncoder().encode(texte);
  if (choix === 1) return Uint8Array.from([0xef, 0xbb, 0xbf, ...new TextEncoder().encode(sansBom)]);
  if (choix === 2) return en1252(sansBom) ?? new TextEncoder().encode(texte);
  return enUtf16(sansBom, choix === 3);
}

/** Ce que l'ancien écran faisait du fichier (`window.lireExportArticles`), recomposé depuis ses modules. */
function lectureAncienne(octets: Uint8Array) {
  const rapport = ancien.analyserExportArticles(ancien.decoderFichierArticles(octets));
  rapport.signalements.unshift({ ligne: 1, motif: `Fichier lu en ${ancien.encodageDuFichier(octets)}.` });
  return rapport;
}

describe("parité de l'import d'articles", () => {
  it(`${TIRAGES} fichiers tirés au hasard donnent les mêmes articles, rejets et signalements`, () => {
    let articles = 0;
    let rejets = 0;
    for (let i = 0; i < TIRAGES; i++) {
      const texte = fichierAleatoire();
      const octets = octetsAleatoires(texte);
      const avant = lectureAncienne(octets);
      const { encodage, ...apres } = nouveau.lireFichierArticles(octets);
      expect(apres, JSON.stringify(texte)).toEqual(avant);
      expect(encodage).toBe(ancienEncodage.decoderTexte(octets).encodage);
      expect(nouveau.analyserExportArticles(texte)).toEqual(ancien.analyserExportArticles(texte));
      expect(nouveau.rapportRejetsCsv(apres.rejets)).toBe(ancien.rapportRejetsCsv(avant.rejets));
      articles += avant.articles.length;
      rejets += avant.rejets.length;
    }
    // Le tirage doit réellement exercer les deux issues, sinon il ne prouve rien.
    expect(articles).toBeGreaterThan(1000);
    expect(rejets).toBeGreaterThan(200);
  });

  it("l'en-tête se lit pareil, colonne par colonne", () => {
    for (let i = 0; i < TIRAGES; i++) {
      const ligne = enteteAleatoire().join(";");
      expect(nouveau.analyserEntete(ligne)).toEqual(ancien.analyserEntete(ligne));
    }
  });

  it("chaque encodage est constaté pareil", () => {
    const texte = "CodeArticle;Libelle1\nA1;Réfection façade 12€";
    const variantes: Uint8Array[] = [
      new TextEncoder().encode(texte),
      Uint8Array.from([0xef, 0xbb, 0xbf, ...new TextEncoder().encode(texte)]),
      en1252(texte) as Uint8Array,
      enUtf16(texte, true),
      enUtf16(texte, false),
    ];
    const constates = variantes.map((o) => nouveau.decoderTexte(o).encodage);
    expect(constates).toEqual(["utf-8", "utf-8-bom", "windows-1252", "utf-16le", "utf-16be"]);
    for (const o of variantes) {
      expect(nouveau.decoderTexte(o)).toEqual(ancienEncodage.decoderTexte(o));
      expect(nouveau.lireFichierArticles(o).articles[0]?.designation).toBe("Réfection façade 12€");
    }
  });
});

describe("codes TVA du catalogue (RM-06, ART-21)", () => {
  const lire = (tva: string) => nouveau.analyserExportArticles(`CodeArticle;Libelle1;FamilleTVA\nA1;Tube;${tva}`);

  it.each([
    ["INTER", 10],
    ["inter", 10],
    ["NORMA", 20],
    ["Norma", 20],
    ["EXO", 0],
    ["exo", 0],
    ["0", 0],
    [" INTER ", 10],
  ])("« %s » → %d pour cent, sans signalement", (code, taux) => {
    const r = lire(code);
    expect(r.articles[0]?.tva).toBe(taux);
    expect(r.signalements.filter((s) => s.code)).toEqual([]);
  });

  it.each(["TVA55", "5.5", "", "20"])("« %s » inconnu → 20 pour cent ET signalement", (code) => {
    const r = lire(code);
    expect(r.articles[0]?.tva).toBe(20);
    expect(r.signalements.filter((s) => s.code)).toEqual([{ ligne: 2, code: "A1", motif: `Famille de TVA « ${code.trim() || "vide"} » inconnue : 20 % appliqué.` }]);
  });

  it("colonne absente → 20 % partout, dit une seule fois pour le fichier", () => {
    const r = nouveau.analyserExportArticles("CodeArticle;Libelle1\nA1;Tube\nA2;Coude");
    expect(r.articles.map((a) => a.tva)).toEqual([20, 20]);
    expect(r.signalements.filter((s) => s.motif.includes("FamilleTVA"))).toEqual([
      { ligne: 1, motif: "colonne « FamilleTVA » absente : 20 % appliqué partout." },
    ]);
  });

  it("l'exemple de la règle : guillemet non échappé, unité inconnue, bien, actif", () => {
    const r = nouveau.analyserExportArticles('CodeArticle;Libelle1;PVHT;FamilleTVA;Mesure;TypeArt;Actif\nA1;Tube 1/2";12,50;INTER;ML;BIEN;1');
    expect(r.articles[0]).toMatchObject({ code: "A1", designation: 'Tube 1/2"', prix_unitaire: 12.5, tva: 10, unite: null, type_article: "bien", actif: true });
    expect(r.signalements.some((s) => s.motif === "Unité « ML » inconnue : laissée vide.")).toBe(true);
  });

  it("unités du fichier (IMP-04)", () => {
    const mesures = ["UNI", "M", "M2", "M3", "HR", "PC", "MM", "JOUR"];
    const texte = ["CodeArticle;Libelle1;Mesure", ...mesures.map((m, i) => `A${i};X;${m.toLowerCase()}`)].join("\n");
    expect(nouveau.analyserExportArticles(texte).articles.map((a) => a.unite)).toEqual(["u", "m", "m²", "m³", "h", "pièce", "mm", "jour"]);
  });

  it("le rapport téléchargé réunit rejets et signalements, triés, avec BOM", () => {
    const r = nouveau.analyserExportArticles("CodeArticle;Libelle1;FamilleTVA\nA1;Tube;X\nA1;Double;INTER\n;Sans code;INTER");
    const csv = nouveau.fichierRapport(r);
    expect(csv.startsWith("\uFEFFLigne;Motif;Contenu\r\n")).toBe(true);
    const numeros = csv.split("\r\n").slice(1).map((l) => Number(l.split(";")[0]));
    expect(numeros).toEqual([...numeros].sort((a, b) => a - b));
    expect(numeros.filter((n) => n > 1)).toEqual([2, 3, 4]);
    expect(csv).toContain('"en-tête du fichier"');
    expect(csv).toContain('"article A1"');
  });
});
