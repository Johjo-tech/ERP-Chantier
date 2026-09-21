/**
 * Retrouver une facture par le numéro du bon de commande.
 *
 * La comptabilité rapproche par le bon, pas par la facture. Or deux
 * références distinctes portent ce nom, et aucune n'était cherchable :
 *
 *  - `refBonCommandeClient`, le numéro que le CLIENT a donné à sa commande.
 *    Il figure sur la facture imprimée, mais ne fait pas partie des champs
 *    que `texteDocument` parcourt ;
 *  - le `numeroBC` du bon d'où la facture est née. Il ne vit pas sur la
 *    facture mais sur le bon, au bout de `bonCommandeId` — une recherche qui
 *    ne lit que la facture ne pouvait pas le trouver.
 *
 * Les deux fonctions sont extraites de `src/pages/app.js` et évaluées, avec
 * les vraies `texteDocument` et `multiWordMatch` du module de recherche.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { multiWordMatch, texteDocument } from "@/integrations/recherche";

const SOURCE = readFileSync(resolve(__dirname, "../pages/app.js"), "utf8");

function extraire(nom: string): string {
  const debut = SOURCE.indexOf(`\nfunction ${nom}(`);
  if (debut < 0) throw new Error(`\`${nom}\` introuvable dans src/pages/app.js`);
  const fin = SOURCE.indexOf("\n}", debut);
  if (fin < 0) throw new Error(`fin de \`${nom}\` introuvable dans src/pages/app.js`);
  return SOURCE.slice(debut, fin + 2);
}

interface BonEcran { id: string; numeroBC?: string; numeroInterne?: string }
interface FactureEcran {
  id: string;
  client: string;
  numero: string;
  bonCommandeId?: string | null;
  refBonCommandeClient?: string | null;
  lignes?: unknown[];
}

function banc(bons: BonEcran[]) {
  const state = { bonsCommande: bons };
  const fabrique = new Function(
    "state",
    "window",
    "montantsCherchables",
    `${extraire("numerosBCdeLaFacture")}\n${extraire("factureSearchHaystack")}; return factureSearchHaystack;`
  );
  const haystack = fabrique(state, { texteDocument }, () => []) as (f: FactureEcran) => string;
  return (f: FactureEcran, q: string) => multiWordMatch(haystack(f), q);
}

const BON: BonEcran = { id: "bc1", numeroBC: "CMD-8842-KTA", numeroInterne: "BC-2026-000317" };

const FACTURE: FactureEcran = {
  id: "f1",
  client: "Bailleur Social",
  numero: "FAC-2026-000042",
  bonCommandeId: "bc1",
  refBonCommandeClient: "REF-CLIENT-991",
  lignes: [],
};

describe("La recherche dans les factures", () => {
  const trouve = banc([BON]);

  it("trouve toujours par le numéro de facture", () => {
    expect(trouve(FACTURE, "FAC-2026-000042")).toBe(true);
  });

  it("trouve par le numéro du bon de commande lié", () => {
    expect(trouve(FACTURE, "CMD-8842-KTA")).toBe(true);
  });

  it("trouve par le numéro interne du bon — celui qui est sur le papier", () => {
    expect(trouve(FACTURE, "BC-2026-000317")).toBe(true);
  });

  it("trouve par la référence de commande donnée par le client", () => {
    expect(trouve(FACTURE, "REF-CLIENT-991")).toBe(true);
  });

  it("cherche sans égard à la casse", () => {
    expect(trouve(FACTURE, "cmd-8842")).toBe(true);
  });

  it("ne ramène pas une facture dont le bon porte un autre numéro", () => {
    expect(trouve(FACTURE, "CMD-0000-XXX")).toBe(false);
  });

  it("ne tombe pas quand la facture ne vient d'aucun bon", () => {
    const seule = { ...FACTURE, bonCommandeId: null, refBonCommandeClient: null };
    expect(trouve(seule, "FAC-2026-000042")).toBe(true);
    expect(trouve(seule, "CMD-8842-KTA")).toBe(false);
  });

  it("ne tombe pas quand le bon désigné n'est plus chargé", () => {
    const orpheline = { ...FACTURE, bonCommandeId: "disparu" };
    expect(trouve(orpheline, "REF-CLIENT-991")).toBe(true);
  });
});
