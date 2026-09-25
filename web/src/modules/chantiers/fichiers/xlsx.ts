import { lireZip } from "./zip";

/**
 * Les feuilles d'un classeur .xlsx, en tableaux de cellules texte — ce que
 * l'ancien écran obtenait de SheetJS (`sheet_to_json(…, {header: 1})`).
 *
 * Écart assumé (D-CHA-08) : une cellule numérique rend sa valeur brute
 * (« 1234.5 ») et non son affichage formaté (« 1 234,50 € ») ; la lecture des
 * montants de l'import accepte les deux. Le vieux format binaire .xls n'est pas
 * lu : il faut l'enregistrer en .xlsx ou en CSV.
 */
export interface Classeur {
  noms: string[];
  feuilles: Record<string, string[][]>;
}

const NS_REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";

function xml(entrees: Map<string, Uint8Array>, chemin: string): Document | null {
  const octets = entrees.get(chemin);
  return octets ? new DOMParser().parseFromString(new TextDecoder().decode(octets), "application/xml") : null;
}

/** Le texte d'une chaîne partagée ou en ligne : tous ses `<t>`, runs de mise en forme compris. */
const texteDe = (e: Element) => [...e.getElementsByTagName("t")].map((t) => t.textContent ?? "").join("");

/** « AB12 » → 27 (colonnes numérotées à partir de 0). */
export function indiceColonne(reference: string): number {
  const lettres = /^[A-Z]+/i.exec(reference)?.[0].toUpperCase() ?? "A";
  let n = 0;
  for (const l of lettres) n = n * 26 + (l.charCodeAt(0) - 64);
  return n - 1;
}

function valeurCellule(c: Element, partagees: readonly string[]): string {
  const type = c.getAttribute("t");
  if (type === "inlineStr") return texteDe(c);
  const v = c.getElementsByTagName("v")[0]?.textContent ?? "";
  if (type === "s") return partagees[Number(v)] ?? "";
  if (type === "b") return v === "1" ? "VRAI" : "FAUX";
  return v;
}

function lireFeuille(doc: Document, partagees: readonly string[]): string[][] {
  const rangees: string[][] = [];
  for (const row of doc.getElementsByTagName("row")) {
    const indice = Number(row.getAttribute("r") ?? rangees.length + 1) - 1;
    const cellules: string[] = [];
    let suivante = 0;
    for (const c of row.getElementsByTagName("c")) {
      const ref = c.getAttribute("r");
      const col = ref ? indiceColonne(ref) : suivante;
      while (cellules.length < col) cellules.push("");
      cellules[col] = valeurCellule(c, partagees);
      suivante = col + 1;
    }
    while (rangees.length < indice) rangees.push([]);
    rangees[indice] = cellules;
  }
  return rangees;
}

function cibleDeFeuille(rels: Document | null, rid: string): string | null {
  if (!rels) return null;
  const rel = [...rels.getElementsByTagName("Relationship")].find((r) => r.getAttribute("Id") === rid);
  const cible = rel?.getAttribute("Target");
  if (!cible) return null;
  return cible.startsWith("/") ? cible.slice(1) : `xl/${cible}`;
}

export async function lireClasseur(octets: Uint8Array): Promise<Classeur> {
  const entrees = await lireZip(octets);
  const classeur = xml(entrees, "xl/workbook.xml");
  if (!classeur) throw new Error("Ce fichier n'est pas un classeur Excel (.xlsx).");
  const rels = xml(entrees, "xl/_rels/workbook.xml.rels");
  const partagees = [...(xml(entrees, "xl/sharedStrings.xml")?.getElementsByTagName("si") ?? [])].map(texteDe);
  const resultat: Classeur = { noms: [], feuilles: {} };
  for (const f of classeur.getElementsByTagName("sheet")) {
    const nom = f.getAttribute("name") ?? `Feuille ${resultat.noms.length + 1}`;
    const rid = f.getAttributeNS(NS_REL, "id") ?? f.getAttribute("r:id") ?? "";
    const cible = cibleDeFeuille(rels, rid);
    const doc = cible ? xml(entrees, cible) : null;
    resultat.noms.push(nom);
    resultat.feuilles[nom] = doc ? lireFeuille(doc, partagees) : [];
  }
  return resultat;
}
