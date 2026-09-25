/**
 * Parité des rapports d'intervention contre `app.js` pris TEL QUEL (D-045) :
 * les constantes METIERS et CONTROLES_PAR_METIER, `parsePreconisationsEnLignes`
 * et `cleanLogementFields`, extraites du fichier et évaluées.
 *
 * Écart assumé : l'ancien `cleanLogementFields` rend `""` pour « vide », le
 * nouveau `null` — Postgres refuse la chaîne vide sur une énumération ou une
 * date, et `web/` n'écrit jamais `""` (CLAUDE.md).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CONTROLES_PAR_METIER, METIERS_RAPPORT, nettoyerLogement, type LogementStatut } from "../../src/modules/interventions/domain/rapport";
// La seule lecture des préconisations, celle du module devis, que la transformation du rapport emprunte (D-CLI-09).
import { lignesDesPreconisations } from "../../src/modules/devis/domain/preconisations";
import { generateur } from "./aleatoire";

const g = generateur(11951);
const appJs = readFileSync(join(import.meta.dirname, "../../../src/pages/app.js"), "utf8");

function sourceDe(nom: string): string {
  const debut = appJs.indexOf(`function ${nom}(`);
  if (debut < 0) throw new Error(`${nom} introuvable`);
  let profondeur = 0;
  for (let i = appJs.indexOf("{", debut); i < appJs.length; i++) {
    if (appJs[i] === "{") profondeur++;
    if (appJs[i] === "}" && --profondeur === 0) return appJs.slice(debut, i + 1);
  }
  throw new Error(`${nom} : accolades déséquilibrées`);
}

/** Le littéral d'une constante `const NOM = …;` (tableau ou objet), à la parenthèse près. */
function constante(nom: string): unknown {
  const debut = appJs.indexOf(`const ${nom} = `);
  if (debut < 0) throw new Error(`${nom} introuvable`);
  const ouverture = appJs.indexOf("=", debut) + 1;
  let profondeur = 0;
  for (let i = ouverture; i < appJs.length; i++) {
    const c = appJs[i];
    if (c === "[" || c === "{") profondeur++;
    if ((c === "]" || c === "}") && --profondeur === 0) return new Function(`return ${appJs.slice(ouverture, i + 1)};`)();
  }
  throw new Error(`${nom} : littéral déséquilibré`);
}

interface LigneAncienne { designation: string; qte: number; unite: string }
const ancien = new Function(`const tvaDefaut = () => 10;\n${sourceDe("parsePreconisationsEnLignes")}\n${sourceDe("cleanLogementFields")}\nreturn { parsePreconisationsEnLignes, cleanLogementFields };`)() as {
  parsePreconisationsEnLignes: (t: string, repli?: string) => LigneAncienne[];
  cleanLogementFields: (s: string, raw: Record<string, string>) => Record<string, string>;
};

describe("rapports (app.js)", () => {
  it("métiers et points de contrôle identiques", () => {
    const metiers = constante("METIERS") as { value: string; label: string }[];
    expect(METIERS_RAPPORT.map((m) => ({ value: m.valeur, label: m.libelle }))).toEqual(metiers);
    const controles = constante("CONTROLES_PAR_METIER") as Record<string, { key: string; label: string }[]>;
    expect(Object.fromEntries(Object.entries(CONTROLES_PAR_METIER).map(([m, liste]) => [m, liste.map((p) => ({ key: p.cle, label: p.libelle }))]))).toEqual(controles);
  });

  it("préconisations → lignes de devis : 3 000 textes tirés", () => {
    const LIGNES = ["Remplacer le joint", "Reprise enduit x2", "Peinture plafond x25 m²", "Colonne × 3,5 ml", "  ", "x2", "Nettoyage x0", "Siphon X4u", "Test x1.5 h", ""];
    for (let i = 0; i < 3000; i++) {
      const texte = Array.from({ length: g.entier(0, 4) }, () => g.parmi(LIGNES)).join("\n");
      const attendu = ancien.parsePreconisationsEnLignes(texte, "Repli").map((l) => ({ designation: l.designation, quantite: l.qte, unite: l.unite }));
      expect(lignesDesPreconisations(texte, "Repli"), JSON.stringify(texte)).toEqual(attendu);
    }
  });

  it("champs de logement gardés selon le statut (vide rendu null)", () => {
    for (const statut of ["occupé", "vacant", "commune", ""]) {
      const brut = { occupant: "M. A", etage: "2", numeroLogement: "12", precisionCommune: "Cave", ancienLocataire: "M. B" };
      const a = ancien.cleanLogementFields(statut, brut);
      const n = nettoyerLogement({ logement_statut: (statut || null) as LogementStatut | null, occupant: brut.occupant, etage: brut.etage, numero_logement: brut.numeroLogement, precision_commune: brut.precisionCommune, ancien_locataire: brut.ancienLocataire });
      expect({ occupant: n.occupant ?? "", etage: n.etage ?? "", numeroLogement: n.numero_logement ?? "", precisionCommune: n.precision_commune ?? "", ancienLocataire: n.ancien_locataire ?? "" }, statut).toEqual({
        occupant: a.occupant, etage: a.etage, numeroLogement: a.numeroLogement, precisionCommune: a.precisionCommune, ancienLocataire: a.ancienLocataire,
      });
    }
  });
});
