import { describe, expect, it } from "vitest";
import { alertesVehicule, trierAlertes } from "./echeances";
import { kilometrageApres, schemaSaisieEntretien } from "./entretien";
import { lireEtatDepart, lireMarquesRetour, marqueDepuisClic } from "./schema-vehicule";
import { compterVehicules, filtrerVehicules, saisieDepuis, schemaSaisieVehicule, typesProposes, type Vehicule } from "./vehicule";
import { ligneDeVente, schemaSaisieVente, tauxProposes } from "./vente";

const base: Vehicule = {
  id: "v1", societe_id: "s", nom: null, immatriculation: "AB-123-CD", marque: "Renault", modele: "Trafic", type_vehicule: "CTTE", tva_applicable: true,
  motorisation: null, taille_pneus: null, kilometrage: 1000, date_achat: null, date_controle_technique: null, conducteur_salarie_id: null,
  telepeage_fournisseur: null, telepeage_numero: null, telepeage_validite: null, carte_carburant_fournisseur: null, carte_carburant_numero: null,
  carte_carburant_validite: null, vendu: false, date_vente: null, prix_vente: null, facture_vente_id: null,
};

describe("saisie d'un véhicule (VEH-02)", () => {
  it("la plaque est obligatoire et mise en capitales", () => {
    expect(schemaSaisieVehicule.safeParse({ ...saisieDepuis(null), immatriculation: "  " }).success).toBe(false);
    const r = schemaSaisieVehicule.parse({ ...saisieDepuis(null), immatriculation: " ab-123-cd " });
    expect(r.immatriculation).toBe("AB-123-CD");
  });

  it("vide devient null, jamais \"\" (date, conducteur)", () => {
    const r = schemaSaisieVehicule.parse({ ...saisieDepuis(null), immatriculation: "X" });
    expect(r.date_controle_technique).toBeNull();
    expect(r.conducteur_salarie_id).toBeNull();
    expect(r.kilometrage).toBeNull();
    expect(r.tva_applicable).toBe(true);
  });

  it("la validité de la carte carburant est une date : un code PIN est refusé au formulaire (D-VEH-05)", () => {
    const r = schemaSaisieVehicule.safeParse({ ...saisieDepuis(null), immatriculation: "X", carte_carburant_validite: "1234" });
    expect(r.success).toBe(false);
  });

  it("le CT va dans `date_controle_technique`, pas dans un champ sans colonne (VEH-21)", () => {
    const r = schemaSaisieVehicule.parse({ ...saisieDepuis(null), immatriculation: "X", date_controle_technique: "2027-01-15" });
    expect(r).toHaveProperty("date_controle_technique", "2027-01-15");
    expect(r).not.toHaveProperty("prochain_c_t");
  });

  it("un type inconnu déjà porté reste proposé, et n'est pas remplacé par CTTE", () => {
    expect(saisieDepuis({ ...base, type_vehicule: "Poids lourd" }).type_vehicule).toBe("Poids lourd");
    expect(typesProposes("Poids lourd")[0]).toEqual({ valeur: "Poids lourd", libelle: "Poids lourd" });
    expect(typesProposes("VP")).toHaveLength(3);
  });

  it("filtre En service / Vendus / Tous et compteurs", () => {
    const liste = [base, { ...base, id: "v2", vendu: true }];
    expect(filtrerVehicules(liste, "actifs").map((v) => v.id)).toEqual(["v1"]);
    expect(filtrerVehicules(liste, "vendus").map((v) => v.id)).toEqual(["v2"]);
    expect(compterVehicules(liste)).toEqual({ actifs: 1, vendus: 1, tous: 2 });
  });
});

