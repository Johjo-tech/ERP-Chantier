import { describe, expect, it } from "vitest";
import { MATRICE_REELLE } from "@/test/session-factice";
import { peut, type RoleMembre } from "@/modules/auth-roles/domain/permissions";
import { cheminPiece, documentsHerites, etatEcheance, joursAvant, libelleEcheance, trierParEcheance } from "./documents-legaux";
import { comptesLiables, schemaSaisieFournisseur } from "./intervenants";
import { codeDepuisLibelle, echange } from "./listes";
import { baisses, lignesNumerotation, schemaSaisieCompteur } from "./numerotation";
import { rubriqueRetenue, rubriquesVisibles } from "./rubriques";

describe("rubriques (PAR-01)", () => {
  const ids = (role: RoleMembre) => rubriquesVisibles((m) => peut(MATRICE_REELLE, role, m, "voir")).flatMap((g) => g.rubriques.map((r) => r.id));

  it("l'administrateur voit tout, comptes et accès clients compris", () => {
    expect(ids("admin")).toContain("comptes");
    expect(ids("admin")).toContain("acces-clients");
    // Les 11 rubriques de l'ancien, « Mon nom » et les deux de l'accès (D-ECR-PAR-08).
    expect(ids("admin")).toHaveLength(14);
  });

  it("secrétaire, conducteur et lecture voient les réglages, pas les comptes", () => {
    for (const r of ["secretaire", "conducteur", "lecture"] as const) {
      expect(ids(r), r).toContain("organisation");
      expect(ids(r), r).not.toContain("comptes");
    }
  });

  it("technicien et sous-traitant n'ont aucune rubrique", () => {
    expect(ids("technicien")).toEqual([]);
    expect(ids("sous_traitant")).toEqual([]);
  });

  it("une rubrique inconnue ou interdite retombe sur Organisation", () => {
    const groupes = rubriquesVisibles((m) => peut(MATRICE_REELLE, "secretaire", m, "voir"));
    expect(rubriqueRetenue("comptes", groupes)?.id).toBe("organisation");
    expect(rubriqueRetenue("n-importe-quoi", groupes)?.id).toBe("organisation");
    expect(rubriqueRetenue("numerotation", groupes)?.id).toBe("numerotation");
  });
});

describe("numérotation (PAR-03)", () => {
  const compteurs = [{ type: "devis", annee: 2026, valeur: 41, prefixe: "D" }, { type: "facture", annee: 2025, valeur: 9, prefixe: "F" }];

  it("prend le compteur de l'année, sinon le défaut", () => {
    const l = lignesNumerotation(compteurs, 2026);
    expect(l.find((x) => x.type === "devis")).toMatchObject({ prefixe: "D", valeur: 41, existe: true });
    expect(l.find((x) => x.type === "facture")).toMatchObject({ prefixe: "FAC", valeur: 0, existe: false });
  });

  it("repère un compteur qui baisse, pas celui qui monte ni celui qui naît", () => {
    const l = lignesNumerotation(compteurs, 2026);
    const saisies = { devis: { prefixe: "D", valeur: 40 }, facture: { prefixe: "FAC", valeur: 0 }, intervention: { prefixe: "INT", valeur: 3 }, sav: { prefixe: "SAV", valeur: 0 } };
    expect(baisses(l, saisies)).toEqual([{ libelle: "Devis", de: 41, a: 40 }]);
  });

  it("un préfixe porte lettres et chiffres, sans tiret (le tiret sépare l'année)", () => {
    expect(schemaSaisieCompteur.safeParse({ prefixe: "DEV", valeur: "0" }).success).toBe(true);
    expect(schemaSaisieCompteur.safeParse({ prefixe: "DE-V", valeur: "0" }).success).toBe(false);
    expect(schemaSaisieCompteur.safeParse({ prefixe: "DEV", valeur: "-1" }).success).toBe(false);
  });
});

