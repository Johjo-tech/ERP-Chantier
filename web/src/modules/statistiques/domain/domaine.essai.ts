import { describe, expect, it } from "vitest";
import { bonEssai, EQUIPE_A, EQUIPE_B, ST_A, tacheEssai } from "@/modules/planning/domain/fabrique.essai-aide";
import { avancementDuBon, dateFinReelle, nombreDeTentatives, statsConducteur, type BonLu } from "./conducteur";
import { moisGlissants, premierDuMois, refusPlage } from "./periodes";
import { genreDuTableau, lienActivite } from "./pilotage";
import { indexSuivant, resultatsRecherche } from "./recherche";
import { statutReglementFacture, totauxPiece } from "./ancien/montants";
import { activiteRecente, aTraiterPilotage, resumeDuMois, revenuPeriode, topClients, tuilesPilotage, type BonPilotage, type DevisPilotage, type FacturePilotage } from "./ancien/pilotage";
import { equipesParMois, filtrerParPeriode, moisLabelCourt, periodeLabel, retardParConducteur, statsParConducteur, type BonStats } from "./ancien/statistiques";
import { mesBonsTechnicien, tableauSousTraitant, tableauTechnicien } from "./ancien/terrain";

const JOUR = "2026-09-25";
const MAINTENANT = new Date("2026-09-25T10:00:00Z");
const ligne = (ht: number) => ({ type: "ligne", quantite: 1, prix_unitaire: ht, tva: 20 });

function facture(s: Partial<FacturePilotage> & { ht?: number } = {}): FacturePilotage {
  const { ht = 100, ...reste } = s;
  return {
    id: "f1", numero: "FAC-2026-000001", client_nom: "OPAC", date: JOUR, echeance: null, statut: "impayée", type_document: "facture",
    legacy_id: null, bon_commande_id: null, devis_id: null, conducteur: null, cree_le: "2026-09-25T08:00:00Z", remise_pourcentage: 0, lignes: [ligne(ht)], ...reste,
  };
}
function devis(s: Partial<DevisPilotage> & { ht?: number } = {}): DevisPilotage {
  const { ht = 100, ...reste } = s;
  return { id: "d1", numero: "DEV-1", client_nom: "OPAC", date: JOUR, statut: "envoyé", conducteur: null, cree_le: "2026-09-24T08:00:00Z", remise_pourcentage: 0, lignes: [ligne(ht)], ...reste };
}
const sixMois = moisGlissants(6, JOUR).map((m) => ({ year: m.annee, month: m.mois - 1 }));

describe("périodes", () => {
  it("les mois glissants franchissent l'année", () => {
    expect(moisGlissants(3, "2026-02-10").map((m) => m.cle)).toEqual(["2025-12", "2026-01", "2026-02"]);
  });
  it("plage libre : du premier du mois à aujourd'hui, et les refus de l'ancien", () => {
    expect(premierDuMois(JOUR)).toBe("2026-09-01");
    expect(refusPlage("", "2026-09-01")).toBe("Choisissez les deux dates.");
    expect(refusPlage("2026-09-02", "2026-09-01")).toBe("La date de début doit être avant la date de fin.");
    expect(refusPlage("2026-09-01", "2026-09-01")).toBeNull();
  });
});

describe("montants de l'ancien (flottant)", () => {
  it("un avoir compte en négatif ; la remise s'applique au HT et au TTC", () => {
    expect(totauxPiece(facture({ type_document: "avoir", ht: 50 }))).toEqual({ ht: -50, ttc: -60 });
    expect(totauxPiece({ ...facture({ ht: 200 }), remise_pourcentage: 10 })).toEqual({ ht: 180, ttc: 216 });
  });
  it("10,005 € reste le flottant 10,004999… : l'ancien écrit « 10,00 € »", () => {
    const t = totauxPiece({ lignes: [{ type: "ligne", quantite: 3, prix_unitaire: 3.335, tva: 0 }], remise_pourcentage: 0 });
    expect(new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(t.ht)).toBe("10,00 €");
  });
  it("une pièce reprise « payée » est réglée sans règlement ; sinon ses règlements font foi", () => {
    expect(statutReglementFacture({ ...facture(), legacy_id: "compta:FAC1", statut: "payée" }, [])).toEqual({ cle: "reglee", reste: 0 });
    expect(statutReglementFacture(facture(), [{ facture_id: "f1", montant: 20 }])).toEqual({ cle: "partiellement_reglee", reste: 100 });
  });
});

