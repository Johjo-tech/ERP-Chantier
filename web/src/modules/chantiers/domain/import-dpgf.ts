/**
 * Import d'un DPGF existant (CHA-04, CHA-08) : un tableau de cellules, venu
 * d'un CSV ou d'une feuille Excel, devient des lignes de DPGF.
 *
 * Port À COMPORTEMENT IDENTIQUE de l'ancien écran (app.js l. 13765-13965 :
 * `parseMontantCell`, `parseCSVText`, `guessAllColRoles`, `guessSkipRows`, le
 * choix de la feuille « la plus riche », `confirmDpgfMapping`) —
 * `tests/parite/import-dpgf.essai.ts` le vérifie contre leur source extraite
 * d'app.js. Les bizarreries sont gardées : un DPGF tapé à la main par un maître
 * d'œuvre n'a pas de format, et c'est sur ces heuristiques que les utilisateurs
 * ont appris à préparer leurs fichiers.
 */

export type Cellule = string | number | null | undefined;
export type Rangee = readonly Cellule[];
export type RoleColonne = "designation" | "qte" | "prix" | "ignore";

/** « 1 234,50 € », « 1.234,50 », « 1,234.50 » → nombre ; NaN si illisible. */
export function lireMontantCellule(brut: Cellule): number {
  if (brut == null) return NaN;
  let s = String(brut).trim();
  if (!s) return NaN;
  s = s.replace(/[€$]/g, "").replace(/\s/g, "").trim();
  if (s.includes(",") && s.includes(".")) {
    if (s.lastIndexOf(",") > s.lastIndexOf(".")) s = s.replace(/\./g, "").replace(",", ".");
    else s = s.replace(/,/g, "");
  } else if (s.includes(",")) {
    s = s.replace(",", ".");
  }
  const n = parseFloat(s);
  return isNaN(n) ? NaN : n;
}

/** Séparateur `;` si la première ligne en a et n'a aucune virgule, `,` sinon. Guillemets basculants. */
export function lireCsv(texte: string): string[][] {
  const lignes = texte.split(/\r\n|\n|\r/).filter((l) => l.trim().length);
  const premiere = lignes[0];
  const separateur = premiere && premiere.includes(";") && !premiere.includes(",") ? ";" : ",";
  return lignes.map((ligne) => {
    const cellules: string[] = [];
    let courante = "";
    let entreGuillemets = false;
    for (const ch of ligne) {
      if (ch === '"') entreGuillemets = !entreGuillemets;
      else if (ch === separateur && !entreGuillemets) {
        cellules.push(courante);
        courante = "";
      } else courante += ch;
    }
    cellules.push(courante);
    return cellules.map((c) => c.trim());
  });
}

const MOTS_DESIGNATION = ["désignation", "designation", "libellé", "libelle", "description", "nature", "ouvrage", "poste", "article"];
const MOTS_QUANTITE = ["qté", "qte", "quantité", "quantite", "qty", "quant", "nombre"];
const MOTS_PRIX = ["prix u", "p.u", "pu ht", "prix unit", "p unit", "px u", "unitaire", "prix en"];

/** Un code de repérage « 2.1 1 » : des chiffres séparés par des points ou des espaces. */
const ressembleAUnRepere = (v: Cellule) => /^\s*\d+([.\s]\d+)*\s*$/.test(String(v)) && /[.\s]/.test(String(v).trim());

function colonneParEntete(entete: Rangee, nbColonnes: number, prises: Set<number>, mots: readonly string[]): number {
  for (let c = 0; c < nbColonnes; c++) {
    if (prises.has(c)) continue;
    const h = String(entete[c] ?? "").toLowerCase();
    if (mots.some((m) => h.includes(m))) return c;
  }
  return -1;
}

