import { describe, expect, it } from "vitest";
import { etatPiece, libelleDelai } from "./etat";

const f = { numero: "FAC-2026-000001", type_document: "facture", statut: "impayée", legacy_id: null, date: "2026-08-01", echeance: "2026-09-01" };

describe("état d'une pièce", () => {
  it("brouillon", () => expect(etatPiece({ ...f, numero: null, statut: "brouillon" }, 100, [], "2026-09-24").nature).toBe("brouillon"));

  it("pièce historique payée : réglée par reprise, sans règlement fabriqué (362 792 € de créances fantômes évitées)", () => {
    expect(etatPiece({ ...f, legacy_id: "kv:1", statut: "payée" }, 1000, [], "2026-09-24")).toEqual({ nature: "reprise", libelle: "Réglée (reprise)" });
  });

  it("un avoir n'est jamais « impayé » ni « en retard »", () => {
    const e = etatPiece({ ...f, type_document: "avoir" }, 682, [], "2026-09-24");
    expect(e).toMatchObject({ nature: "avoir", cle: "disponible" });
    expect(libelleDelai(e, "2026-09-01", "2026-09-24")).toBeNull();
  });

  it("retard : reste > 0,01 et échéance passée", () => {
    const e = etatPiece(f, 1200, [{ montant: 500 }], "2026-09-24");
    expect(e).toMatchObject({ nature: "facture", cle: "partiellement_reglee", enRetard: true, joursRetard: 23 });
    expect(libelleDelai(e, "2026-09-01", "2026-09-24")).toBe("En retard de 23 j");
    expect(libelleDelai(etatPiece(f, 1200, [], "2026-09-01"), "2026-09-01", "2026-09-01")).toBe("Échéance aujourd'hui");
    expect(libelleDelai(etatPiece(f, 1200, [{ montant: 1200 }], "2026-09-24"), "2026-09-01", "2026-09-24")).toBeNull();
  });
});