describe("échéances selon les seuils des réglages (D-VEH-04)", () => {
  const seuils = { vehiculeCarte: 30, vehiculeControle: 10 };
  it("le CT suit le seuil « contrôle » réglé, pas 30 codé en dur", () => {
    const v = { ...base, date_controle_technique: "2026-10-15" };
    expect(alertesVehicule(v, seuils, [], "2026-09-25")).toEqual([]);
    expect(alertesVehicule(v, { ...seuils, vehiculeControle: 30 }, [], "2026-09-25")[0]).toMatchObject({ categorie: "Contrôle technique", jours: 20, niveau: "alerte" });
  });

  it("les documents qui expirent (assurance…) sonnent aussi, les vendus jamais", () => {
    const docs = [{ id: "d1", vehicule_id: "v1", type: "Assurance", nom: "Attestation", date_expiration: "2026-09-20" }];
    const [a] = alertesVehicule(base, seuils, docs, "2026-09-25");
    expect(a).toMatchObject({ id: "veh_doc_d1", niveau: "danger", jours: -5, libelle: "AB-123-CD · Renault Trafic — Attestation" });
    expect(alertesVehicule({ ...base, vendu: true }, seuils, docs, "2026-09-25")).toEqual([]);
  });

  it("les expirées d'abord, puis par échéance", () => {
    const v = { ...base, carte_carburant_validite: "2026-10-01", telepeage_validite: "2026-09-01", date_controle_technique: "2026-09-28" };
    expect(trierAlertes(alertesVehicule(v, seuils, [], "2026-09-25")).map((a) => a.categorie)).toEqual(["Télépéage", "Contrôle technique", "Carte carburant"]);
  });
});

describe("entretien (VEH-03)", () => {
  it("montant vide → 0, km vide → rien ; « 12abc » est refusé", () => {
    const r = schemaSaisieEntretien.parse({ designation: "Vidange", kilometrage: "", montant: "", date_entretien: "2026-09-01" });
    expect(r).toMatchObject({ montant: 0, kilometrage: null });
    expect(schemaSaisieEntretien.safeParse({ designation: "Vidange", kilometrage: "12abc", montant: "", date_entretien: "" }).success).toBe(false);
    expect(schemaSaisieEntretien.safeParse({ designation: " ", kilometrage: "", montant: "", date_entretien: "" }).success).toBe(false);
  });

  it("le compteur ne descend jamais", () => {
    expect(kilometrageApres(50000, 40000)).toBeNull();
    expect(kilometrageApres(50000, 50001)).toBe(50001);
    expect(kilometrageApres(null, 10)).toBe(10);
    expect(kilometrageApres(50000, null)).toBeNull();
  });
});

describe("schéma d'état du véhicule", () => {
  it("lecture tolérante du jsonb (reprise : texte seul, tableau nu, forme inconnue)", () => {
    expect(lireEtatDepart({ etat: "Bon état", marques: [{ x: 10, y: 20 }] })).toEqual({ etat: "Bon état", marques: [{ x: 10, y: 20 }] });
    expect(lireEtatDepart("Usé")).toEqual({ etat: "Usé", marques: [] });
    expect(lireEtatDepart([{ x: 1, y: 2 }, { x: "?" }])).toEqual({ etat: null, marques: [{ x: 1, y: 2 }] });
    expect(lireEtatDepart(null)).toEqual({ etat: null, marques: [] });
    expect(lireMarquesRetour({ marques: [{ x: 5, y: 5 }] })).toEqual([{ x: 5, y: 5 }]);
  });

  it("un clic est ramené au repère du dessin, quelle que soit sa taille à l'écran", () => {
    const m = marqueDepuisClic({ x: 60, y: 110 }, { left: 0, top: 0, width: 110, height: 210 });
    expect(m?.x).toBeCloseTo(120);
    expect(m?.y).toBeCloseTo(220);
    expect(marqueDepuisClic({ x: -5, y: 0 }, { left: 0, top: 0, width: 110, height: 210 })).toBeNull();
  });
});

describe("vente (VEH-04, D-VEH-06)", () => {
  it("acheteur du répertoire obligatoire, prix > 0", () => {
    expect(schemaSaisieVente.safeParse({ client_id: "", date: "2026-09-25", prix: "5000", tva: "20" }).success).toBe(false);
    expect(schemaSaisieVente.safeParse({ client_id: "c1", date: "2026-09-25", prix: "0", tva: "20" }).success).toBe(false);
    expect(schemaSaisieVente.parse({ client_id: "c1", date: "", prix: "4 999,99", tva: "20" })).toMatchObject({ prix: 4999.99, tva: 20 });
  });

  it("taux : ceux des réglages, plus le taux par défaut s'il manque", () => {
    expect(tauxProposes([5.5, 10], 20)).toEqual([5.5, 10, 20]);
    expect(tauxProposes([0, 20], 0)).toEqual([0, 20]);
  });

  it("une seule ligne : 1 × prix, sans unité", () => {
    expect(ligneDeVente("Vente", 0.1 + 0.2, 20)).toMatchObject({ quantite: 1, unite: null, tva: 20, position: 0, type: "ligne" });
  });
});
