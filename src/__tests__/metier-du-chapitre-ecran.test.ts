/**
 * Ce que l'écran fait du métier choisi sur un chapitre.
 *
 * `updateLigne` est le point d'écriture unique des lignes d'un document, et
 * elle sépare les champs texte des champs numériques. `articleReference` avait
 * manqué à cette liste : « PLB-001 » partait dans `parseFloat` et devenait 0 à
 * la frappe. `metier` tombe exactement dans le même piège — « PEINTURE »
 * vaudrait 0 — d'où les cas ci-dessous.
 *
 * La fonction n'est PAS recopiée : elle est extraite de `src/pages/app.js` et
 * évaluée. Une copie passerait au vert pendant que le code livré diverge, et
 * `app.js` n'a aucun autre filet.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

interface LigneEcran {
  type?: string;
  designation?: string;
  metier?: string;
  qte?: number;
  prixUnitaire?: number;
}

interface BancDEssai {
  updateLigne: (i: number, field: string, val: unknown, el?: unknown) => void;
  lignes: LigneEcran[];
  appels: { metiersRelus: number; totauxRefaits: number; tableauRefait: number };
}

/**
 * `updateLigne`, prise dans le fichier qui part en production.
 *
 * Extraite par son en-tête et son accolade fermante en début de ligne — la
 * forme qu'ont toutes les fonctions de premier niveau de ce fichier — puis
 * évaluée avec des bouchons pour ce qu'elle appelle : seul son effet sur les
 * lignes et l'aiguillage de ses appels nous intéressent ici.
 */
function chargerUpdateLigne(lignes: LigneEcran[]): BancDEssai {
  const source = readFileSync(resolve(__dirname, "../pages/app.js"), "utf8");
  const debut = source.indexOf("\nfunction updateLigne(");
  if (debut < 0) throw new Error("`updateLigne` introuvable dans src/pages/app.js");
  const fin = source.indexOf("\n}", debut);
  if (fin < 0) throw new Error("fin de `updateLigne` introuvable dans src/pages/app.js");

  const appels = { metiersRelus: 0, totauxRefaits: 0, tableauRefait: 0 };
  const state = { editing: { lignes } };
  const corps = source.slice(debut, fin + 2);
  const fabrique = new Function(
    "state",
    "appliquerMetiersDesChapitres",
    "refreshTotalsOnly",
    "refreshLignesUI",
    `${corps}; return updateLigne;`
  );
  const updateLigne = fabrique(
    state,
    () => { appels.metiersRelus++; },
    () => { appels.totauxRefaits++; },
    () => { appels.tableauRefait++; }
  );
  return { updateLigne, lignes, appels };
}

describe("Le métier saisi sur un chapitre", () => {
  let banc: BancDEssai;

  beforeEach(() => {
    banc = chargerUpdateLigne([
      { type: "chapitre", designation: "SALLE DE BAIN" },
      { type: "ligne", designation: "Remplacement siphon", qte: 1, prixUnitaire: 80 },
    ]);
  });

  /* La régression `articleReference`, à l'identique : sans `metier` dans les
     champs texte, `parseFloat('PLOMBERIE') || 0` rend 0 et le choix s'efface
     au moment même où on le fait. */
  it("est rangé tel quel, et non ramené à zéro", () => {
    banc.updateLigne(0, "metier", "PLOMBERIE");
    expect(banc.lignes[0].metier).toBe("PLOMBERIE");
  });

  /* « — Déduit du titre — » n'est pas un métier vide : c'est le retrait du
     choix. La clé doit disparaître, sinon la ligne porte une valeur que la
     base ne distingue pas d'un `NULL` et la déduction ne reprend jamais. */
  it("efface la clé quand on revient à la déduction", () => {
    banc.updateLigne(0, "metier", "PLOMBERIE");
    banc.updateLigne(0, "metier", "");
    expect("metier" in banc.lignes[0]).toBe(false);
  });

  it("fait relire les métiers du bon, sans toucher aux totaux", () => {
    banc.updateLigne(0, "metier", "PLOMBERIE");
    expect(banc.appels.metiersRelus).toBe(1);
    expect(banc.appels.totauxRefaits).toBe(0);
  });

  /* Reconstruire `#lignesBody` refermerait la liste déroulante que
     l'utilisateur vient d'ouvrir, et lui ferait perdre le focus. */
  it("ne reconstruit pas le tableau des lignes", () => {
    banc.updateLigne(0, "metier", "PLOMBERIE");
    expect(banc.appels.tableauRefait).toBe(0);
  });

  it("survit à un titre retapé : un choix ne se défait qu'explicitement", () => {
    banc.updateLigne(0, "metier", "PLOMBERIE");
    banc.updateLigne(0, "designation", "CARRELAGE MURS");
    expect(banc.lignes[0].metier).toBe("PLOMBERIE");
    expect(banc.lignes[0].designation).toBe("CARRELAGE MURS");
  });

  it("laisse les champs numériques à leur branche", () => {
    banc.updateLigne(1, "prixUnitaire", "120.5");
    expect(banc.lignes[1].prixUnitaire).toBe(120.5);
    expect(banc.appels.totauxRefaits).toBe(1);
  });

  /* Le style dit d'où vient la valeur. On le retouche en place plutôt que de
     redessiner : c'est ce qui permet de ne pas refermer la liste. */
  it("retire le style « deviné » dès qu'on tranche, et le remet au retrait", () => {
    const classes = new Set(["chapitre-metier", "est-deduit", "est-approchant"]);
    const el = {
      classList: {
        toggle: (c: string, on: boolean) => { on ? classes.add(c) : classes.delete(c); },
        remove: (c: string) => { classes.delete(c); },
      },
    };
    banc.updateLigne(0, "metier", "PLOMBERIE", el);
    expect(classes.has("est-deduit")).toBe(false);
    expect(classes.has("est-approchant")).toBe(false);

    banc.updateLigne(0, "metier", "", el);
    expect(classes.has("est-deduit")).toBe(true);
  });
});
