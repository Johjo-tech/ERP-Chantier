import { describe, expect, it } from "vitest";
import { formatEuros, montant } from "@/lib/money";
import { circuitDuBon } from "@/modules/commandes/domain/workflow";
import { construireCartes } from "@/modules/planning/domain/cartes";
import { ANNUAIRES, bonEssai, EQUIPE_A, tacheEssai } from "@/modules/planning/domain/fabrique.essai-aide";
import { avancementDuBon, dateFinReelle, nombreDeTentatives, type BonLu } from "./conducteur";
import { bornesComparaison, bornesStats, libelleMois, moisGlissants, refusPlage } from "./periodes";
import { aTraiterPilotage, genreDuTableau, lienActivite, type BonATraiter } from "./pilotage";
import { indexSuivant, resultatsRecherche } from "./recherche";
import { repartition, tableauEquipes, tauxConducteur } from "./statistiques";
import { tableauTerrain } from "./terrain";

describe("périodes", () => {
  it("les mois glissants franchissent l'année", () => {
    expect(moisGlissants(3, "2026-02-10").map((m) => m.cle)).toEqual(["2025-12", "2026-01", "2026-02"]);
  });
  it("la comparaison lit depuis le même mois de l'année précédente jusqu'à la fin du mois courant", () => {
    expect(bornesComparaison(moisGlissants(6, "2026-09-25"))).toEqual({ du: "2025-04-01", au: "2026-09-30" });
    expect(bornesComparaison(moisGlissants(1, "2028-02-03"))).toEqual({ du: "2027-02-01", au: "2028-02-29" });
  });
  it("périodes des statistiques et plage libre", () => {
    expect(bornesStats("tout", "2026-09-25")).toEqual({ du: null, au: null });
    expect(bornesStats("annee", "2026-09-25")).toEqual({ du: "2026-01-01", au: "2026-12-31" });
    expect(bornesStats("mois", "2026-09-25")).toEqual({ du: "2026-09-01", au: "2026-09-30" });
    expect(refusPlage("", "2026-09-01")).toBe("Choisissez les deux dates.");
    expect(refusPlage("2026-09-02", "2026-09-01")).toBe("La date de début doit être avant la date de fin.");
    expect(refusPlage("2026-09-01", "2026-09-01")).toBeNull();
    expect(libelleMois("2026-08")).toBe("août 2026");
  });
});

