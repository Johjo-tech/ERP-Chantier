import { describe, expect, it } from "vitest";
import { CATEGORIES_ACHAT_REPLI, categorieDe, categoriesAchat, montantSalarie, schemaSaisieAchat, totauxParCategorie, trierAchats } from "./achats";
import { saisieDepuis, schemaSaisieChantier, varianteStatutChantier } from "./chantier";
import { repriseDevis } from "./devis-vers-dpgf";
import { estFactureeEntierement, lignesFigees } from "./dpgf";
import { ecritSurLeTerrain } from "./droits";
import { lienDevisComplementaire } from "./liens";
import { cheminStockage, nomPourStockage, TAILLE_MAX_FICHIER_CHANTIER, verifierFichierChantier } from "./fichiers";
import { planifier, quantiteDejaPlanifiee, quantiteRestante } from "./planification";
import { contenuPpsps, moisAnnee, nomFichierPpsps } from "./ppsps";
import { validerLignesDpgf } from "./saisie-dpgf";
import { statistiquesChantier } from "./statistiques";
import { estEnRetard, progressionTodo, schemaDetailTodo, statutTodo, statutVoisin } from "./todo";

describe("planifier une quantité (CHA-21)", () => {
  const ligne = { designation: "Peinture", quantite: 10, prix_unitaire: 45.5, metier: "Peinture" };
  it("refuse sans métier, sans reste, et une saisie ≤ 0", () => {
    expect(planifier({ ...ligne, metier: null }, quantiteDejaPlanifiee([]), "2", "C")).toEqual({ ok: false, motif: "Choisissez d'abord un métier pour cette ligne avant de la planifier." });
    expect(planifier(ligne, quantiteDejaPlanifiee([{ quantite_planifiee: 10 }]), "2", "C").ok).toBe(false);
    expect(planifier(ligne, quantiteDejaPlanifiee([]), "0", "C")).toEqual({ ok: false, motif: "Indiquez une quantité supérieure à 0." });
  });
  it("une part entière n'a pas de suffixe ; une virgule française est lue", () => {
    const p = planifier(ligne, quantiteDejaPlanifiee([]), "10", "C");
    expect(p.ok && p.libelle).toBe("C — Peinture");
    const q = planifier(ligne, quantiteDejaPlanifiee([]), "2,5", "C");
    expect(q.ok && [q.quantite.toString(), q.montant.toString()]).toEqual(["2.5", "113.75"]);
  });
  it("le reste ne descend pas sous zéro", () => {
    expect(quantiteRestante(ligne, quantiteDejaPlanifiee([{ quantite_planifiee: 12 }])).toString()).toBe("0");
  });
});

describe("achats (CHA-11, CHA-22, CHA-23, CHA-40, CHA-55)", () => {
  it("le référentiel l'emporte ; vide, le repli ; une entrée sans code est ignorée", () => {
    expect(categoriesAchat([])).toEqual(CATEGORIES_ACHAT_REPLI);
    const c = categoriesAchat([{ code: "salarie", libelle: "Main-d'œuvre", couleur: null, icone: null }, { code: null, libelle: "Sans code", couleur: null, icone: null }]);
    expect(c).toEqual([{ code: "salarie", libelle: "Main-d'œuvre", couleur: "#999", icone: "💰" }]);
    expect(categorieDe(c, "disparue").libelle).toBe("disparue");
  });
  it("main-d'œuvre : 32,50 × 7,5 = 243,75 ; coût inconnu → pas de calcul", () => {
    expect(montantSalarie("7,5", 32.5)?.toString()).toBe("243.75");
    expect(montantSalarie("7.5", null)).toBeNull();
    expect(montantSalarie("7.5", 0)).toBeNull();
  });
  it("totaux exacts et parts arrondies", () => {
    const { parCategorie, total } = totauxParCategorie(CATEGORIES_ACHAT_REPLI, [
      { categorie: "fournitures", montant: 0.1 },
      { categorie: "fournitures", montant: 0.2 },
      { categorie: "salarie", montant: 0.6 },
      { categorie: "inconnue", montant: 100 },
    ]);
    expect(total.toString()).toBe("0.9");
    expect(parCategorie.map((p) => [p.montant.toString(), p.pourcentage])).toEqual([["0.3", 33], ["0.6", 67], ["0", 0]]);
  });
  it("la saisie : date sous date_achat, salarié et heures effacés hors main-d'œuvre, montant vide = 0", () => {
    const base = { categorie: "fournitures", designation: " Placo ", montant: "", date_achat: "2026-09-25", salarie_id: "s1", heures: "3", fournisseur: "" };
    expect(schemaSaisieAchat.parse(base)).toEqual({ categorie: "fournitures", designation: "Placo", montant: 0, date_achat: "2026-09-25", salarie_id: null, heures: null, fournisseur: null });
    expect(schemaSaisieAchat.parse({ ...base, categorie: "salarie", montant: "1 234,5" })).toMatchObject({ montant: 1234.5, salarie_id: "s1", heures: 3 });
    expect(schemaSaisieAchat.safeParse({ ...base, designation: " " }).success).toBe(false);
  });
  it("tri par date décroissante, sans date en dernier", () => {
    expect(trierAchats([{ date_achat: null }, { date_achat: "2026-01-02" }, { date_achat: "2026-03-01" }]).map((a) => a.date_achat)).toEqual(["2026-03-01", "2026-01-02", null]);
  });
});

