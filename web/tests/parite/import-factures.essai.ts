/**
 * Parité de la reprise d'historique (IMP-20 à IMP-22) : le port de web/ lit
 * chaque couple en-têtes + lignes EXACTEMENT comme
 * src/api/regles-import-factures.ts, importé tel quel — mêmes pièces, rejets,
 * signalements, totaux, même verdict d'incohérence ; et `pieceAEcrire` écrit
 * la même pièce que src/integrations/factures-import.ts.
 *
 * Les montants sont tirés au dixième d'euro et les taux parmi 0, 10 et 20 % :
 * web/ calcule en décimal exact (D-EFA-02), et ce tirage évite les
 * demi-centimes où un flottant et un décimal s'arrondissent différemment.
 */
import { describe, expect, it } from "vitest";
import * as ancien from "../../../src/api/regles-import-factures";
import { construireApercuFactures, pieceAEcrire } from "../../src/modules/import-export/domain/apercu-factures";
import * as nouveau from "../../src/modules/import-export/domain/factures";
import { generateur } from "./aleatoire";
import { octetsAleatoires } from "./octets";

const g = generateur(20260928);
const TIRAGES = 400;

type Dialecte = { sep: ";" | ","; decimale: "," | "."; entete: string[]; lignes: string[] };
const DIALECTES: Dialecte[] = [
  { sep: ",", decimale: ".", entete: ["numero", "type", "date_facture", "client", "total_ht", "total_tva", "taux_tva", "total_ttc", "statut", "source", "fichier_pdf"], lignes: ["numero", "ordre", "compte_comptable", "libelle", "montant_ht", "taux_tva"] },
  { sep: ";", decimale: ",", entete: ["numero_facture", "type", "date_facture", "date_echeance", "code_client", "client", "montant_ht", "taux_tva", "montant_tva", "montant_ttc"], lignes: ["numero_facture", "num_ligne", "compte_produit", "designation", "montant_ht", "taux_tva"] },
];
const CLIENTS = ["ALPES ISERE HABITAT", "CDC HABITAT", "SCI MILLY", "OPAC 38", "Mme Durand"];

const nb = (d: Dialecte, n: number) => {
  const t = (Math.round(n * 100) / 100).toFixed(2);
  return d.decimale === "," ? t.replace(".", ",") : t;
};
const citer = (d: Dialecte, v: string) => (v.includes(d.sep) || v.includes('"') ? `"${v.replace(/"/g, '""')}"` : v);

interface Piece {
  numero: string;
  ht: number;
  taux: number;
  lignes: number[];
}

function pieces(): Piece[] {
  const liste: Piece[] = [];
  for (let i = 0, n = g.entier(0, 15); i < n; i++) {
    const nbLignes = g.entier(1, 3);
    const lignes = Array.from({ length: nbLignes }, () => g.entier(-50, 4000) / 10);
    const avoir = g.reel() < 0.2;
    const signe = avoir ? -1 : 1;
    const ht = Math.round(lignes.reduce((t, x) => t + Math.abs(x), 0) * 10) / 10;
    liste.push({ numero: g.reel() < 0.05 && liste.length ? (liste[0]?.numero ?? "F") : `FAC${g.chiffres(5)}`, ht: signe * ht, taux: g.parmi([0, 10, 20, 20]), lignes: lignes.map((x) => signe * Math.abs(x)) });
  }
  return liste;
}

function entetes(d: Dialecte, ps: Piece[]): string {
  const rangs = ps.map((p) => {
    const tva = (p.ht * p.taux) / 100 + (g.reel() < 0.05 ? 0.5 : g.reel() < 0.1 ? 0.004 : 0);
    const ttc = p.ht + tva + (g.reel() < 0.04 ? 1 : 0);
    const valeurs: Record<string, string> = {
      numero: p.numero,
      numero_facture: p.numero,
      type: g.reel() < 0.1 ? "" : g.reel() < 0.03 ? "proforma" : g.reel() < 0.04 ? (p.ht < 0 ? "facture" : "avoir") : p.ht < 0 ? "avoir" : "facture",
      date_facture: g.reel() < 0.05 ? "12/03/2025" : `2025-0${g.entier(1, 9)}-1${g.entier(0, 9)}`,
      date_echeance: g.parmi(["", "2025-12-31", "2024-01-01", "fin de mois"]),
      code_client: g.reel() < 0.5 ? `C${g.chiffres(3)}` : "",
      client: g.reel() < 0.05 ? "" : g.parmi(CLIENTS),
      total_ht: nb(d, p.ht),
      montant_ht: g.reel() < 0.02 ? "1.234,5" : nb(d, p.ht),
      total_tva: g.reel() < 0.1 ? "" : nb(d, tva),
      montant_tva: nb(d, tva),
      taux_tva: String(p.taux),
      total_ttc: nb(d, ttc),
      montant_ttc: g.reel() < 0.1 ? "" : nb(d, ttc),
      statut: "importee",
      source: "export",
      fichier_pdf: g.reel() < 0.5 ? `${p.numero}.pdf` : "",
    };
    return d.entete.map((c) => citer(d, valeurs[c] ?? "")).join(d.sep);
  });
  return [d.entete.join(d.sep), ...rangs].join(g.parmi(["\n", "\r\n"]));
}

