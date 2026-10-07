import { describe, expect, it } from "vitest";
import { formatEuros, montant, ZERO, type Montant } from "@/lib/money";
import { construireCartes } from "@/modules/planning/domain/cartes";
import { ANNUAIRES, bonEssai, EQUIPE_A, EQUIPE_B, ST_A, tacheEssai } from "@/modules/planning/domain/fabrique.essai-aide";
import { avancementDuBon, dateFinReelle, nombreDeTentatives, statsConducteur, type BonLu } from "./conducteur";
import { totalHtDesLignes } from "./lignes";
import { moisGlissants, premierDuMois, refusPlage } from "./periodes";
import { entierProche, htCompte, pourcentage, type DevisStats, type FactureStats, type ReglementStats, type SoldeStats } from "./pieces";
import { genreDuTableau, lienActivite } from "./pilotage";
import { indexSuivant, resultatsRecherche } from "./recherche";
import { dateDuBon, equipesParMois, filtrerParPeriode, moisLabelCourt, periodeLabel, repartitionCA, retardParConducteur, SANS_CONDUCTEUR, statsParConducteur, totauxStats, type BonStats, type DonneesStats } from "./statistiques";
import { activiteRecente, aTraiterPilotage, comparaisonN1, resumeDuMois, revenuPeriode, revenuPlage, topClients, tuilesPilotage, type BonPilotage } from "./tableau";
import { tableauTerrain } from "./terrain";

/**
 * Le domaine corrigé (D-STA-B-01) : chaque défaut de l'ancien calcul
 * (DEF-STA-xx) a ici le cas qui montre la valeur JUSTE ; la valeur fausse de
 * l'ancien, sur le même cas, est prouvée par `tests/parite/statistiques.essai.ts`.
 */

const JOUR = "2026-09-25";
const MAINTENANT = new Date("2026-09-25T10:00:00Z");
const m = (n: number | string) => montant(n);
const txt = (x: Montant | null | undefined) => (x ?? ZERO).toString();

function facture(s: Partial<Omit<FactureStats, "ht">> & { ht?: number } = {}): FactureStats {
  const { ht = 100, ...reste } = s;
  return {
    id: "f1", numero: "FAC-2026-000001", client_id: null, client_fiche: null, client_nom: "OPAC", date: JOUR, echeance: null, statut: "impayée", type_document: "facture",
    bon_commande_id: null, devis_id: null, conducteur_id: null, conducteur: null, cree_le: "2026-09-25T08:00:00Z", ht: m(ht), ...reste,
  };
}
function devis(s: Partial<Omit<DevisStats, "ht">> & { ht?: number } = {}): DevisStats {
  const { ht = 100, ...reste } = s;
  return { id: "d1", numero: "DEV-1", client_nom: "OPAC", date: JOUR, statut: "envoyé", conducteur_id: null, conducteur: null, cree_le: "2026-09-24T08:00:00Z", ht: m(ht), ...reste };
}
const reglement = (s: Partial<ReglementStats>): ReglementStats => ({ id: "r1", facture_id: "f1", montant: 100, mode: "virement", date: JOUR, cree_le: "2026-09-25T09:00:00Z", ...s });
const solde = (s: Partial<SoldeStats>): SoldeStats => ({ facture_id: "f1", cle: "non_reglee", sens: 1, ttc: 120, du: 120, en_retard: false, ...s });
const sixMois = moisGlissants(6, JOUR).map((x) => ({ year: x.annee, month: x.mois - 1 }));

describe("périodes", () => {
  it("les mois glissants franchissent l'année", () => {
    expect(moisGlissants(3, "2026-02-10").map((x) => x.cle)).toEqual(["2025-12", "2026-01", "2026-02"]);
  });
  it("plage libre : du premier du mois à aujourd'hui, et les refus de l'ancien", () => {
    expect(premierDuMois(JOUR)).toBe("2026-09-01");
    expect(refusPlage("", "2026-09-01")).toBe("Choisissez les deux dates.");
    expect(refusPlage("2026-09-02", "2026-09-01")).toBe("La date de début doit être avant la date de fin.");
    expect(refusPlage("2026-09-01", "2026-09-01")).toBeNull();
  });
});

