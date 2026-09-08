/**
 * Alertes d'échéance. Le calcul est pur : ces tests fixent les seuils et le
 * passage en « danger », sans toucher à la base.
 */

import { describe, it, expect } from "vitest";
import { dateISO } from "@/api/client";
import {
  alertesDocument,
  alertesSalarie,
  alertesVehicule,
  joursRestants,
  trierAlertes,
} from "@/integrations/alertes";

/**
 * Date ISO décalée de `n` jours. Passe par `dateISO` et non `toISOString()`,
 * qui décalerait d'un jour dans les fuseaux à l'est de Greenwich.
 */
function dans(n: number): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + n);
  return dateISO(d);
}

describe("Jours restants", () => {
  it("compte à partir d'aujourd'hui", () => {
    expect(joursRestants(dans(10))).toBe(10);
    expect(joursRestants(dans(0))).toBe(0);
    expect(joursRestants(dans(-3))).toBe(-3);
  });

  it("ignore une date absente ou invalide", () => {
    expect(joursRestants(null)).toBeNull();
    expect(joursRestants("")).toBeNull();
    expect(joursRestants("pas-une-date")).toBeNull();
  });
});

describe("Véhicules", () => {
  it("alerte sous le seuil et passe en danger une fois dépassé", () => {
    const proche = alertesVehicule({ id: "v1", nom: "Kangoo", carteCarburantValidite: dans(10) });
    expect(proche).toHaveLength(1);
    expect(proche[0].niveau).toBe("warn");

    const expire = alertesVehicule({ id: "v1", nom: "Kangoo", carteCarburantValidite: dans(-1) });
    expect(expire[0].niveau).toBe("danger");
  });

  it("se tait au-delà du seuil", () => {
    expect(alertesVehicule({ id: "v1", carteCarburantValidite: dans(120) })).toEqual([]);
  });

  it("ignore un véhicule vendu", () => {
    expect(
      alertesVehicule({ id: "v1", vendu: true, carteCarburantValidite: dans(-30) })
    ).toEqual([]);
  });
});

describe("Salariés", () => {
  it("remonte carte BTP, visite médicale et habilitations", () => {
    const alertes = alertesSalarie(
      { id: "s1", prenom: "Jean", nom: "Dupont", carteBtpValidite: dans(20), visiteMedicaleProchaine: dans(10) },
      [{ id: "h1", salarieId: "s1", nom: "CACES", dateExpiration: dans(5) }]
    );
    expect(alertes).toHaveLength(3);
    expect(alertes.some((a) => a.libelle.includes("CACES"))).toBe(true);
    expect(alertes.every((a) => a.libelle.startsWith("Jean Dupont"))).toBe(true);
  });

  it("n'attribue pas les habilitations d'un autre salarié", () => {
    const alertes = alertesSalarie({ id: "s1", nom: "Dupont" }, [
      { id: "h1", salarieId: "s2", nom: "CACES", dateExpiration: dans(1) },
    ]);
    expect(alertes).toEqual([]);
  });

  it("ignore un salarié inactif", () => {
    expect(
      alertesSalarie({ id: "s1", actif: false, carteBtpValidite: dans(-10) })
    ).toEqual([]);
  });
});

describe("Documents légaux", () => {
  it("alerte sur la date de validité", () => {
    expect(alertesDocument({ id: "d1", nom: "Assurance RC", dateValidite: dans(15) })).toHaveLength(1);
    expect(alertesDocument({ id: "d1", nom: "Assurance RC", dateValidite: dans(90) })).toEqual([]);
  });
});

describe("Tri", () => {
  it("met les expirées devant, puis les plus proches", () => {
    const tri = trierAlertes([
      { id: "b", niveau: "warn", categorie: "x", libelle: "b", jours: 20 },
      { id: "a", niveau: "danger", categorie: "x", libelle: "a", jours: -5 },
      { id: "c", niveau: "warn", categorie: "x", libelle: "c", jours: 3 },
    ]);
    expect(tri.map((a) => a.id)).toEqual(["a", "c", "b"]);
  });
});