describe("pilotage", () => {
  const bon = (s: Partial<BonATraiter> & { statut?: string; taches?: Parameters<typeof circuitDuBon>[0] } = {}): BonATraiter => ({
    statut_workflow: s.statut ?? "en_cours",
    bon_commande_parent_id: null,
    rappel_date: null,
    montant: 100,
    circuit: circuitDuBon(s.taches ?? [], s.statut ?? "en_cours"),
    factures: [],
    ...s,
  });
  const validee = { id: "t", bon_commande_id: "b", libelle: "", metier: null, statut: "validee", date_tache: null, commentaire: null, refus_motif: null, realisee_le: null, validee_le: null, piece_a_commander: false, piece_description: null, piece_fournisseur: null, piece_date_commande: null, piece_recue_le: null };

  it("« À traiter » : un bon clos n'attend personne, un SAV n'attend pas le conducteur", () => {
    const t = aTraiterPilotage(
      [
        bon(),
        bon({ bon_commande_parent_id: "p" }),
        bon({ taches: [validee] }),
        bon({ statut: "chiffre", montant: 471.5 }),
        bon({ statut: "chiffre", montant: 20, factures: [{}] }),
        bon({ statut: "cloture_gratuit", rappel_date: "2026-09-01" }),
        bon({ rappel_date: "2026-09-25" }),
      ],
      "2026-09-25"
    );
    expect(t).toMatchObject({ enAttenteConducteur: 2, aValiderDirecteur: 1, aFacturer: 1, rappels: 1 });
    expect(formatEuros(t.aFacturerMontant)).toBe("471,50\u00a0€");
  });

  it("le tableau suit le rôle effectif", () => {
    expect(genreDuTableau("technicien")).toBe("terrain");
    expect(genreDuTableau("sous_traitant")).toBe("terrain");
    expect(genreDuTableau("conducteur")).toBe("conducteur");
    expect(genreDuTableau("lecture")).toBe("pilotage");
    expect(genreDuTableau(null)).toBe("pilotage");
  });

  it("un paiement mène à la facture qu'il règle", () => {
    expect(lienActivite({ nature: "reglement", id: "r1", quand: "", client: null, numero: null, montant: null, facture_id: "f9" })).toBe("/factures/f9");
    expect(lienActivite({ nature: "rapport", id: "i1", quand: "", client: null, numero: null, montant: null, facture_id: null })).toBe("/rapports/i1");
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
  it("STA-20 : les tentatives sont un tableau, on les compte", () => {
    expect(nombreDeTentatives([{}, {}, {}])).toBe(3);
    expect(nombreDeTentatives("3")).toBe(0);
    expect(nombreDeTentatives(null)).toBe(0);
  });
});

describe("statistiques", () => {
  it("taux entiers, retard en complément, zéro sans dénominateur", () => {
    const base = { conducteur_id: "k", nom: "K", ht: montant(0), sav: 1, devis: 3, devis_acceptes: 1, devis_transformes: 2, bons_avec_travaux: 0, travaux: 0, travaux_ht: montant(0) };
    expect(tauxConducteur({ ...base, bons: 3, en_retard: 1 })).toMatchObject({ dansLesTemps: 2, tauxDansLesTemps: 67, tauxRetard: 33, tauxSav: 33, tauxDevisAcceptes: 33, tauxDevisTransformes: 67 });
    expect(tauxConducteur({ ...base, bons: 0, en_retard: 0 })).toMatchObject({ tauxDansLesTemps: 0, tauxRetard: 0, tauxSav: 0 });
  });
  it("équipes par ordre alphabétique, « Non attribué » en dernier, mois triés", () => {
    const t = tableauEquipes([
      { equipe_id: null, equipe: "Non attribué", mois: "2026-09-01", ht: montant(10) },
      { equipe_id: "z", equipe: "Zoé", mois: "2026-08-01", ht: montant(5) },
      { equipe_id: "a", equipe: "Équipe Thomas", mois: "2026-09-01", ht: montant(7) },
      { equipe_id: "a", equipe: "Équipe Thomas", mois: "2026-08-01", ht: montant(3) },
    ]);
    expect(t.mois).toEqual(["2026-08", "2026-09"]);
    expect(t.equipes.map((e) => e.nom)).toEqual(["Équipe Thomas", "Zoé", "Non attribué"]);
    expect(formatEuros(t.equipes[0]?.total ?? montant(0))).toBe("10,00\u00a0€");
  });
  it("la répartition ignore les montants nuls ou négatifs", () => {
    const r = repartition([{ ht: montant(300) }, { ht: montant(-50) }, { ht: montant(100) }]);
    expect(r.map((x) => x.part)).toEqual([75, 25]);
  });
});

describe("terrain", () => {
  it("aujourd'hui, les six jours suivants, à pointer, pièces — pour MON équipe seulement", () => {
    const cartes = construireCartes(
      [
        bonEssai({ id: "b1", date_planifiee: "2026-09-25", date_planifiee_fin: "2026-09-25", technicien: EQUIPE_A.nom }),
        bonEssai({ id: "b2", date_planifiee: "2026-09-28", date_planifiee_fin: "2026-09-28", technicien: EQUIPE_A.nom }),
        bonEssai({ id: "b3", date_planifiee: "2026-09-20", date_planifiee_fin: "2026-09-20", technicien: EQUIPE_A.nom }),
        bonEssai({ id: "b4", date_planifiee: "2026-09-25", date_planifiee_fin: "2026-09-25", technicien: "Équipe Karim" }),
      ],
      [tacheEssai({ id: "t3", bon_commande_id: "b3", date_tache: "2026-09-20", technicien_id: EQUIPE_A.id, piece_a_commander: true })],
      ANNUAIRES
    );
    const t = tableauTerrain(cartes, { monEquipeId: EQUIPE_A.id, monSousTraitantId: null }, "2026-09-25");
    expect(t.duJour.map((c) => c.bcId)).toEqual(["b1"]);
    expect(t.aVenir.map((c) => c.bcId)).toEqual(["b2"]);
    expect(t.aPointer.map((c) => c.bcId)).toEqual(["b3"]);
    expect(t.pieces.map((c) => c.bcId)).toEqual(["b3"]);
    expect(tableauTerrain(cartes, { monEquipeId: null, monSousTraitantId: null }, "2026-09-25").duJour).toEqual([]);
  });
});
