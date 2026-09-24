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

describe("constats de la relecture", () => {
  it("un particulier au SIRET historique faux reste enregistrable (champ masqué)", () => {
    const r = schemaSaisieClient.safeParse({ ...base, nom: "M. X", cadre_facturation: "B2C", siret: "73282932000075" });
    expect(r.success).toBe(true);
  });
  it("l'e-mail est épuré de ses espaces", () => {
    const r = schemaSaisieClient.safeParse({ ...base, nom: "X", email: " a@b.fr " });
    expect(r.success && r.data.email).toBe("a@b.fr");
  });
  it("un mode de paiement ancien (traite) reste accepté", () => {
    expect(schemaSaisieClient.safeParse({ ...base, nom: "X", mode_paiement: "traite" }).success).toBe(true);
  });
  it("le délai hors bornes dit la borne", () => {
    const r = schemaSaisieClient.safeParse({ ...base, nom: "X", delai_paiement_jours: "400" });
    expect(r.success ? "" : r.error.issues[0]?.message).toBe("365 jours au plus.");
  });
});
