/**
 * Lettrer une facture avec un avoir, depuis le module Règlements.
 *
 * L'imputation existait, mais par une modale ouverte facture par facture.
 * Dans l'écran où la facture et l'avoir se font face, rien ne permettait de
 * les rapprocher : les avoirs n'étaient même pas cochables, parce qu'un avoir
 * ne s'encaisse pas.
 *
 * `lettrageDeLaSelection` décide si deux cases cochées décrivent un lettrage,
 * et pour combien. Elle est extraite de `src/pages/app.js` et évaluée avec la
 * vraie règle `montantImputable`.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { estAvoir, montantImputable } from "@/api/regles-avoir";

const SOURCE = readFileSync(resolve(__dirname, "../pages/app.js"), "utf8");

function extraire(nom: string): string {
  const debut = SOURCE.indexOf(`\nfunction ${nom}(`);
  if (debut < 0) throw new Error(`\`${nom}\` introuvable dans src/pages/app.js`);
  const fin = SOURCE.indexOf("\n}", debut);
  if (fin < 0) throw new Error(`fin de \`${nom}\` introuvable dans src/pages/app.js`);
  return SOURCE.slice(debut, fin + 2);
}

interface Piece {
  id: string;
  numero: string;
  typeDocument: string;
  /** Ce que la pièce a encore à donner (avoir) ou à recevoir (facture). */
  reste: number;
}

interface Lettrage {
  avoir: Piece;
  facture: Piece;
  montant: number;
}

/**
 * Les restes sont fournis directement : `resteDeLAvoir` et `resteDeLaFacture`
 * dépendent des règlements enregistrés, qui ne sont pas le sujet ici.
 */
const lettrageDeLaSelection = new Function(
  "window",
  "resteDeLAvoir",
  "resteDeLaFacture",
  `${extraire("lettrageDeLaSelection")}; return lettrageDeLaSelection;`
)(
  { estAvoir, montantImputable },
  (a: Piece) => a.reste,
  (f: Piece) => f.reste
) as (list: Piece[], selection: string[]) => Lettrage | null;

const FACTURE: Piece = { id: "f1", numero: "FAC-2026-000042", typeDocument: "facture", reste: 1200 };
const AVOIR: Piece = { id: "a1", numero: "AV-2026-000003", typeDocument: "avoir", reste: 500 };

describe("Ce que deux cases cochées décrivent", () => {
  it("reconnaît une facture en face d'un avoir", () => {
    const l = lettrageDeLaSelection([FACTURE, AVOIR], ["f1", "a1"]);

    expect(l?.facture.id).toBe("f1");
    expect(l?.avoir.id).toBe("a1");
  });

  it("propose le plus petit des deux restes — ici celui de l'avoir", () => {
    expect(lettrageDeLaSelection([FACTURE, AVOIR], ["f1", "a1"])?.montant).toBe(500);
  });

  it("propose le reste de la facture quand l'avoir est plus gros", () => {
    const gros = { ...AVOIR, reste: 3000 };
    expect(lettrageDeLaSelection([FACTURE, gros], ["f1", "a1"])?.montant).toBe(1200);
  });

  it("ne propose rien pour une seule case", () => {
    expect(lettrageDeLaSelection([FACTURE, AVOIR], ["f1"])).toBeNull();
  });

  it("ne propose rien pour deux factures", () => {
    const autre = { ...FACTURE, id: "f2", numero: "FAC-2026-000043" };
    expect(lettrageDeLaSelection([FACTURE, autre], ["f1", "f2"])).toBeNull();
  });

  it("ne propose rien pour deux avoirs — un avoir ne s'impute pas sur un avoir", () => {
    const autre = { ...AVOIR, id: "a2", numero: "AV-2026-000004" };
    expect(lettrageDeLaSelection([AVOIR, autre], ["a1", "a2"])).toBeNull();
  });

  it("ne propose rien au-delà de deux pièces", () => {
    /* Quel crédit sur quelle créance est une décision comptable, pas une
       répartition automatique. */
    const autre = { ...FACTURE, id: "f2", numero: "FAC-2026-000043" };
    expect(lettrageDeLaSelection([FACTURE, autre, AVOIR], ["f1", "f2", "a1"])).toBeNull();
  });

  it("refuse une facture qui n'est pas émise : il n'y a rien à solder", () => {
    const brouillon = { ...FACTURE, numero: "" };
    expect(lettrageDeLaSelection([brouillon, AVOIR], ["f1", "a1"])).toBeNull();
  });

  it("refuse un avoir déjà entièrement consommé", () => {
    const epuise = { ...AVOIR, reste: 0 };
    expect(lettrageDeLaSelection([FACTURE, epuise], ["f1", "a1"])).toBeNull();
  });

  it("refuse une facture déjà soldée", () => {
    const soldee = { ...FACTURE, reste: 0 };
    expect(lettrageDeLaSelection([soldee, AVOIR], ["f1", "a1"])).toBeNull();
  });

  it("ne tombe pas si une pièce cochée a quitté la liste", () => {
    expect(lettrageDeLaSelection([FACTURE], ["f1", "a1"])).toBeNull();
  });
});