describe("to-do (CHA-14)", () => {
  it("progression, retard, déplacement au clavier", () => {
    expect(progressionTodo([{ statut: "fait" }, { statut: "a_faire" }, { statut: "en_cours" }])).toEqual({ faits: 1, total: 3, pourcentage: 33 });
    expect(progressionTodo([])).toEqual({ faits: 0, total: 0, pourcentage: 0 });
    expect(estEnRetard({ statut: "a_faire", date_prevue: "2026-09-24" }, "2026-09-25")).toBe(true);
    expect(estEnRetard({ statut: "fait", date_prevue: "2026-09-24" }, "2026-09-25")).toBe(false);
    expect(estEnRetard({ statut: "a_faire", date_prevue: "2026-09-25" }, "2026-09-25")).toBe(false);
    expect(statutVoisin("a_faire", -1)).toBe("a_faire");
    expect(statutVoisin("a_faire", 1)).toBe("en_cours");
    expect(statutTodo({ statut: "inconnu" })).toBe("a_faire");
  });
  it("le détail refuse un texte vide et vide les champs facultatifs en null", () => {
    expect(schemaDetailTodo.safeParse({ texte: "  ", date_prevue: "", salarie_id: "", notes: "" }).success).toBe(false);
    expect(schemaDetailTodo.parse({ texte: "Bâcher", date_prevue: "", salarie_id: "", notes: "" })).toEqual({ texte: "Bâcher", date_prevue: null, salarie_id: null, notes: null });
  });
});

describe("fichiers (CHA-41, CHA-56)", () => {
  it("8 Mo au plus", () => {
    expect(verifierFichierChantier({ size: TAILLE_MAX_FICHIER_CHANTIER }).ok).toBe(true);
    expect(verifierFichierChantier({ size: TAILLE_MAX_FICHIER_CHANTIER + 1 })).toEqual({ ok: false, motif: "Fichier trop volumineux (8 Mo maximum)." });
  });
  it("le chemin commence par la société (clé des politiques Storage) et n'a pas d'accent", () => {
    expect(cheminStockage("s", "c", "CR n°3 – Façade.pdf", 17)).toBe("s/chantiers/c/17_CR-n-3-Facade.pdf");
    expect(nomPourStockage("   ")).toBe("document");
  });
});

describe("DPGF : lignes figées, sélection, saisie en place (CHA-06, CHA-07, CHA-53)", () => {
  it("figée = facturée en partie ou planifiée ; complète = 100 %", () => {
    const f = lignesFigees([{ id: "a", avancement_cumule: 0 }, { id: "b", avancement_cumule: 10 }, { id: "c", avancement_cumule: 0 }], [{ dpgf_ligne_id: "c" }, { dpgf_ligne_id: null }]);
    expect([...f].sort()).toEqual(["b", "c"]);
    expect(estFactureeEntierement({ avancement_cumule: 100 })).toBe(true);
    expect(estFactureeEntierement({ avancement_cumule: 99.99 })).toBe(false);
  });
  it("valide toutes les lignes ou aucune ; une ligne figée ne renvoie ni quantité ni prix", () => {
    const b = { type: "ligne" as const, designation: "Peinture", quantite: "2,5", prix_unitaire: "10", metier: "", figee: false };
    expect(validerLignesDpgf([{ ...b, id: "1" }, { ...b, id: "2", figee: true, quantite: "zz" }])).toEqual({
      ok: true,
      lignes: [{ id: "1", designation: "Peinture", quantite: 2.5, prix_unitaire: 10, metier: null }, { id: "2", designation: "Peinture", metier: null }],
    });
    const r = validerLignesDpgf([{ ...b, id: "1", quantite: "abc" }, { ...b, id: "3", designation: " " }]);
    expect(r.ok ? {} : r.erreurs).toEqual({ "1.quantite": "Quantité invalide.", "3.designation": "La désignation est obligatoire." });
  });
});