describe("documents légaux (SOC-09)", () => {
  it("compte les jours sur des dates civiles", () => {
    expect(joursAvant("2026-10-25", "2026-09-25")).toBe(30);
    expect(joursAvant("2026-03-30", "2026-03-28")).toBe(2);
    expect(joursAvant(null, "2026-09-25")).toBeNull();
  });

  it("« DANS n J » à 30 jours ou moins, « EXPIRÉ » passé l'échéance", () => {
    expect(libelleEcheance(etatEcheance("2026-10-25", "2026-09-25", 30))).toBe("DANS 30 J");
    expect(libelleEcheance(etatEcheance("2026-10-26", "2026-09-25", 30))).toBeNull();
    expect(libelleEcheance(etatEcheance("2026-09-24", "2026-09-25", 30))).toBe("EXPIRÉ");
  });

  it("trie l'échéance la plus proche d'abord, les pièces sans date à la fin", () => {
    const docs = [{ date_validite: null }, { date_validite: "2027-01-01" }, { date_validite: "2026-01-01" }];
    expect(trierParEcheance(docs).map((d) => d.date_validite)).toEqual(["2026-01-01", "2027-01-01", null]);
  });

  it("range le fichier sous la société, nom nettoyé (SOC-22)", () => {
    expect(cheminPiece("s1", "documents-legaux", "Attestation URSSAF été.pdf", 7)).toBe("s1/documents-legaux/7-Attestation_URSSAF_ete.pdf");
  });

  it("relit les pièces rangées dans le JSON par l'ancienne app (SOC-51)", () => {
    expect(documentsHerites({ documentsLegaux: [{ id: "1", type: "KBIS", dateExpiration: "2026-01-01" }, 3] })).toEqual([{ id: "1", type: "KBIS", dateExpiration: "2026-01-01" }]);
    expect(documentsHerites({})).toEqual([]);
  });
});

describe("listes de choix (PAR-04, PAR-21)", () => {
  it("le code dérivé garde les lettres accentuées (« location_de_mat_riel » corrigé)", () => {
    expect(codeDepuisLibelle("Location de matériel")).toBe("location_de_materiel");
    expect(codeDepuisLibelle("Main-d'œuvre")).toBe("main_d_uvre");
  });

  it("échange deux positions ; des positions égales prennent d'abord leur rang", () => {
    const l = [{ id: "a", libelle: "A", position: 0 }, { id: "b", libelle: "B", position: 0 }];
    expect(echange(l, "b", -1)).toEqual([{ id: "b", position: 1 }, { id: "a", position: 2 }]);
    expect(echange([{ id: "a", libelle: "A", position: 3 }, { id: "b", libelle: "B", position: 7 }], "a", 1)).toEqual([{ id: "a", position: 7 }, { id: "b", position: 3 }]);
    expect(echange(l, "a", -1)).toBeNull();
  });
});

describe("intervenants (PAR-06)", () => {
  it("un compte déjà lié à une autre fiche conducteur n'est plus proposé", () => {
    const membres = [{ profileId: "p1", nom: "Un", actif: true }, { profileId: "p2", nom: "Deux", actif: true }, { profileId: "p3", nom: "Trois", actif: false }];
    const fiches = [{ id: "c1", profile_id: "p1" }, { id: "c2", profile_id: null }];
    expect(comptesLiables(membres, fiches, "c2").map((c) => c.valeur)).toEqual(["p2"]);
    expect(comptesLiables(membres, fiches, "c1").map((c) => c.valeur)).toEqual(["p1", "p2"]);
  });

  it("un fournisseur sans SIRET s'enregistre, un SIRET faux bloque", () => {
    const base = { nom: "Point P", specialite: "", contact_nom: "", telephone: "", email: "", adresse: "", code_postal: "", ville: "", siret: "", notes: "" };
    expect(schemaSaisieFournisseur.safeParse(base).success).toBe(true);
    expect(schemaSaisieFournisseur.safeParse({ ...base, siret: "12345678901234" }).success).toBe(false);
  });
});