/** Le rôle de chaque colonne : par l'en-tête d'abord, puis par le contenu des lignes d'exemple. */
export function devinerRoles(entete: Rangee, exemples: readonly Rangee[], nbColonnes: number): RoleColonne[] {
  const roles: RoleColonne[] = new Array<RoleColonne>(nbColonnes).fill("ignore");
  const prises = new Set<number>();
  const prendre = (c: number, role: RoleColonne) => {
    if (c === -1) return;
    roles[c] = role;
    prises.add(c);
  };
  const cDesignation = colonneParEntete(entete, nbColonnes, prises, MOTS_DESIGNATION);
  prendre(cDesignation, "designation");
  const cQte = colonneParEntete(entete, nbColonnes, prises, MOTS_QUANTITE);
  prendre(cQte, "qte");
  prendre(colonneParEntete(entete, nbColonnes, prises, MOTS_PRIX), "prix");
  for (let c = 0; c < nbColonnes; c++) {
    if (prises.has(c)) continue;
    let nombres = 0;
    let textes = 0;
    let reperes = 0;
    let remplies = 0;
    for (const r of exemples) {
      const v = r[c];
      if (v == null || String(v).trim() === "") continue;
      remplies++;
      if (ressembleAUnRepere(v)) reperes++;
      else if (!isNaN(lireMontantCellule(v))) nombres++;
      else textes++;
    }
    if (remplies === 0) continue;
    if (reperes > nombres && reperes > textes) continue;
    if (cDesignation === -1 && textes >= nombres && textes > 0) {
      prendre(c, "designation");
      continue;
    }
    if (cQte === -1 && nombres > 0) prendre(c, "qte");
  }
  return roles;
}

/** Le nombre de lignes d'en-tête : jusqu'à la première qui parle de désignation, quantité ou prix (30 premières). */
export function devinerLignesAIgnorer(rangees: readonly Rangee[]): number {
  for (let i = 0; i < Math.min(rangees.length, 30); i++) {
    const texte = (rangees[i] ?? []).join(" ").toLowerCase();
    if (["désignation", "designation", "quantité", "quantite", "prix"].some((k) => texte.includes(k))) return i + 1;
  }
  return 0;
}

/** La feuille qui porte le plus de cellules numériques — pas la page de garde. */
export function feuilleLaPlusRiche(feuilles: Readonly<Record<string, readonly Rangee[]>>, noms: readonly string[]): string {
  let meilleure = noms[0] ?? "";
  let meilleurScore = -1;
  for (const nom of noms) {
    let score = 0;
    for (const r of feuilles[nom] ?? []) {
      for (const c of r ?? []) if (!isNaN(lireMontantCellule(c)) && String(c).trim() !== "") score++;
    }
    if (score > meilleurScore) {
      meilleurScore = score;
      meilleure = nom;
    }
  }
  return meilleure;
}

export function nombreDeColonnes(rangees: readonly Rangee[]): number {
  return Math.max(1, ...rangees.map((r) => (r ?? []).length));
}

/** Rôles devinés pour un nombre de lignes d'en-tête donné (`recomputeDpgfColRoles`). */
export function rolesPour(rangees: readonly Rangee[], aIgnorer: number): RoleColonne[] {
  const entete = rangees[Math.max(0, aIgnorer - 1)] ?? [];
  return devinerRoles(entete, rangees.slice(aIgnorer, aIgnorer + 15), nombreDeColonnes(rangees));
}

export interface LigneImportee {
  type: "ligne" | "chapitre";
  designation: string;
  quantite: number;
  prix_unitaire: number;
}

export type ResultatImport = { ok: true; lignes: LigneImportee[] } | { ok: false; motif: string };

/** Une ligne sans quantité ni prix est un titre de chapitre ; une ligne sans désignation est sautée. */
export function lignesDepuisCorrespondance(rangees: readonly Rangee[], aIgnorer: number, roles: readonly RoleColonne[]): ResultatImport {
  const iDesignation = roles.indexOf("designation");
  const iQte = roles.indexOf("qte");
  const iPrix = roles.indexOf("prix");
  if (iDesignation === -1) return { ok: false, motif: "Indiquez au moins quelle colonne contient la désignation." };
  const lignes: LigneImportee[] = [];
  for (let i = aIgnorer; i < rangees.length; i++) {
    const r = rangees[i];
    if (!r) continue;
    const designation = String(r[iDesignation] ?? "").trim();
    if (!designation) continue;
    const qte = iQte !== -1 ? lireMontantCellule(r[iQte]) : NaN;
    const prix = iPrix !== -1 ? lireMontantCellule(r[iPrix]) : NaN;
    const quantite = isNaN(qte) ? 0 : qte;
    const prix_unitaire = isNaN(prix) ? 0 : prix;
    if (!quantite && !prix_unitaire) lignes.push({ type: "chapitre", designation, quantite: 0, prix_unitaire: 0 });
    else lignes.push({ type: "ligne", designation, quantite, prix_unitaire });
  }
  if (!lignes.length) return { ok: false, motif: "Aucune ligne exploitable avec cette correspondance." };
  return { ok: true, lignes };
}

/** Ce que le navigateur sait analyser ; le reste (PDF…) est seulement archivé (app.js l. 14134). */
export function estAnalysable(nomFichier: string): boolean {
  return /\.(xlsx|xls|csv)$/i.test(nomFichier);
}