describe("pièces et taux, en décimal exact", () => {
  it("HT compté : émise, hors acompte, avoir en négatif (le HT de la base est sans signe)", () => {
    expect(txt(htCompte(facture({ type_document: "avoir", ht: 50 })))).toBe("-50");
    expect(htCompte(facture({ numero: null, statut: "brouillon" }))).toBeNull();
    expect(htCompte(facture({ type_document: "acompte" }))).toBeNull();
    // Un brouillon qui porte déjà un numéro n'en est plus un, comme dans `v_facture_solde`.
    expect(txt(htCompte(facture({ statut: "brouillon" })))).toBe("100");
  });
  it("10,005 € s'écrit « 10,01 € » : arrondi décimal au centime, plus le flottant de l'ancien", () => {
    expect(formatEuros(totalHtDesLignes([{ type: "ligne", quantite: 3, prix_unitaire: 3.335, tva: 0 }]))).toBe("10,01 €");
  });
  it("les taux s'arrondissent comme `Math.round`, moitié vers +∞, sans bruit de flottant", () => {
    expect(pourcentage(1, 8)).toBe(13);
    expect(entierProche(m("-12.5"))).toBe(-12);
    expect(entierProche(m("-12.51"))).toBe(-13);
    expect(pourcentage(3, 0)).toBe(0);
  });
});