describe("pilotage (défauts de l'ancien conservés)", () => {
  it("DEF-STA-01 : le chiffre d'affaires compte brouillons et acomptes", () => {
    const r = revenuPeriode([facture({ statut: "brouillon", numero: null }), facture({ type_document: "acompte" })], sixMois, 2026);
    expect(r.total).toBe(200);
  });

  it("DEF-STA-02 : « CA encaissé » = HT des factures au statut « payée » datées du mois", () => {
    const r = resumeDuMois([facture({ statut: "payée", date: "2026-08-30" }), facture({ id: "f2", statut: "payée" })], [], [], JOUR, sixMois);
    expect(r.caMois).toBe(100);
  });

  it("DEF-STA-03 : un brouillon compte comme dû ET comme facturé (restant dû, taux d'encaissement)", () => {
    const r = resumeDuMois([facture(), facture({ id: "f2", statut: "brouillon", numero: null })], [], [], JOUR, sixMois);
    // 240 « restant dû », dont 120 d'un brouillon qui ne doit rien à personne.
    expect(r.impayeesMontant).toBe(240);
    expect(r.tauxEncaisse).toBe(0);
  });

  it("DEF-STA-04 : « impayée » et « échue » se lisent sur le statut stocké, pas sur les règlements", () => {
    const f = facture({ echeance: "2026-09-01" });
    expect(tuilesPilotage([f], []).impayees).toBe(1);
    expect(aTraiterPilotage([], [f, facture({ id: "f2", statut: "payée", echeance: "2026-09-01" })], JOUR).facturesEchues).toBe(1);
  });

  it("DEF-STA-05 : les rappels comptent aussi les bons clos", () => {
    const bon = (s: Partial<BonPilotage>): BonPilotage => ({ id: "b", statut_workflow: "en_cours", bon_commande_parent_id: null, rappel_date: null, valideConducteur: false, valideDirecteur: false, lignes: [], ...s });
    const t = aTraiterPilotage([bon({ id: "b1", statut_workflow: "cloture_gratuit", rappel_date: "2026-09-01" }), bon({ id: "b2", rappel_date: JOUR })], [], JOUR);
    expect(t.rappelsAujourdhui).toBe(2);
    expect(t.enAttenteConducteur).toBe(1);
  });

  it("« À facturer » : HT des lignes du bon, sans remise ; un bon désigné par une facture n'y est plus", () => {
    const b: BonPilotage = { id: "b1", statut_workflow: "chiffre", bon_commande_parent_id: null, rappel_date: null, valideConducteur: true, valideDirecteur: true, lignes: [ligne(471.5)] };
    expect(aTraiterPilotage([b], [], JOUR)).toMatchObject({ aFacturer: 1, aFacturerMontant: 471.5 });
    expect(aTraiterPilotage([b], [facture({ bon_commande_id: "b1" })], JOUR).aFacturer).toBe(0);
  });

  it("DEF-STA-06 : l'activité écrit « null » pour une facture sans numéro, et montre un lettrage comme un paiement", () => {
    const f = facture({ numero: null, cree_le: "2026-09-25T09:00:00Z" });
    const a = activiteRecente([devis()], [f], [], [{ id: "r1", facture_id: "f1", montant: -30, cree_le: "2026-09-25T09:30:00Z" }]);
    expect(a.map((x) => x.libelle)).toEqual(["Paiement reçu", "Facture créée", "Devis créé"]);
    expect(a[1]?.sous).toBe("OPAC · null");
    expect(lienActivite(a[0] ?? { nature: "reglement", id: "", factureId: null })).toBe("/factures/f1");
  });

  it("DEF-STA-07 : le classement groupe par le NOM écrit sur la facture", () => {
    const t = topClients([facture({ client_nom: "OPAC" }), facture({ id: "f2", client_nom: "O.P.A.C.", ht: 300 })]);
    expect(t.map((c) => [c.client, c.total, c.largeur])).toEqual([["O.P.A.C.", 300, 100], ["OPAC", 100, 33]]);
  });

  it("le tableau suit le rôle effectif ; le sous-traitant a le sien", () => {
    expect(genreDuTableau("technicien")).toBe("technicien");
    expect(genreDuTableau("sous_traitant")).toBe("sous_traitant");
    expect(genreDuTableau("conducteur")).toBe("conducteur");
    expect(genreDuTableau("lecture")).toBe("pilotage");
    expect(genreDuTableau(null)).toBe("pilotage");
  });
});

