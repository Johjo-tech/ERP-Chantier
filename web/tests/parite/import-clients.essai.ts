/**
 * Parité de l'import de clients (IMP-10 à IMP-13) : le port de web/ lit chaque
 * fichier EXACTEMENT comme src/api/regles-import-clients.ts, importé tel quel —
 * mêmes clients, rejets, signalements, encodage ; même rapprochement, mêmes
 * délais, mêmes pays. Seul ajout de web/ : `paysExplicite` (D-EFA-07).
 */
import { describe, expect, it } from "vitest";
import * as ancienCsv from "../../../src/api/regles-csv";
import * as ancien from "../../../src/api/regles-import-clients";
import * as nouveau from "../../src/modules/import-export/domain/clients";
import { lireCsv } from "../../src/modules/import-export/domain/csv";
import { generateur } from "./aleatoire";
import { avecCleLuhn, octetsAleatoires } from "./octets";

const g = generateur(20260927);
const TIRAGES = 500;

const NOMS = ["CDC Habitat", "CDC HABITAT", "Société Dauphinoise", "SCI MILLY", "OPAC 38", "Office public « Isère »", "M. Martin", "ÉTABLISSEMENTS ŒUVRE"];
const PAYS = ["FRANCE", "France", "BELGIQUE", "Belgium", "SUISSE", "", "Allemagne", "PORTUGAL", "espagne", " ITALIE "];
const CONDITIONS = ["30 jours fin de mois", "45j", "À réception", "comptant", "paiement immédiat", "60 jours", "fdm 30", "", "selon devis", "30 jours net", "1000 jours"];
const COMMENTAIRES = ["", "ALERTE - ne pas confondre avec CDC HABITAT SOCIAL", "client; fidèle", "ligne 1\nligne 2", 'dit "urgent"', "doublon possible"];

const siren = () => avecCleLuhn(g.chiffres(8));
const siret = (base = siren()) => avecCleLuhn(`${base}${g.chiffres(4)}`);

function valeur(colonne: string): string {
  switch (colonne) {
    case "Nom de l'entreprise":
      return g.reel() < 0.05 ? "" : `${g.parmi(NOMS)}${g.reel() < 0.5 ? "" : ` ${g.chiffres(2)}`}`;
    case "SIRET établissement (14)":
      return g.parmi([siret(), siret(), `${g.chiffres(14)}`, "", `${siren()} ${g.chiffres(5)}`, "356000000" + "00048"]);
    case "Siren":
    case "SIREN (9)":
      return g.parmi([siren(), "", g.chiffres(9), "356000000"]);
    case "Pays":
      return g.parmi(PAYS);
    case "Conditions de paiement":
      return g.parmi(CONDITIONS);
    case "Commentaire":
      return g.parmi(COMMENTAIRES);
    case "Adresse de facturation identique":
      return g.parmi(["Oui", "oui", "Non", ""]);
    case "Numéro":
    case "Numéro facturation":
      return g.parmi(["34", "32Bis", "", "1"]);
    case "Rue":
    case "Rue facturation":
      return g.parmi(["Avenue Grugliasco", "", "rue des Lilas; bât. B"]);
    default:
      return g.reel() < 0.5 ? "" : `v${g.chiffres(3)}`;
  }
}