describe("pilotage (défauts de l'ancien corrigés)", () => {
  it("DEF-STA-01 / DEF-ECR-03 : ni brouillon ni acompte dans le chiffre d'affaires ; l'avoir en négatif", () => {
    const pieces = [facture({ id: "b", statut: "brouillon", numero: null, ht: 1000 }), facture({ id: "a", type_document: "acompte", ht: 300 }), facture({ id: "s", ht: 1000 }), facture({ id: "av", type_document: "avoir", ht: 200 })];
    expect(txt(revenuPeriode(pieces, sixMois, 2026).total)).toBe("800");
    expect(revenuPlage(pieces, "2026-09-01", JOUR)).toMatchObject({ nombre: 2 });
    expect(txt(revenuPlage(pieces, "2026-09-01", JOUR).total)).toBe("800");
    expect(txt(resumeDuMois(pieces, [], [], [], JOUR, sixMois).cumulAnnee)).toBe("800");
  });

  it("DEF-STA-02 : l'encaissé du mois est la somme des règlements datés du mois, TTC, hors lettrage", () => {
    const factures = [facture({ statut: "payée", date: "2026-08-30" }), facture({ id: "f2", statut: "payée" }), facture({ id: "av", type_document: "avoir" })];
    const reglements = [
      reglement({ id: "r1", facture_id: "f1", montant: 120 }), // facture du mois dernier, réglée ce mois-ci : compte
      reglement({ id: "r2", facture_id: "f2", montant: 60, date: "2026-08-02" }), // réglée le mois dernier : ne compte pas
      reglement({ id: "r3", facture_id: "f2", montant: 30, mode: "imputation" }), // moitié de lettrage
      reglement({ id: "r4", facture_id: "av", montant: 30, mode: "avoir" }),
      reglement({ id: "r5", facture_id: "f2", montant: 0.1 }),
      reglement({ id: "r6", facture_id: "f2", montant: 0.2 }),
    ];
    const r = resumeDuMois(factures, [], reglements, [], JOUR, sixMois);
    expect(txt(r.encaisseMois)).toBe("120.3");
    expect(r.encaisseMoisPct).toBe(100);
    expect(txt(r.encaisseMoisN1)).toBe("0");
  });

  it("DEF-STA-03 : restant dû et taux d'encaissement lus sur le solde de la base, brouillons exclus", () => {
    const soldes = [solde({ du: 120, ttc: 120 }), solde({ facture_id: "f2", cle: "brouillon", du: 0, ttc: 600 }), solde({ facture_id: "f3", cle: "reglee", du: 0, ttc: 360 }), solde({ facture_id: "av", cle: "disponible", sens: -1, du: 0, ttc: 60 })];
    const r = resumeDuMois([], [], [], soldes, JOUR, sixMois);
    expect(txt(r.impayeesMontant)).toBe("120");
    // 1 − 120 / (120 + 360 − 60) → 71 %.
    expect(r.tauxEncaisse).toBe(71);
  });

  it("DEF-STA-04 : impayées et échues sur le solde (ce qui doit encore), plus sur le statut stocké", () => {
    const soldes = [solde({ du: 50, en_retard: true }), solde({ facture_id: "f2", cle: "reglee", du: 0 }), solde({ facture_id: "f3", du: 10, en_retard: false })];
    expect(tuilesPilotage([], soldes).impayees).toBe(2);
    expect(aTraiterPilotage([], [], soldes, JOUR).facturesEchues).toBe(1);
  });

  it("DEF-STA-05 : un rappel ne compte que sur un bon encore ouvert", () => {
    const bon = (s: Partial<BonPilotage>): BonPilotage => ({ id: "b", statut_workflow: "en_cours", bon_commande_parent_id: null, rappel_date: null, valideConducteur: false, valideDirecteur: false, lignes: [], ...s });
    const t = aTraiterPilotage([bon({ id: "b1", statut_workflow: "cloture_gratuit", rappel_date: "2026-09-01" }), bon({ id: "b2", rappel_date: JOUR }), bon({ id: "b3", rappel_date: JOUR })], [facture({ bon_commande_id: "b3" })], [], JOUR);
    expect(t.rappelsAujourdhui).toBe(1);
  });

  it("« À facturer » : HT des lignes du bon, sans remise, en décimal ; un bon désigné par une facture n'y est plus", () => {
    const b: BonPilotage = { id: "b1", statut_workflow: "chiffre", bon_commande_parent_id: null, rappel_date: null, valideConducteur: true, valideDirecteur: true, lignes: [{ type: "ligne", quantite: 6, prix_unitaire: 78.5, tva: 10 }] };
    expect(txt(aTraiterPilotage([b], [], [], JOUR).aFacturerMontant)).toBe("471");
    expect(aTraiterPilotage([b], [facture({ bon_commande_id: "b1" })], [], JOUR).aFacturer).toBe(0);
  });

  it("DEF-STA-06 / DEF-ECR-04 : plus de « · null », et un lettrage d'avoir n'est pas un paiement reçu", () => {
    const brouillon = facture({ numero: null, statut: "brouillon", cree_le: "2026-09-25T09:00:00Z" });
    const avoir = facture({ id: "a1", numero: "AV-1", type_document: "avoir", date: "2026-09-26" });
    const a = activiteRecente(
      [devis({ numero: null })],
      [brouillon, avoir],
      [],
      [reglement({ id: "r1", facture_id: "f1", montant: 30, date: "2026-09-27" }), reglement({ id: "lettre", facture_id: "f1", montant: 20, mode: "imputation" }), reglement({ id: "credit", facture_id: "a1", montant: 20, mode: "avoir" })]
    );
    expect(a.map((x) => x.id)).toEqual(["r1", "a1", "d1", "f1"]);
    expect(a.map((x) => x.sous)).toEqual(["OPAC · brouillon", "OPAC · AV-1", "OPAC · brouillon", "OPAC · brouillon"]);
    expect(a.find((x) => x.id === "a1")).toMatchObject({ libelle: "Avoir", avoir: true });
    expect(txt(a.find((x) => x.id === "a1")?.montant)).toBe("-100");
    expect(lienActivite(a[0] ?? { nature: "reglement", id: "", factureId: null })).toBe("/factures/f1");
  });

  it("DEF-STA-07 : le classement groupe par la fiche client, le nom (sans casse ni blancs) à défaut ; borné à l'exercice, avec N-1", () => {
    const t = topClients(
      [
        facture({ client_id: "c1", client_fiche: "OPAC du Rhône", client_nom: "OPAC du Rhône" }),
        facture({ id: "f2", client_id: "c1", client_fiche: "OPAC du Rhône", client_nom: "OPAC du Rhone", ht: 300 }),
        facture({ id: "f0", client_id: "c1", client_fiche: "OPAC du Rhône", client_nom: "OPAC", date: "2025-03-01", ht: 50 }),
        facture({ id: "h1", client_nom: "Régie Sud" }),
        facture({ id: "h2", client_nom: " régie sud " }),
        facture({ id: "br", client_nom: "Brouillon SA", numero: null, statut: "brouillon", ht: 9999 }),
      ],
      2026
    );
    expect(t.map((c) => [c.client, c.nomSurLesPieces, txt(c.total), txt(c.precedent), c.largeur])).toEqual([
      ["OPAC du Rhône", "OPAC du Rhône", "400", "50", 100],
      ["Régie Sud", "Régie Sud", "200", "0", 50],
    ]);
    expect(comparaisonN1(m(100), m(50), 2025)).toMatchObject({ type: "ecart", ecart: 100 });
    expect(comparaisonN1(m(300), ZERO, 2025)).toEqual({ type: "rien", anneePrecedente: 2025 });
    expect(topClients([facture({ type_document: "avoir" }), facture({ id: "f2" })], 2026)).toEqual([]);
  });

  it("0f6f60d gardé : le facturé de l'exercice face au précédent, l'historique repris servant de N-1", () => {
    const r = resumeDuMois([facture(), facture({ id: "n1", date: "2025-09-03", ht: 40 }), facture({ id: "n1b", statut: "payée", date: "2025-09-04", ht: 7 }), facture({ id: "vieux", date: "2024-09-04", ht: 9 })], [], [], [], JOUR, sixMois);
    expect([r.annee, txt(r.cumulAnnee), txt(r.cumulAnneeN1)]).toEqual([2026, "100", "47"]);
  });

  it("le tableau suit le rôle effectif", () => {
    expect(genreDuTableau("technicien")).toBe("technicien");
    expect(genreDuTableau("sous_traitant")).toBe("sous_traitant");
    expect(genreDuTableau("conducteur")).toBe("conducteur");
    expect(genreDuTableau("lecture")).toBe("pilotage");
    expect(genreDuTableau(null)).toBe("pilotage");
  });
});

