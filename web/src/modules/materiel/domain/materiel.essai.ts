import { describe, expect, it } from "vitest";
import { composerListe, filtrerMateriels, saisieDepuis, schemaSaisieMateriel, valeurDansListe, type Materiel } from "./materiel";
import { nomEmprunteur, retourPrevu, schemaSaisiePret, trierPrets } from "./prets";

const m: Materiel = { id: "m1", societe_id: "s", nom: "Perforateur Hilti", categorie: "Outillage", etat_general: "Bon état", numero_serie: null, date_achat: null };

describe("fiche matériel (VEH-05)", () => {
  it("le nom est requis ; vide devient null", () => {
    expect(schemaSaisieMateriel.safeParse({ ...saisieDepuis(null, "Neuf"), nom: " " }).success).toBe(false);
    expect(schemaSaisieMateriel.parse({ ...saisieDepuis(null, "Neuf"), nom: "Disqueuse" })).toMatchObject({ categorie: null, date_achat: null, etat_general: "Neuf" });
  });

  it("une fiche « echafaudage » retrouve « Échafaudage » dans la liste (plus de repli silencieux sur « Non précisé »)", () => {
    expect(valeurDansListe(composerListe(["Échafaudage"], []), "echafaudage")).toBe("Échafaudage");
    expect(valeurDansListe(["Outillage"], "Levage")).toBe("Levage");
  });

  it("recherche sur le nom et la catégorie, sans accents", () => {
    expect(filtrerMateriels([m], "outil hilti")).toHaveLength(1);
    expect(filtrerMateriels([m], "levage")).toHaveLength(0);
  });
});

describe("prêts (VEH-05)", () => {
  it("durée entière ≥ 1 ou rien : « -2 » et « 2,5 » refusés (l'ancien les acceptait)", () => {
    const ok = { salarie_id: "s1", etat: "Neuf", date_debut: "2026-09-25" };
    expect(schemaSaisiePret.parse({ ...ok, duree_jours: "" }).duree_jours).toBeNull();
    expect(schemaSaisiePret.parse({ ...ok, duree_jours: "3" }).duree_jours).toBe(3);
    expect(schemaSaisiePret.safeParse({ ...ok, duree_jours: "-2" }).success).toBe(false);
    expect(schemaSaisiePret.safeParse({ ...ok, duree_jours: "2,5" }).success).toBe(false);
  });

  it("l'emprunteur est obligatoire ; la date vide vaut aujourd'hui", () => {
    expect(schemaSaisiePret.safeParse({ salarie_id: "", etat: "", date_debut: "", duree_jours: "" }).success).toBe(false);
    expect(schemaSaisiePret.parse({ salarie_id: "s1", etat: "", date_debut: "", duree_jours: "" }).date_debut).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("retour prévu, historique du plus récent au plus ancien, emprunteur lisible", () => {
    expect(retourPrevu({ date_debut: "2026-09-28", duree_jours: 5 })).toBe("2026-10-03");
    expect(retourPrevu({ date_debut: "2026-09-28", duree_jours: null })).toBeNull();
    expect(trierPrets([{ date_debut: "2026-01-01" }, { date_debut: "2026-06-01" }, { date_debut: null }]).map((p) => p.date_debut)).toEqual(["2026-06-01", "2026-01-01", null]);
    const annuaire = [{ id: "s1", prenom: "Thomas", nom: "Martin" }];
    expect(nomEmprunteur({ salarie_id: "s1", personne: null }, annuaire)).toBe("Thomas Martin");
    expect(nomEmprunteur({ salarie_id: "sX", personne: "Paul (reprise)" }, annuaire)).toBe("Paul (reprise)");
    expect(nomEmprunteur({ salarie_id: null, personne: null }, annuaire)).toBe("Inconnu");
  });
});