describe("statistiques (défauts de l'ancien conservés)", () => {
  const bon = (s: Partial<BonStats>): BonStats => ({ id: "b", cree_le: "2026-09-02T08:00:00Z", conducteur: "Christophe", technicien: null, bon_commande_parent_id: null, date_fin_travaux: null, ...s });

  it("DEF-STA-08 : par étiquette — deux graphies font deux conducteurs, sans ligne « Sans conducteur »", () => {
    const s = statsParConducteur({ bons: [bon({ id: "b1" }), bon({ id: "b2", conducteur: "christophe" }), bon({ id: "b3", conducteur: null })], devis: [], factures: [], conducteurs: ["Christophe"] }, "tout", JOUR, MAINTENANT);
    expect(s.map((x) => [x.nom, x.bcTotal])).toEqual([["Christophe", 1], ["christophe", 1]]);
  });

  it("DEF-STA-09 : un bon facturé dont la fin de travaux est passée est « en retard »", () => {
    const s = statsParConducteur({ bons: [bon({ date_fin_travaux: "2026-09-01" })], devis: [], factures: [facture({ bon_commande_id: "b", conducteur: "Christophe" })], conducteurs: [] }, "tout", JOUR, MAINTENANT);
    expect(s[0]).toMatchObject({ bcEnRetard: 1, tauxDansLesTemps: 0, ca: 100 });
  });

  it("DEF-STA-10 : sans bon, la barre de retard est pleine et rouge (« 0 / 0 »)", () => {
    const s = statsParConducteur({ bons: [bon({})], devis: [], factures: [], conducteurs: ["Karim"] }, "tout", JOUR, MAINTENANT);
    expect(retardParConducteur(s)?.find((l) => l.stat.nom === "Karim")).toMatchObject({ pctOk: 0, pctRetard: 100 });
  });

  it("DEF-STA-11 : travaux supplémentaires toujours à 0 (aucune colonne ne les porte)", () => {
    const s = statsParConducteur({ bons: [bon({})], devis: [], factures: [], conducteurs: [] }, "tout", JOUR, MAINTENANT);
    expect(s[0]).toMatchObject({ nbTravSup: 0, montantTravSup: 0, tauxTravSup: 0 });
  });

  it("période : horodatage lu à l'heure de Paris, date seule à minuit UTC", () => {
    const items = [{ d: "2026-08-31T22:30:00Z" }, { d: "2026-08-31" }, { d: null }];
    expect(filtrerParPeriode(items, (x) => x.d, "mois", MAINTENANT)).toEqual([{ d: "2026-08-31T22:30:00Z" }]);
    expect(periodeLabel("mois", JOUR, MAINTENANT)).toBe("Sep 2026");
    expect(periodeLabel("tout", JOUR, MAINTENANT)).toBe("tout l'historique");
    expect(moisLabelCourt("2026-08")).toBe("Août 2026");
  });

  it("équipes par la colonne `technicien` du bon (uuid ou libellé), « Non attribué » en dernier", () => {
    const t = equipesParMois(
      [facture({ bon_commande_id: "b1" }), facture({ id: "f2", bon_commande_id: "b2", date: "2026-08-10" }), facture({ id: "f3" })],
      [bon({ id: "b1", technicien: "eqA" }), bon({ id: "b2", technicien: "Équipe Karim" })],
      [EQUIPE_A, EQUIPE_B],
      "tout",
      MAINTENANT
    );
    expect(t.mois).toEqual(["2026-08", "2026-09"]);
    expect(t.binomes).toEqual(["Équipe Karim", "Équipe Thomas", "Non attribué"]);
  });
});

describe("terrain", () => {
  const bons = [
    bonEssai({ id: "b1", date_planifiee: JOUR, heure_planifiee: "14:00", technicien: EQUIPE_A.nom }),
    bonEssai({ id: "b2", date_planifiee: "2026-09-28", technicien: EQUIPE_A.id }),
    bonEssai({ id: "b3", date_planifiee: "2026-09-20", technicien: EQUIPE_A.nom }),
    bonEssai({ id: "b4", date_planifiee: JOUR, heure_planifiee: "08:00", technicien: EQUIPE_B.nom }),
  ];

  it("mes bons par la colonne `technicien` (uuid ou libellé) ; sans équipe, tous", () => {
    expect(mesBonsTechnicien(bons, [EQUIPE_A, EQUIPE_B], EQUIPE_A.id).map((b) => b.id)).toEqual(["b1", "b2", "b3"]);
    expect(mesBonsTechnicien(bons, [EQUIPE_A, EQUIPE_B], null)).toHaveLength(4);
  });

  it("aujourd'hui par l'heure, six jours, à pointer par les métiers faits, pièce par la première tâche qui l'attend", () => {
    const taches = [tacheEssai({ bon_commande_id: "b3", metier: "Plomberie", statut: "planifiee", piece_a_commander: true, piece_date_commande: null })];
    const t = tableauTechnicien(bons, taches, JOUR, "2026-10-01");
    expect(t.duJour.map((b) => b.id)).toEqual(["b4", "b1"]);
    expect(t.laSemaine.map((b) => b.id)).toEqual(["b2"]);
    expect(t.aPointer.map((b) => b.id)).toEqual(["b3"]);
    expect(t.pieces.map((b) => b.id)).toEqual(["b3"]);
  });

  it("DEF-STA-13 : seule la date du rendez-vous compte, pas une journée supplémentaire", () => {
    const taches = [tacheEssai({ bon_commande_id: "b3", date_tache: JOUR })];
    expect(tableauTechnicien([bons[2] as (typeof bons)[number]], taches, JOUR, "2026-10-01").duJour).toHaveLength(0);
  });

  it("DEF-STA-14 : sous-traitant — factures prêtes par ses bons validés et chiffrés ; devis et impayés toujours à 0", () => {
    const b = bonEssai({ id: "b1", montant_sous_traitant: 300 });
    const taches = [tacheEssai({ bon_commande_id: "b1", sous_traitant_id: ST_A.id, statut: "validee" })];
    const noms = new Map([[ST_A.id, ST_A.nom]]);
    expect(tableauSousTraitant([b], taches, noms, ST_A.nom)).toEqual({ facturesPretes: 1, devis: 0, impayees: 0 });
    expect(tableauSousTraitant([b], taches, noms, "Autre SARL").facturesPretes).toBe(0);
  });
});

