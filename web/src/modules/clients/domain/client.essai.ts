import { describe, expect, it } from "vitest";
import { saisieDepuis, schemaSaisieClient } from "./client";

const base = saisieDepuis(null);

describe("schemaSaisieClient", () => {
  it("exige un nom", () => {
    const r = schemaSaisieClient.safeParse({ ...base, nom: "  " });
    expect(r.success).toBe(false);
  });

  it("enregistre un client sans aucun identifiant (le manquant n'est pas une erreur)", () => {
    const r = schemaSaisieClient.safeParse({ ...base, nom: "Mme Durand", cadre_facturation: "B2C" });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.siret).toBeNull();
      expect(r.data.email).toBeNull();
      expect(r.data.delai_paiement_jours).toBeNull();
    }
  });

  it("refuse un SIRET dont la clé est fausse", () => {
    const r = schemaSaisieClient.safeParse({ ...base, nom: "SARL X", siret: "73282932000075" });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0]?.path).toEqual(["siret"]);
  });

  it("accepte « 0 » jour : paiement à réception, distinct de « non renseigné »", () => {
    const r = schemaSaisieClient.safeParse({ ...base, nom: "X", delai_paiement_jours: "0" });
    expect(r.success && r.data.delai_paiement_jours).toBe(0);
  });

  it("convertit les champs vides en null (Postgres refuse \"\" sur une énumération)", () => {
    const r = schemaSaisieClient.safeParse({ ...base, nom: "X", mode_paiement: "" });
    expect(r.success && r.data.mode_paiement).toBeNull();
  });
});
