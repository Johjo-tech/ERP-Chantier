import { describe, expect, it } from "vitest";
import { lienSansFiche } from "./regles-client-libre";

describe("lienSansFiche", () => {
  /* Un devis lié à la fiche « A », réenregistré au nom libre « B », restait
     attaché à « A » : l'upsert ne touchait pas à `client_id`. */
  it("défait le lien d'un devis passé à un nom libre", () => {
    expect(lienSansFiche(true, true)).toEqual({ client_id: null });
  });

  it("ne touche pas une facture, dont l'en-tête émis est figé", () => {
    expect(lienSansFiche(false, true)).toEqual({});
  });

  it("n'envoie pas une colonne que la table n'a pas", () => {
    expect(lienSansFiche(true, false)).toEqual({});
  });
});