const citer = (v: string) => (/[;"\n\r]/.test(v) || g.reel() < 0.1 ? `"${v.replace(/"/g, '""')}"` : v);

function fichierAleatoire(): string {
  const colonnes = ancien.COLONNES_ATTENDUES.filter((c) => g.reel() < (c === "Nom de l'entreprise" ? 0.97 : 0.7));
  const entete: string[] = [...colonnes];
  if (g.reel() < 0.2) entete.push(g.parmi(["Remarque", "", "Email"]));
  for (let i = entete.length - 1; i > 0; i--) {
    const j = g.entier(0, i);
    [entete[i], entete[j]] = [entete[j] as string, entete[i] as string];
  }
  const lignes = [entete.map((c) => (g.reel() < 0.1 ? ` ${c} ` : c)).join(";")];
  for (let i = 0, nb = g.entier(0, 20); i < nb; i++) {
    if (g.reel() < 0.05) {
      lignes.push("");
      continue;
    }
    let ligne = entete.map((c) => citer(valeur(c))).join(";");
    if (g.reel() < 0.05) ligne += ";";
    lignes.push(ligne);
  }
  const fin = g.parmi(["\r\n", "\n"]);
  return lignes.join(fin) + (g.reel() < 0.5 ? fin : "");
}

const sansAjout = (r: nouveau.RapportImportClients) => ({ ...r, clients: r.clients.map(({ paysExplicite: _p, ...c }) => c) });

describe("parité de l'import de clients", () => {
  it(`${TIRAGES} fichiers : mêmes clients, rejets, signalements, encodage`, () => {
    let clients = 0;
    let rejets = 0;
    for (let i = 0; i < TIRAGES; i++) {
      const octets = octetsAleatoires(g, fichierAleatoire());
      const a = ancien.analyserExportClients(octets);
      const n = nouveau.analyserExportClients(octets);
      expect(sansAjout(n), `fichier ${i}`).toEqual(a);
      clients += a.clients.length;
      rejets += a.rejets.length;
    }
    expect(clients).toBeGreaterThan(1000);
    expect(rejets).toBeGreaterThan(50);
  });

  it("le CSV conforme se découpe pareil (guillemets doublés, ; et retours dans un champ)", () => {
    for (let i = 0; i < TIRAGES; i++) {
      const texte = fichierAleatoire();
      expect(lireCsv(texte, ";")).toEqual(ancienCsv.lireCsv(texte, ";"));
      expect(lireCsv(texte, ",")).toEqual(ancienCsv.lireCsv(texte, ","));
    }
  });

  it("rapprochement, délais, pays, adresse : mêmes décisions", () => {
    const existants = Array.from({ length: 12 }, (_, i) => ({ id: `c${i}`, nom: g.parmi(NOMS), siret: g.reel() < 0.5 ? siret() : null }));
    existants.push({ id: "dup", nom: existants[0]?.nom ?? "", siret: existants[0]?.siret ?? null });
    for (let i = 0; i < TIRAGES; i++) {
      const c = { nom: g.parmi([...NOMS, "cdc  habitat", "Inconnu"]), siret: g.reel() < 0.3 ? (g.parmi(existants).siret ?? siret()) : g.parmi([null, siret()]) };
      expect(nouveau.rapprocher(c, existants)).toEqual(ancien.rapprocher(c, existants));
    }
    for (const t of [...CONDITIONS, "30 Jours Fin De Mois", "Réception", "0", "999j", null]) {
      expect(nouveau.delaiDesConditions(t)).toEqual(ancien.delaiDesConditions(t));
    }
    for (const n of NOMS) expect(nouveau.cleNom(n)).toBe(ancien.cleNom(n));
    expect(nouveau.adresseRecomposee(" 34 ", "Avenue Grugliasco")).toBe(ancien.adresseRecomposee(" 34 ", "Avenue Grugliasco"));
  });

  it("pays (IMP-11) et conditions (IMP-12) : les cas nommés", () => {
    const pays = (p: string) => nouveau.analyserExportClients(new TextEncoder().encode(`Nom de l'entreprise;Pays\nA;${p}\n`)).clients[0]?.paysCode;
    expect(["FRANCE", "BELGIQUE", "BELGIUM", "SUISSE", "LUXEMBOURG", "ALLEMAGNE", "ESPAGNE", "ITALIE", "", "PORTUGAL"].map(pays)).toEqual(["FR", "BE", "BE", "CH", "LU", "DE", "ES", "IT", "FR", "FR"]);
    expect(nouveau.delaiDesConditions("30 jours fin de mois")).toEqual({ jours: 30, mode: "fin_de_mois" });
    expect(nouveau.delaiDesConditions("45j")).toEqual({ jours: 45, mode: "net" });
    expect(nouveau.delaiDesConditions("à réception")).toEqual({ jours: 0, mode: "net" });
  });
});