describe("statistiques (défauts de l'ancien corrigés)", () => {
  const bon = (s: Partial<BonStats>): BonStats => ({ id: "b", cree_le: "2026-09-02T08:00:00Z", date: "2026-09-02", date_reception: null, conducteur_id: "k1", conducteur: "Christophe", technicien: null, bon_commande_parent_id: null, date_fin_travaux: null, statut_workflow: "en_cours", ...s });
  const donnees = (s: Partial<DonneesStats>): DonneesStats => ({ bons: [], devis: [], factures: [], conducteurs: [{ id: "k1", nom: "Christophe" }], taches: [], travaux: [], ...s });

  it("DEF-STA-08 : par la référence — une autre graphie reste le même conducteur ; « Sans conducteur » a sa ligne", () => {
    const s = statsParConducteur(donnees({ bons: [bon({ id: "b1" }), bon({ id: "b2", conducteur: "christophe" }), bon({ id: "b3", conducteur_id: null, conducteur: null })], conducteurs: [{ id: "k1", nom: "Christophe" }, { id: "k2", nom: "Karim" }] }), "tout", JOUR, MAINTENANT);
    expect(s.map((x) => [x.cle, x.nom, x.bcTotal])).toEqual([["k1", "Christophe", 2], ["k2", "Karim", 0], ["", SANS_CONDUCTEUR, 1]]);
  });

  it("DEF-STA-09 : seul un bon encore ouvert est en retard (ni facturé, ni clos, ni tout pointé)", () => {
    const s = statsParConducteur(
      donnees({
        bons: [bon({ id: "fac", date_fin_travaux: "2026-09-01" }), bon({ id: "clos", date_fin_travaux: "2026-09-01", statut_workflow: "cloture_gratuit" }), bon({ id: "fait", date_fin_travaux: "2026-09-01" }), bon({ id: "ouvert", date_fin_travaux: "2026-09-01" })],
        factures: [facture({ bon_commande_id: "fac", conducteur_id: "k1" })],
        taches: [{ bon_commande_id: "fait", statut: "realisee" }, { bon_commande_id: "ouvert", statut: "planifiee" }],
      }),
      "tout",
      JOUR,
      MAINTENANT
    );
    expect(s[0]).toMatchObject({ bcTotal: 4, bcEnRetard: 1, tauxDansLesTemps: 75 });
    expect(txt(s[0]?.ca)).toBe("100");
  });

  it("DEF-STA-10 : sans bon, pas de barre (ni verte ni rouge)", () => {
    const s = statsParConducteur(donnees({ bons: [bon({})], conducteurs: [{ id: "k1", nom: "Christophe" }, { id: "k2", nom: "Karim" }] }), "tout", JOUR, MAINTENANT);
    expect(retardParConducteur(s)?.find((l) => l.stat.nom === "Karim")).toMatchObject({ pctOk: 0, pctRetard: 0 });
    expect(retardParConducteur(s)?.find((l) => l.stat.nom === "Christophe")).toMatchObject({ pctOk: 100, pctRetard: 0 });
  });

  it("DEF-STA-11 : travaux supplémentaires lus dans leur table — nombre hors refusés, montant des chiffrés", () => {
    const s = statsParConducteur(
      donnees({
        bons: [bon({ id: "b1" }), bon({ id: "b2" })],
        travaux: [
          { bon_commande_id: "b1", statut: "chiffre", quantite: 2, prix_vente_ht: 45.5 },
          { bon_commande_id: "b1", statut: "a_chiffrer", quantite: 1, prix_vente_ht: 999 },
          { bon_commande_id: "b1", statut: "integre", quantite: null, prix_vente_ht: "10" },
          { bon_commande_id: "b2", statut: "refuse", quantite: 1, prix_vente_ht: 50 },
        ],
      }),
      "tout",
      JOUR,
      MAINTENANT
    );
    expect(s[0]).toMatchObject({ nbTravSup: 3, tauxTravSup: 50 });
    expect(txt(s[0]?.montantTravSup)).toBe("101");
  });

  it("DEF-STA-17 : seuls les chiffres d'affaires positifs se répartissent — plus de part négative ni de total au-delà de 100 %", () => {
    const s = statsParConducteur(
      donnees({ conducteurs: [{ id: "k1", nom: "Karim" }, { id: "k2", nom: "Christophe" }], factures: [facture({ conducteur_id: "k1" }), facture({ id: "a1", type_document: "avoir", ht: 160, conducteur_id: "k2" })] }),
      "tout",
      JOUR,
      MAINTENANT
    );
    expect(repartitionCA(s)?.map((l) => [l.stat.nom, l.part])).toEqual([["Karim", 100]]);
    expect(repartitionCA(statsParConducteur(donnees({ factures: [facture({ type_document: "avoir", conducteur_id: "k1" })] }), "tout", JOUR, MAINTENANT))).toBeNull();
  });

  it("DEF-STA-18 : un bon se range par sa date de commande, pas par sa saisie", () => {
    const saisiAujourdhui = bon({ date: "2026-08-20", cree_le: "2026-09-25T08:00:00Z" });
    expect(totauxStats(donnees({ bons: [saisiAujourdhui] }), "mois", MAINTENANT).bons).toBe(0);
    expect(dateDuBon({ date: null, date_reception: "2026-08-01", cree_le: "2026-09-25T08:00:00Z" })).toBe("2026-08-01");
    expect(dateDuBon({ date: null, date_reception: null, cree_le: "2026-09-25T08:00:00Z" })).toBe("2026-09-25T08:00:00Z");
  });

  it("DEF-STA-01 aux statistiques : « Factures effectuées » et chiffre d'affaires sans brouillon ni acompte ; un brouillon ne transforme pas un devis", () => {
    const d = donnees({
      devis: [devis({ id: "d1", conducteur_id: "k1" }), devis({ id: "d2", conducteur_id: "k1" })],
      factures: [facture({ id: "br", numero: null, statut: "brouillon", devis_id: "d1", conducteur_id: "k1" }), facture({ id: "ac", type_document: "acompte", devis_id: "d2", conducteur_id: "k1" }), facture({ id: "ok", conducteur_id: "k1" })],
    });
    expect(totauxStats(d, "tout", MAINTENANT).factures).toBe(1);
    const s = statsParConducteur(d, "tout", JOUR, MAINTENANT);
    expect(s[0]).toMatchObject({ devisTotal: 2, devisTransformes: 1, tauxDevisTransforme: 50 });
    expect(txt(s[0]?.ca)).toBe("100");
  });

  it("période : horodatage lu à l'heure de Paris, date seule à minuit UTC", () => {
    const items = [{ d: "2026-08-31T22:30:00Z" }, { d: "2026-08-31" }, { d: null }];
    expect(filtrerParPeriode(items, (x) => x.d, "mois", MAINTENANT)).toEqual([{ d: "2026-08-31T22:30:00Z" }]);
    expect(periodeLabel("mois", JOUR, MAINTENANT)).toBe("Sep 2026");
    expect(periodeLabel("tout", JOUR, MAINTENANT)).toBe("tout l'historique");
    expect(moisLabelCourt("2026-08")).toBe("Août 2026");
  });

  it("équipes par la colonne `technicien` du bon (uuid ou libellé), « Non attribué » en dernier ; sans brouillon", () => {
    const t = equipesParMois(
      [facture({ bon_commande_id: "b1" }), facture({ id: "f2", bon_commande_id: "b2", date: "2026-08-10" }), facture({ id: "f3" }), facture({ id: "br", numero: null, statut: "brouillon", date: "2026-07-01" })],
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
  it("DEF-STA-13 : aujourd'hui, les six jours suivants, à pointer, pièces — sur les CARTES de mon équipe, journée supplémentaire comprise", () => {
    const cartes = construireCartes(
      [
        bonEssai({ id: "b1", date_planifiee: JOUR, date_planifiee_fin: JOUR, technicien: EQUIPE_A.nom }),
        bonEssai({ id: "b2", date_planifiee: "2026-09-28", date_planifiee_fin: "2026-09-28", technicien: EQUIPE_A.nom }),
        bonEssai({ id: "b3", date_planifiee: "2026-09-20", date_planifiee_fin: "2026-09-20", technicien: EQUIPE_A.nom }),
        bonEssai({ id: "b4", date_planifiee: JOUR, date_planifiee_fin: JOUR, technicien: EQUIPE_B.nom }),
        // Planifié hier pour une autre équipe, avec une journée supplémentaire AUJOURD'HUI confiée à la mienne.
        bonEssai({ id: "b5", date_planifiee: "2026-09-24", date_planifiee_fin: "2026-09-24", technicien: EQUIPE_B.nom }),
      ],
      [
        tacheEssai({ id: "t3", bon_commande_id: "b3", date_tache: "2026-09-20", technicien_id: EQUIPE_A.id, piece_a_commander: true }),
        tacheEssai({ id: "t5a", bon_commande_id: "b5", date_tache: "2026-09-24", technicien_id: EQUIPE_B.id, statut: "realisee" }),
        tacheEssai({ id: "t5b", bon_commande_id: "b5", date_tache: JOUR, technicien_id: EQUIPE_A.id }),
      ],
      ANNUAIRES
    );
    const t = tableauTerrain(cartes, { monEquipeId: EQUIPE_A.id, monSousTraitantId: null }, JOUR);
    expect(t.duJour.map((c) => c.bcId).sort()).toEqual(["b1", "b5"]);
    expect(t.aVenir.map((c) => c.bcId)).toEqual(["b2"]);
    expect(t.pieces.map((c) => c.bcId)).toEqual(["b3"]);
    expect(t.aPointer.map((c) => c.bcId)).toContain("b3");
  });

  it("DEF-STA-14 : le sous-traitant reçoit sa journée, par son entreprise", () => {
    const cartes = construireCartes(
      [bonEssai({ id: "b1", date_planifiee: JOUR, date_planifiee_fin: JOUR }), bonEssai({ id: "b2", date_planifiee: JOUR, date_planifiee_fin: JOUR })],
      [tacheEssai({ id: "t1", bon_commande_id: "b1", date_tache: JOUR, sous_traitant_id: ST_A.id })],
      ANNUAIRES
    );
    expect(tableauTerrain(cartes, { monEquipeId: null, monSousTraitantId: ST_A.id }, JOUR).duJour.map((c) => c.bcId)).toEqual(["b1"]);
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
  it("DEF-STA-12 : les tentatives se COMPTENT — trois appels sans rendez-vous font un injoignable", () => {
    expect(nombreDeTentatives([{}, {}, {}])).toBe(3);
    expect(nombreDeTentatives("3")).toBe(0);
    expect(nombreDeTentatives(null)).toBe(0);
    const b = avancementDuBon({ ...lu, date_planifiee: null, tentatives_contact: [{}, {}, {}] }, [], false);
    expect(statsConducteur([b], JOUR, 7).injoignables.map((x) => x.id)).toEqual(["b"]);
    const deux = avancementDuBon({ ...lu, date_planifiee: null, tentatives_contact: [{}, {}] }, [], false);
    expect(statsConducteur([deux], JOUR, 7).injoignables).toHaveLength(0);
  });
});
