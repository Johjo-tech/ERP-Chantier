import { describe, expect, it } from "vitest";
import {
  TRI_FACTURES_DEFAUT,
  trierFactures,
  type FactureTriable,
} from "./regles-tri-factures";

type F = FactureTriable & { id: string; ht?: number };

const ids = (liste: F[]) => liste.map((f) => f.id);

describe("trierFactures — par numéro", () => {
  it("le défaut est le numéro, du plus récent au plus ancien", () => {
    expect(TRI_FACTURES_DEFAUT).toBe("numero_desc");
    const liste: F[] = [
      { id: "a", numero: "FAC-000010", date: "2026-09-01" },
      { id: "b", numero: "FAC-000012", date: "2026-09-01" },
      { id: "c", numero: "FAC-000011", date: "2026-09-01" },
    ];
    expect(ids(trierFactures(liste))).toEqual(["b", "c", "a"]);
    expect(ids(trierFactures(liste, ""))).toEqual(["b", "c", "a"]);
  });

  it("deux factures du même jour suivent leur numéro, pas leur ordre de saisie", () => {
    /* Le défaut corrigé : la liste ne connaissait que la date, puis la date de
       saisie. Une facture saisie avant sa voisine mais numérotée après passait
       derrière elle. */
    const liste: F[] = [
      { id: "saisie-tard", numero: "FAC-000041", date: "2026-09-15", createdAt: "2026-09-15T16:00:00Z" },
      { id: "saisie-tot", numero: "FAC-000042", date: "2026-09-15", createdAt: "2026-09-15T08:00:00Z" },
    ];
    expect(ids(trierFactures(liste, "numero_desc"))).toEqual(["saisie-tot", "saisie-tard"]);
    expect(ids(trierFactures(liste, "numero_asc"))).toEqual(["saisie-tard", "saisie-tot"]);
  });

  it("compare les numéros en nombres, pas en texte", () => {
    const liste: F[] = [
      { id: "99", numero: "FAC-99" },
      { id: "100", numero: "FAC-100" },
      { id: "9", numero: "FAC-9" },
    ];
    expect(ids(trierFactures(liste, "numero_asc"))).toEqual(["9", "99", "100"]);
  });

  it("l'historique importé sans tiret et la série native se suivent", () => {
    const liste: F[] = [
      { id: "native", numero: "FAC-000122" },
      { id: "importee-recente", numero: "FAC000121" },
      { id: "importee-ancienne", numero: "FAC000003" },
    ];
    expect(ids(trierFactures(liste, "numero_desc"))).toEqual([
      "native",
      "importee-recente",
      "importee-ancienne",
    ]);
  });

  it("un brouillon passe après le dernier numéro : en tête du récent → ancien, en fin de l'autre", () => {
    const liste: F[] = [
      { id: "emise", numero: "FAC-000200", date: "2026-10-01" },
      { id: "brouillon", numero: null, date: "2026-09-01" },
      { id: "brouillon-vide", numero: "", date: "2026-10-02" },
    ];
    expect(ids(trierFactures(liste, "numero_desc"))).toEqual(["brouillon-vide", "brouillon", "emise"]);
    expect(ids(trierFactures(liste, "numero_asc"))).toEqual(["emise", "brouillon", "brouillon-vide"]);
  });
});

describe("trierFactures — par date d'émission", () => {
  const liste: F[] = [
    { id: "aout", numero: "FAC-000005", date: "2026-08-20" },
    { id: "sept-1", numero: "FAC-000006", date: "2026-09-03" },
    { id: "sept-2", numero: "FAC-000007", date: "2026-09-03" },
    { id: "sans-date", numero: "FAC-000008", date: "" },
  ];

  it("récente → ancienne, le numéro départage le même jour", () => {
    expect(ids(trierFactures(liste, "date_desc"))).toEqual(["sept-2", "sept-1", "aout", "sans-date"]);
  });

  it("ancienne → récente", () => {
    expect(ids(trierFactures(liste, "date_asc"))).toEqual(["aout", "sept-1", "sept-2", "sans-date"]);
  });
});

describe("trierFactures — client et montant", () => {
  it("par client de A à Z, accents compris, la plus récente d'abord chez chacun", () => {
    const liste: F[] = [
      { id: "zola", client: "Zola", numero: "FAC-1" },
      { id: "eric-1", client: "Éric Habitat", numero: "FAC-2" },
      { id: "eric-2", client: "Éric Habitat", numero: "FAC-3" },
      { id: "anonyme", client: "", numero: "FAC-4" },
      { id: "dupont", client: "dupont", numero: "FAC-5" },
    ];
    expect(ids(trierFactures(liste, "client"))).toEqual(["dupont", "eric-2", "eric-1", "zola", "anonyme"]);
  });

  it("par montant, celui que l'écran fournit", () => {
    const liste: F[] = [
      { id: "petite", numero: "FAC-1", ht: 120 },
      { id: "avoir", numero: "AV-1", ht: -500 },
      { id: "grosse", numero: "FAC-2", ht: 9800 },
    ];
    expect(ids(trierFactures(liste, "montant_desc", (f) => f.ht ?? 0))).toEqual([
      "grosse",
      "petite",
      "avoir",
    ]);
  });
});

describe("trierFactures — garde-fous", () => {
  it("ne modifie pas la liste reçue", () => {
    const liste: F[] = [
      { id: "a", numero: "FAC-1" },
      { id: "b", numero: "FAC-2" },
    ];
    trierFactures(liste, "numero_desc");
    expect(ids(liste)).toEqual(["a", "b"]);
  });

  it("une clé inconnue vaut le tri par défaut", () => {
    const liste: F[] = [
      { id: "a", numero: "FAC-1" },
      { id: "b", numero: "FAC-2" },
    ];
    expect(ids(trierFactures(liste, "n_importe_quoi"))).toEqual(["b", "a"]);
  });
});