describe("reprise d'un devis dans le DPGF (CHA-15)", () => {
  const lignes = [
    { type: "chapitre", designation: "Lot peinture", quantite: 0, prix_unitaire: 0 },
    { type: "ligne", designation: "Murs", quantite: 3, prix_unitaire: 12 },
    { type: "commentaire", designation: "Note", quantite: 0, prix_unitaire: 0 },
    { type: "ligne", designation: "", quantite: 1, prix_unitaire: 1 },
  ];
  it("recopie hors commentaires et désignations vides, avec la référence du devis", () => {
    const r = repriseDevis("d1", lignes, [{ id: "x", devis_source_id: "d1", avancement_cumule: 0 }, { id: "y", devis_source_id: null, avancement_cumule: 0 }], new Set());
    expect(r.aRetirer).toEqual(["x"]);
    expect(r.aAjouter.map((l) => [l.type, l.designation, l.devis_source_id])).toEqual([["chapitre", "Lot peinture", "d1"], ["ligne", "Murs", "d1"]]);
  });
  it("ne touche à rien si une ligne venue du devis est facturée ou planifiée (D-CHA-06)", () => {
    expect(repriseDevis("d1", lignes, [{ id: "x", devis_source_id: "d1", avancement_cumule: 20 }], new Set())).toEqual({ aRetirer: [], aAjouter: [], conservees: 1 });
    expect(repriseDevis("d1", lignes, [{ id: "x", devis_source_id: "d1", avancement_cumule: 0 }], new Set(["x"])).conservees).toBe(1);
  });
});

describe("fiche chantier : statut, PPSPS, droits", () => {
  it("statut par défaut et contrôle de la saisie", () => {
    const s = saisieDepuis(null);
    expect(s.statut).toBe("en préparation");
    expect(schemaSaisieChantier.parse({ ...s, nom: "C", ppsps_lot: " " }).ppsps_lot).toBeNull();
    expect(schemaSaisieChantier.safeParse({ ...s, nom: "C", statut: "fini" }).success).toBe(false);
    expect(varianteStatutChantier("terminé")).toBe("succes");
  });
  it("le PPSPS reprend fiche et société ; maître d'ouvrage = client à défaut", () => {
    const c = { ...saisieDepuis(null), id: "c", societe_id: "s", client_id: null, client_nom: "Office HLM", conducteur: null, nom: "Tilleuls", date_debut: "2026-03-02", date_fin: null, ppsps_lot: "Peinture", ppsps_maitre_ouvrage: null, ppsps_maitre_oeuvre: "Cabinet X\nGrenoble", ppsps_coordinateur_sps: null, ppsps_effectif_moyen: "4", notes: null, conducteur_id: null, adresse: "1 rue A", code_postal: "38000", ville: "Grenoble", type: null };
    const s = { nom: "ALPHA", telephone: "04", email: "a@b.fr", adresse: null, code_postal: null, ville: null, siret: "123", gerant: "M. Durand", gerantTelephone: null };
    const texte = JSON.stringify(contenuPpsps(c, s, "2026-09-25"));
    for (const attendu of ["Office HLM", "Cabinet X", "Grenoble", "Peinture", "effectif moyen : 4", "Début des travaux : 03/2026", "M. Durand", "Siret : 123", "25/09/2026", "1 rue A, 38000 Grenoble"]) expect(texte).toContain(attendu);
    expect(moisAnnee(null)).toBe("");
    expect(nomFichierPpsps("Résidence « Les Tilleuls »")).toBe("PPSPS_R_sidence_Les_Tilleuls_.docx");
  });
  it("le nouveau devis complémentaire emporte client et lieu du chantier", () => {
    expect(lienDevisComplementaire({ id: "c1", client_id: "k1", adresse: "1 rue A", code_postal: "38000", ville: "Grenoble" })).toBe(
      "/devis/nouveau?chantier=c1&client=k1&adresse=1+rue+A&cp=38000&ville=Grenoble"
    );
    expect(lienDevisComplementaire({ id: "c1", client_id: null, adresse: null, code_postal: null, ville: null })).toBe("/devis/nouveau?chantier=c1");
  });
  it("écriture terrain = miroir de peut_ecrire()", () => {
    expect(["admin", "conducteur", "technicien", "secretaire", "lecture", "sous_traitant", null].map((r) => ecritSurLeTerrain(r as never))).toEqual([true, true, true, false, false, false, false]);
  });
  it("statistiques : une source illisible masque sa case au lieu de valoir 0", () => {
    const s = statistiquesChantier({ dpgf: null, achats: null, nbDevis: null, nbFactures: 2, nbComptesRendus: 1, todo: { faits: 0, total: 0 } });
    expect([s.avancement, s.totalAchats, s.margeConstatee, s.nbDevis, s.nbFactures]).toEqual([null, null, null, null, 2]);
    const t = statistiquesChantier({ dpgf: [{ type: "ligne", quantite: 2, prix_unitaire: 100, avancement_cumule: 50 }], achats: [{ montant: 30.5 }], nbDevis: 0, nbFactures: 0, nbComptesRendus: 0, todo: { faits: 0, total: 0 } });
    expect(t.margeConstatee?.toString()).toBe("69.5");
  });
});
