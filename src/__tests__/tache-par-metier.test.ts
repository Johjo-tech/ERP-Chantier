/**
 * Une tâche de planning par métier du bon de commande.
 *
 * Régression : un bon PEINTURE+SOL ne portait qu'une seule tâche. Le repli
 * `?? taches[0]` de `tacheDuBonCommande` rendait cette tâche quel que soit le
 * métier demandé — déjà validée, elle fermait tout arbitrage et ne laissait que
 * « Valider la pré-facture », faisant passer une étape de facturation pour
 * l'étape suivante du circuit.
 *
 * Logique pure : la couche d'accès est simulée, ces tests n'atteignent jamais
 * la base.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

const listTachesBonCommande = vi.fn();
const planifierTache = vi.fn();

vi.mock("@/api/queries", () => ({
  listMesSocietes: vi.fn(async () => [
    { id: "soc-uuid", code: "kta", nom: "KTA" },
  ]),
  monRole: vi.fn(async () => "admin"),
  listTachesBonCommande: (...args: unknown[]) => listTachesBonCommande(...args),
  planifierTache: (...args: unknown[]) => planifierTache(...args),
}));

const { chargerSession, tacheDuBonCommande } = await import(
  "@/integrations/session"
);

const BC = "bc-uuid";
const DATE = "2026-09-11";

/** La tâche PEINTURE du bon, arbitrée par le conducteur. */
const PEINTURE_VALIDEE = {
  id: "tache-peinture",
  bon_commande_id: BC,
  metier: "PEINTURE",
  date_tache: DATE,
  statut: "validee",
};

beforeEach(async () => {
  listTachesBonCommande.mockReset();
  planifierTache.mockReset();
  planifierTache.mockImplementation(async (_societe: string, input: object) => ({
    id: "tache-creee",
    statut: "planifiee",
    ...input,
  }));
  await chargerSession();
});

describe("Matérialisation par métier", () => {
  it("ne rend pas la tâche d'un autre métier", async () => {
    listTachesBonCommande.mockResolvedValue([PEINTURE_VALIDEE]);

    const tache = await tacheDuBonCommande(BC, DATE, "BDC2026-2023", "SOL");

    expect(tache.id).not.toBe(PEINTURE_VALIDEE.id);
    expect(tache.metier).toBe("SOL");
    expect(tache.statut).toBe("planifiee");
  });

  it("crée la tâche manquante du second métier", async () => {
    listTachesBonCommande.mockResolvedValue([PEINTURE_VALIDEE]);

    await tacheDuBonCommande(BC, DATE, "BDC2026-2023", "SOL");

    expect(planifierTache).toHaveBeenCalledWith(
      "soc-uuid",
      expect.objectContaining({ bon_commande_id: BC, metier: "SOL" })
    );
  });

  it("retrouve la tâche du métier demandé sans en créer une autre", async () => {
    listTachesBonCommande.mockResolvedValue([PEINTURE_VALIDEE]);

    const tache = await tacheDuBonCommande(BC, DATE, "BDC2026-2023", "PEINTURE");

    expect(tache.id).toBe(PEINTURE_VALIDEE.id);
    expect(planifierTache).not.toHaveBeenCalled();
  });

  it("laisse chaque métier à son propre statut", async () => {
    listTachesBonCommande.mockResolvedValue([
      PEINTURE_VALIDEE,
      { ...PEINTURE_VALIDEE, id: "tache-sol", metier: "SOL", statut: "planifiee" },
    ]);

    const peinture = await tacheDuBonCommande(BC, DATE, "BDC", "PEINTURE");
    const sol = await tacheDuBonCommande(BC, DATE, "BDC", "SOL");

    expect(peinture.statut).toBe("validee");
    expect(sol.statut).toBe("planifiee");
    expect(planifierTache).not.toHaveBeenCalled();
  });
});

describe("Bon sans métier déclaré", () => {
  /* 221 tâches en production appartiennent à des bons qui ne déclarent aucun
     métier : leur circuit ne doit pas changer. */
  it("garde une tâche unique sans métier", async () => {
    const sansMetier = {
      id: "tache-nue",
      bon_commande_id: BC,
      metier: "",
      date_tache: DATE,
      statut: "realisee",
    };
    listTachesBonCommande.mockResolvedValue([sansMetier]);

    const tache = await tacheDuBonCommande(BC, DATE, "Intervention", null);

    expect(tache.id).toBe(sansMetier.id);
    expect(planifierTache).not.toHaveBeenCalled();
  });

  it("traite `null` et la chaîne vide comme le même cas", async () => {
    listTachesBonCommande.mockResolvedValue([
      { id: "tache-nue", bon_commande_id: BC, metier: null, date_tache: DATE },
    ]);

    const tache = await tacheDuBonCommande(BC, DATE, "Intervention");

    expect(tache.id).toBe("tache-nue");
    expect(planifierTache).not.toHaveBeenCalled();
  });

  it("crée sans métier plutôt qu'avec une chaîne vide", async () => {
    listTachesBonCommande.mockResolvedValue([]);

    await tacheDuBonCommande(BC, DATE, "Intervention", "");

    expect(planifierTache).toHaveBeenCalledWith(
      "soc-uuid",
      expect.objectContaining({ metier: null })
    );
  });
});

describe("Dates d'un même métier", () => {
  it("préfère la tâche de la date demandée", async () => {
    listTachesBonCommande.mockResolvedValue([
      { ...PEINTURE_VALIDEE, id: "veille", date_tache: "2026-09-10" },
      { ...PEINTURE_VALIDEE, id: "du-jour", date_tache: DATE },
    ]);

    const tache = await tacheDuBonCommande(BC, DATE, "BDC", "PEINTURE");

    expect(tache.id).toBe("du-jour");
  });

  it("se rabat sur une autre date du même métier, jamais sur un autre métier", async () => {
    listTachesBonCommande.mockResolvedValue([
      { ...PEINTURE_VALIDEE, id: "sol-du-jour", metier: "SOL" },
      { ...PEINTURE_VALIDEE, id: "peinture-veille", date_tache: "2026-09-10" },
    ]);

    const tache = await tacheDuBonCommande(BC, DATE, "BDC", "PEINTURE");

    expect(tache.id).toBe("peinture-veille");
  });
});
