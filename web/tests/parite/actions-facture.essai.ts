/**
 * Parité de la barre d'actions d'une facture (« ne montre que le possible »)
 * contre `src/api/regles-actions-facture.ts`, importé TEL QUEL : chaque geste,
 * sur chaque état de pièce, sous chaque combinaison de droits — le booléen ET
 * la phrase du refus.
 */
import { describe, expect, it } from "vitest";
import * as ancien from "../../../src/api/regles-actions-facture";
import * as nouveau from "../../src/modules/facturation/domain/actions";

const GESTES = ["modifier", "imprimer", "envoyer", "emettre", "transmettre", "avoir", "imputerAvoir", "dupliquer", "supprimer"] as const;
const PIECES = [
  { numero: null, type_document: "facture", verrouillee: false },
  { numero: "", type_document: "facture", verrouillee: true },
  { numero: "FAC-2026-000001", type_document: "facture", verrouillee: false },
  { numero: "FAC-2026-000002", type_document: "facture", verrouillee: true },
  { numero: null, type_document: "avoir", verrouillee: false },
  { numero: "AV-2026-000001", type_document: "avoir", verrouillee: false },
  { numero: "  ", type_document: "acompte", verrouillee: false },
];

function toutesLesDroits(): nouveau.DroitsFacture[] {
  const sortie: nouveau.DroitsFacture[] = [];
  for (let m = 0; m < 32; m++) {
    sortie.push({ modifier: !!(m & 1), creer: !!(m & 2), supprimer: !!(m & 4), emettre: !!(m & 8), imputerAvoir: !!(m & 16) });
  }
  return sortie;
}

describe("parité — actionsFacture / refusGesteFacture / motifRoleFacture", () => {
  it("chaque geste × pièce × droits donne le même refus, mot pour mot", () => {
    for (const droits of toutesLesDroits()) {
      for (const p of PIECES) {
        const vieux = { numero: p.numero, typeDocument: p.type_document, verrouillee: p.verrouillee };
        for (const g of GESTES) expect(nouveau.refusGesteFacture(g, p, droits), `${g} ${JSON.stringify(p)} ${JSON.stringify(droits)}`).toBe(ancien.refusGesteFacture(g, vieux, droits));
        expect(nouveau.actionsFacture(p, droits)).toEqual(ancien.actionsFacture(vieux, droits));
      }
      expect(nouveau.motifRoleFacture(droits)).toBe(ancien.motifRoleFacture(droits));
    }
  });

  it("une pièce absente est introuvable", () => {
    const d = toutesLesDroits()[31] as nouveau.DroitsFacture;
    expect(nouveau.refusGesteFacture("modifier", null, d)).toBe(ancien.refusGesteFacture("modifier", null, d));
  });
});
