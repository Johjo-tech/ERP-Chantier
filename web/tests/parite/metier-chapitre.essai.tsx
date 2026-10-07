/**
 * Parité de la liste « métier du chapitre » (D-VIS2-01, D-COR2-03) contre l'ancien écran : `chapitreMetierHTML`
 * et `metierChapitreOptions`, extraites de `app.js` et évaluées avec `src/api/regles-metiers.ts` importé
 * TEL QUEL à la place de `window` — c'est lui que l'ancien y pose (`integrations/session.ts`).
 * Chaque tirage compare le `<select>` produit : classes, infobulle, options (valeur, libellé) et sélection.
 */
import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import * as reglesMetiers from "../../../src/api/regles-metiers";
import { SelectMetierChapitre } from "../../src/modules/commandes/components/MetierChapitreAncien";
import { generateur } from "./aleatoire";
import { sourceDe } from "./source-app";

const g = generateur(28092);
const TIRAGES = 300;
const CONNUS = ["Peinture", "Sol", "Plomberie", "Étanchéité", "Carrelage", "Électricité"];
const MOTS = ["PEINTURE", "SOLS", "PLOMBEIRE", "PLOMBERIE", "ETANCHEITE", "ARTICLE", "BPU", "carrelage", "salle", "de", "bain", "<b>"];

type ChapitreHTML = (l: { designation: string; metier?: string | null }, i: number) => string;
const aides = ["esc", "metierChapitreOptions", "chapitreMetierHTML"].map((n) => sourceDe(n)).join("\n");
const ancienHTML = (connus: string[]): ChapitreHTML =>
  new Function("window", "metiersDisponibles", `${aides}; return chapitreMetierHTML;`)(reglesMetiers, () => [...connus]) as ChapitreHTML;

interface Lecture {
  classes: string[];
  titre: string;
  options: [string, string][];
  valeur: string;
}

function lire(select: HTMLSelectElement): Lecture {
  return {
    classes: [...select.classList].sort(),
    titre: select.title,
    options: [...select.options].map((o) => [o.value, o.textContent ?? ""]),
    valeur: select.value,
  };
}

function lireAncien(html: string): Lecture {
  const hote = document.createElement("div");
  hote.innerHTML = html;
  const select = hote.querySelector("select");
  if (!select) throw new Error("l'ancien n'a pas rendu de <select>");
  return lire(select);
}

const titre = () => Array.from({ length: g.entier(0, 3) }, () => g.parmi(MOTS)).join(" ");
const choix = () => g.parmi([null, null, null, reglesMetiers.METIER_AUCUN, "(AUCUN)", "Peinture", "plomberie", "Menuiserie"]);

describe("parité — liste « métier du chapitre » des devis et des factures", () => {
  it("même <select> que chapitreMetierHTML sur les trois états : NULL, un nom, METIER_AUCUN", () => {
    for (let i = 0; i < TIRAGES; i++) {
      const ligne = { type: "chapitre", designation: titre(), metier: choix() };
      const connus = CONNUS.filter(() => g.reel() > 0.3);
      const attendu = lireAncien(ancienHTML(connus)(ligne, 0));
      const { container, unmount } = render(<SelectMetierChapitre ligne={ligne} connus={connus} onChange={() => undefined} />);
      const select = container.querySelector("select");
      expect(select, JSON.stringify(ligne)).not.toBeNull();
      expect(lire(select as HTMLSelectElement), JSON.stringify({ ligne, connus })).toEqual(attendu);
      unmount();
    }
  });

  it("les libellés de l'ancien, au caractère près", () => {
    const { container } = render(<SelectMetierChapitre ligne={{ type: "chapitre", designation: "Divers", metier: null }} connus={["Peinture"]} onChange={() => undefined} />);
    const libelles = [...(container.querySelector("select") as HTMLSelectElement).options].map((o) => o.textContent);
    expect(libelles).toEqual(["— Déduit du titre —", "— Aucun métier —", "Peinture"]);
  });

  it("ce que la liste écrit suit la précédence de metierDeLaLigne (l'ancien : « Déduit du titre » efface la clé)", () => {
    for (const [valeur, ecrit] of [["", null], [reglesMetiers.METIER_AUCUN, reglesMetiers.METIER_AUCUN], ["Peinture", "Peinture"]] as const) {
      let recu: string | null | undefined;
      const { container, unmount } = render(<SelectMetierChapitre ligne={{ type: "chapitre", designation: "PLOMBERIE", metier: "Sol" }} connus={CONNUS} onChange={(m) => (recu = m)} />);
      const select = container.querySelector("select") as HTMLSelectElement;
      fireEvent.change(select, { target: { value: valeur } });
      expect(recu).toBe(ecrit);
      // Ce qui est écrit se relit, par la règle historique, comme l'utilisateur l'a voulu.
      const relu = reglesMetiers.metierDeLaLigne({ designation: "PLOMBERIE", metier: recu ?? null }, CONNUS);
      expect(relu?.metier ?? null).toBe(valeur === "" ? "Plomberie" : valeur === reglesMetiers.METIER_AUCUN ? null : "Peinture");
      unmount();
    }
  });
});