function lignes(d: Dialecte, ps: Piece[]): string {
  const rangs = ps.flatMap((p, k) =>
    (g.reel() < 0.05 ? [] : p.lignes).map((m, i) => {
      const valeurs: Record<string, string> = {
        numero: p.numero,
        numero_facture: p.numero,
        ordre: String(p.lignes.length - i),
        num_ligne: String(i + 1),
        compte_comptable: g.parmi(["706000", "707100", "", "411000"]),
        compte_produit: g.parmi(["706000", "", "708"]),
        libelle: g.reel() < 0.5 ? "" : `Travaux ${k}; lot ${i}`,
        designation: g.reel() < 0.5 ? "" : "Peinture",
        montant_ht: nb(d, m + (g.reel() < 0.03 ? 5 : 0)),
        taux_tva: g.reel() < 0.2 ? "" : String(p.taux),
      };
      return d.lignes.map((c) => citer(d, valeurs[c] ?? "")).join(d.sep);
    })
  );
  if (g.reel() < 0.1) rangs.push(d.lignes.map((c) => (c.startsWith("numero") ? "ORPHELIN1" : c === "montant_ht" ? "10" : "")).join(d.sep));
  return [d.lignes.join(d.sep), ...rangs].join("\n");
}

/** Six décimales suffisent : au-delà, c'est l'écart entre un flottant et un décimal exact. */
const arrondi = (v: unknown): unknown =>
  typeof v === "number" ? Math.round(v * 1e6) / 1e6 : Array.isArray(v) ? v.map(arrondi) : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, arrondi(x)])) : v;

describe("parité de la reprise d'historique", () => {
  it(`${TIRAGES} couples de fichiers : mêmes pièces, rejets, signalements, totaux, verdict`, () => {
    let pieceLues = 0;
    let incoherents = 0;
    for (let i = 0; i < TIRAGES; i++) {
      const d = g.parmi(DIALECTES);
      const ps = pieces();
      const e = octetsAleatoires(g, entetes(d, ps));
      const l = g.reel() < 0.6 ? new TextEncoder().encode(lignes(d, ps)) : null;
      const options = g.reel() < 0.5 ? {} : { categorieTauxZero: g.parmi(["E", "AE", "Z", "O"] as const) };
      const a = ancien.analyserExportFactures(e, l, options);
      expect(arrondi(nouveau.analyserExportFactures(e, l, options)), `tirage ${i}`).toEqual(arrondi(a));
      pieceLues += a.factures.length;
      if (a.incoherent) incoherents++;
    }
    expect(pieceLues).toBeGreaterThan(500);
    expect(incoherents).toBeGreaterThan(20);
    expect(incoherents).toBeLessThan(TIRAGES);
  });

  it("nature du fichier, nombres, dates, séparateur, rapprochement : mêmes décisions", () => {
    for (const d of DIALECTES) {
      const ps = pieces();
      for (const t of [entetes(d, ps), lignes(d, ps), "numero;client\nX;Y"]) {
        const o = new TextEncoder().encode(t);
        expect(nouveau.natureDuFichier(o)).toBe(ancien.natureDuFichier(o));
        expect(nouveau.separateurDe(t)).toBe(ancien.separateurDe(t));
      }
    }
    for (const v of ["-276.40", "-665,00", "1,234.56", " 12 ", "", "abc", "1 200,5"]) expect(nouveau.nombre(v)).toBe(ancien.nombre(v));
    for (const v of ["2025-03-12", "12/03/2025", " 2025-03-12 ", "2025-3-12"]) expect(nouveau.dateIso(v)).toBe(ancien.dateIso(v));
    for (const c of ["706000", "707", "411000", ""]) expect(nouveau.designationDuCompte(c)).toBe(ancien.designationDuCompte(c));
    const existants = [
      { id: "1", nom: "ALPES ISERE HABITAT OFFICE PUBLIC DE L'HABITAT (ALPES ISERE HABITAT)", cadre: "B2G" },
      { id: "2", nom: "CDC HABITAT", cadre: null },
      { id: "3", nom: "CDC HABITAT SOCIAL", cadre: null },
      { id: "4", nom: "SCI MILLYON", cadre: null },
    ];
    for (const n of ["Alpes Isère Habitat", "CDC HABITAT", "cdc", "SCI MILLY", "", "Inconnu"]) {
      expect(nouveau.rapprocherClient(n, existants)).toEqual(ancien.rapprocherClient(n, existants));
    }
    for (const x of ["compta:F1", "facture:F1", null, "COMPTA:F1"]) expect(nouveau.estPieceHistorique(x)).toBe(ancien.estPieceHistorique(x));
    expect(nouveau.legacyDuNumero("FAC000452")).toBe(ancien.legacyDuNumero("FAC000452"));
    expect(nouveau.DESIGNATION_SANS_LIGNES).toBe(ancien.DESIGNATION_SANS_LIGNES);
  });

  it("la pièce écrite est celle de l'ancien (brouillon → lignes → numéro, legacy « compta: », valeurs absolues)", () => {
    const d = DIALECTES[1] as Dialecte;
    const rapport = nouveau.analyserExportFactures(new TextEncoder().encode(entetes(d, pieces())), null, { categorieTauxZero: "E" });
    const client = { id: "c1", nom: "CDC HABITAT", cadre: "B2G" };
    for (const f of rapport.factures) {
      const p = pieceAEcrire(f, g.reel() < 0.5 ? client : null, "payée");
      expect(p.entete.legacy_id).toBe(`compta:${f.numero}`);
      expect(p.entete.total_ht).toBeGreaterThanOrEqual(0);
      expect(p.lignes.every((l) => l.quantite === 1 && l.prix_unitaire === l.montant_ht && l.montant_ht >= 0)).toBe(true);
    }
    const apercu = construireApercuFactures(rapport, [client], new Set(rapport.factures.slice(0, 1).map((f) => f.numero)));
    expect(apercu.collisions).toHaveLength(Math.min(1, rapport.factures.length));
    expect(apercu.pieces.every((p) => p.statut === "payée")).toBe(true);
  });
});
