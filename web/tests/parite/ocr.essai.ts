/**
 * Parité de la lecture automatique : rapprochement du client et essentiels.
 * `rapprocherClient` vit dans src/integrations/ocr.ts, qui crée le client
 * Supabase à l'import : on en compare une COPIE VERBATIM (ci-dessous, lignes
 * 344-418 du fichier d'origine), comme pour les formules d'app.js.
 */
import { describe, expect, it } from "vitest";
import * as ancienBc from "../../../src/api/regles-bc";
import { essentielsManquants } from "../../src/modules/ocr/domain/lecture";
import { rapprocherClient } from "../../src/modules/ocr/domain/rapprochement";

function normaliser(nom: string): string {
  return nom.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase()
    .replace(/\b(SA|SAS|SASU|SARL|EURL|SCI|OPH|HLM|SA HLM|OFFICE PUBLIC DE L HABITAT)\b/g, " ")
    .replace(/[^A-Z0-9]+/g, " ").trim();
}
function motsCles(nom: string): string[] {
  const vides = new Set(["DE", "DU", "DES", "LA", "LE", "LES", "ET", "L", "D"]);
  return normaliser(nom).split(" ").filter((m) => m.length > 2 && !vides.has(m));
}
function ancienRapprocher(nomLu: string | null | undefined, clientsConnus: string[]) {
  const lu = (nomLu ?? "").trim();
  if (!lu) return { nom: "", reconnu: false, suggestions: clientsConnus.slice(0, 8) };
  const cible = normaliser(lu);
  const exact = clientsConnus.find((c) => normaliser(c) === cible);
  if (exact) return { nom: exact, reconnu: true, suggestions: [] };
  const inclus = clientsConnus.filter((c) => { const n = normaliser(c); return n.includes(cible) || cible.includes(n); });
  if (inclus.length === 1) return { nom: inclus[0], reconnu: true, suggestions: [] };
  const motsLus = motsCles(lu);
  const scores = clientsConnus.map((c) => { const mots = motsCles(c); const communs = motsLus.filter((m) => mots.includes(m)).length; return { nom: c, score: communs / Math.max(1, Math.min(motsLus.length, mots.length)) }; })
    .filter((x) => x.score > 0).sort((a, b) => b.score - a.score);
  const meilleur = scores[0];
  if (meilleur && meilleur.score >= 0.8 && (!scores[1] || scores[1].score < meilleur.score)) return { nom: meilleur.nom, reconnu: true, suggestions: [] };
  return { nom: lu, reconnu: false, suggestions: [...inclus, ...scores.map((s) => s.nom)].filter((v, i, t) => t.indexOf(v) === i).slice(0, 8) };
}

const CLIENTS = ["OPAC du Rhône", "ALPES ISERE HABITAT (AIH)", "Grand Lyon Habitat", "SCI Les Tilleuls", "Mairie de Villeurbanne", "Lyon Métropole Habitat", "Mme Durand"];

describe("parité du rapprochement de client", () => {
  it.each([
    "OPAC DU RHONE", "opac du rhône sa", "Alpes Isère Habitat", "LYON HABITAT", "Mairie Villeurbanne", "Inconnu SARL", "", null,
    "Grand Lyon", "SCI LES TILLEULS", "Habitat", "Durand",
  ])("« %s »", (lu) => {
    expect(rapprocherClient(lu, CLIENTS)).toEqual(ancienRapprocher(lu, CLIENTS));
  });
});

describe("parité des essentiels de lecture", () => {
  it.each([
    [{ numeroBC: null, adresse: null, lignes: [] }],
    [{ numeroBC: "12", adresse: "rue", lignes: [{ type: "ligne", designation: "x" }] }],
    [{ numeroBC: " ", adresse: "rue", lignes: [{ type: "chapitre", designation: "Lot" }, { type: "ligne", designation: " " }] }],
  ])("%o", (lu) => {
    const nouveau = essentielsManquants({ ...lu, lignes: lu.lignes.map((l) => ({ ...l, type: l.type as "ligne", qte: null, unite: null, prixUnitaire: null, tva: null })) });
    expect(nouveau).toEqual(ancienBc.essentielsDeLecture(lu).map((m) => m.libelle));
  });
});