describe("recherche globale", () => {
  const sources = {
    devis: [{ id: "d1", numero: "DEV-2026-000004", client_nom: "Régie Sud", interlocuteur: null, conducteur: null, adresse_locataire: "3 rue Neuve", ville: "Lyon", date: "2026-09-01", statut: "envoyé" }],
    totauxDevis: new Map([["d1", 1234.5]]),
    factures: [{ facture_id: "f1", numero: "FAC-2026-000001", client_nom: "OPAC du Rhône", date: "2026-09-02", ttc: 99 }],
    rapports: [{ id: "i1", numero: "RAP-1", client_nom: "OPAC du Rhône", adresse: null, adresse_locataire: null, ville: null, occupant: "Mme Durand", metier: "plomberie", statut: "terminé", date: "2026-09-03" }],
  };
  it("chaque mot, sans accent ni casse ; les montants sous leurs deux écritures", () => {
    expect(resultatsRecherche("regie neuve", sources).map((r) => r.id)).toEqual(["d1"]);
    expect(resultatsRecherche("1234.50", sources).map((r) => r.id)).toEqual(["d1"]);
    expect(resultatsRecherche("1 234,50", sources).map((r) => r.id)).toEqual(["d1"]);
    expect(resultatsRecherche("opac", sources).map((r) => r.nature)).toEqual(["facture", "rapport"]);
    expect(resultatsRecherche("   ", sources)).toEqual([]);
  });
  it("Entrée reboucle sur les résultats", () => {
    expect(indexSuivant(null, 3)).toBe(0);
    expect(indexSuivant(2, 3)).toBe(0);
    expect(indexSuivant(null, 0)).toBeNull();
  });
});

describe("conducteur", () => {
  const lu: BonLu = { id: "b", conducteur_id: "k", bon_commande_parent_id: null, statut_workflow: "en_cours", client_nom: "C", date: null, date_reception: null, date_planifiee: "2026-09-01", date_fin_travaux: null, date_intervention_terminee: "2026-08-01", rappel_date: null, tentatives_contact: null, probleme_description: null, metier: "Peinture", metiers: [] };
  const t = (s: { metier?: string | null; statut: string; date_tache: string | null; piece_a_commander?: boolean; piece_date_commande?: string | null }) => ({ bon_commande_id: "b", metier: "Peinture", piece_a_commander: false, piece_date_commande: null, ...s });

  it("la fin réelle est la dernière journée faite, lue sur les tâches", () => {
    const b = avancementDuBon(lu, [t({ statut: "realisee", date_tache: "2026-09-01" }), t({ statut: "validee", date_tache: "2026-09-04" })], false);
    expect(b.interventionFaite).toBe(true);
    expect(dateFinReelle(b)).toBe("2026-09-04");
    expect(b.valideConducteur).toBe(false);
  });
  it("sans tâche, rien n'est fait ; une pièce commandée n'attend plus", () => {
    expect(dateFinReelle(avancementDuBon(lu, [], false))).toBeNull();
    const b = avancementDuBon(lu, [t({ statut: "planifiee", date_tache: "2026-09-01", piece_a_commander: true, piece_date_commande: "2026-09-02" })], false);
    expect(b.pieceEnAttente).toBe(false);
  });
  it("DEF-STA-12 : les tentatives sont lues par `parseInt` comme l'ancien — jamais « injoignable »", () => {
    expect(nombreDeTentatives([{}, {}, {}])).toBe(0);
    expect(nombreDeTentatives("3")).toBe(3);
    expect(nombreDeTentatives(null)).toBe(0);
    const b = avancementDuBon({ ...lu, date_planifiee: null, tentatives_contact: [{}, {}, {}] }, [], false);
    expect(statsConducteur([b], JOUR, 7).injoignables).toHaveLength(0);
  });
});
