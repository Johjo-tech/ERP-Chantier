import { describe, expect, it } from "vitest";
import { enteteAEnregistrer, schemaSaisieDevis, valeursDepuis } from "./devis";

describe("en-tête de devis", () => {
  const base = { ...valeursDepuis(null, "2026-09-24"), client_id: "c1" };

  it("exige un client", () => {
    expect(schemaSaisieDevis.safeParse({ ...base, client_id: "" }).success).toBe(false);
  });

  it("naît brouillon, daté du jour", () => {
    expect([base.statut, base.date]).toEqual(["brouillon", "2026-09-24"]);
  });

  it("adresse = siège du client, lieu nettoyé selon le logement", () => {
    const s = schemaSaisieDevis.parse({ ...base, logement_statut: "vacant", occupant: "M. X", etage: "3", adresse_locataire: "14 rue G" });
    const e = enteteAEnregistrer(s, { nom: "OPAC", adresse: "12 rue R" }, 10);
    expect(e).toMatchObject({ client_nom: "OPAC", adresse: "12 rue R", adresse_locataire: "14 rue G", occupant: null, etage: "3", remise_pourcentage: 10 });
    expect(Object.values(e)).not.toContain("");
  });
});
