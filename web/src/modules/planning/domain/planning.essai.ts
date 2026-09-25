import { describe, expect, it } from "vitest";
import { estFerie, joursFeries, lundiDe, libelleSemaine, indiceHeure, dansLaPlage } from "./calendrier";
import { construireCartes, datesSupplementaires, metiersDuBon, rendezVousDe, tacheDuJour, tachesHorsMetier, tentativesDuBon } from "./cartes";
import { ajouterTentative, lienTelephone, refusRappel, retirerTentative } from "./contacts";
import { cartesDuCalendrier, cartesDuJour, enAttente, FILTRES_VIDES, nonPlanifiees, semaineDuResultat } from "./filtres";
import {
  affectationConnue,
  MSG_DATE_EN_DOUBLE,
  MSG_INTERVENTION_FAITE,
  MSG_JOURNEE_POINTEE,
  planAffectation,
  planAjouterDate,
  planAvancer,
  planCreneau,
  planCreneauJournee,
  planDateFin,
  planDeplanifier,
  planPoser,
  planRetirerDate,
  questionDeplanifier,
  rdvAEcrire,
} from "./planification";
import { ANNUAIRES, bonEssai, EQUIPE_A, EQUIPE_B, ST_A, tacheEssai } from "./fabrique.essai-aide";

const AUCUN_TRAVAIL = new Set<string>();

describe("calendrier", () => {
  it("fériés d'Alsace-Moselle seulement sur demande (PLN-53)", () => {
    expect(joursFeries(2026)).not.toContain("2026-04-03");
    expect(joursFeries(2026, { alsaceMoselle: true })).toEqual(expect.arrayContaining(["2026-04-03", "2026-12-26"]));
    expect(estFerie("2026-05-14")).toBe(true); // Ascension 2026
    expect(estFerie("2026-05-15")).toBe(false);
  });
  it("semaines, heures, plages", () => {
    expect(lundiDe("2026-09-27")).toBe("2026-09-21");
    expect(libelleSemaine("2026-09-21")).toBe("21 sept. — 27 sept. 2026");
    expect(indiceHeure("10:30")).toBe(2);
    expect(indiceHeure("18:00")).toBe(0);
    expect(dansLaPlage("2026-09-23", "2026-09-21", "2026-09-24")).toBe(true);
    expect(dansLaPlage("2026-09-23", "2026-09-21", null)).toBe(false);
  });
});

describe("cartes (PLN-03, PLN-30)", () => {
  it("une carte par métier quand le bon en porte plusieurs, avec son propre rendez-vous", () => {
    const b = bonEssai({
      metiers: ["Peinture", "Sol"],
      schedule_par_metier: { Peinture: { datePlanifiee: "2026-09-21", heurePlanifiee: "10:00", dureeHeures: 2, technicien: "Équipe Karim" }, Sol: { sousTraitant: "Serge SARL" } },
      montant_par_metier: { Peinture: 300 },
    });
    const cartes = construireCartes([b], [], ANNUAIRES);
    expect(cartes.map((c) => c.id)).toEqual(["bc1::Peinture", "bc1::Sol"]);
    expect(cartes[0]?.rdv).toMatchObject({ datePlanifiee: "2026-09-21", heurePlanifiee: "10:00", dureeHeures: 2 });
    expect(cartes[0]?.equipeId).toBe("eqB");
    expect(cartes[0]?.montant).toBe(300);
    expect(cartes[1]?.montant).toBe(480);
    expect(cartes[1]?.sousTraitantId).toBe("stA");
    expect(cartes[1]?.positionLiee).toBe(2);
  });

  it("un bon mono-métier lit ses colonnes ; l'équipe s'accepte par nom ou par uuid", () => {
    const [c] = construireCartes([bonEssai({ date_planifiee: "2026-09-22", technicien: "eqA" })], [], ANNUAIRES);
    expect(c?.id).toBe("bc1");
    expect(c?.equipeId).toBe("eqA");
    expect(rendezVousDe(bonEssai({ technicien: "Équipe Thomas" }), null).technicien).toBe("Équipe Thomas");
  });

  it("un bon dont seul `metiers` porte le métier garde son métier (D-PLN-03)", () => {
    const [c] = construireCartes([bonEssai({ metier: null, metiers: ["Sol"] })], [], ANNUAIRES);
    expect(c?.metier).toBe("Sol");
    expect(metiersDuBon({ metier: null, metiers: ["Sol", 3, ""] })).toEqual(["Sol"]);
  });

  it("une tâche qu'aucun métier ne réclame est rattachée à la PREMIÈRE carte", () => {
    const b = bonEssai({ metiers: ["Peinture", "Sol"] });
    const orpheline = tacheEssai({ metier: "Plomberie" });
    const cartes = construireCartes([b], [tacheEssai({ metier: "Sol" }), orpheline], ANNUAIRES);
    expect(tachesHorsMetier(cartes[0]!).map((t) => t.id)).toEqual([orpheline.id]);
    expect(cartes[1]?.taches.map((t) => t.metier)).toEqual(["Sol"]);
  });

  it("journées supplémentaires dérivées des tâches ; aucune sans rendez-vous", () => {
    const t = [tacheEssai({ date_tache: "2026-09-21" }), tacheEssai({ date_tache: "2026-09-24", heure_debut: "13:00", heure_fin: "15:00", statut: "realisee" })];
    expect(datesSupplementaires(t, "2026-09-21")).toEqual([{ date: "2026-09-24", creneau: { heure: "13:00", duree: 2 }, fait: true }]);
    expect(datesSupplementaires(t, null)).toEqual([]);
  });

  it("une intervention faite, et sa date de fin lue sur les tâches (PLN-54)", () => {
    const b = bonEssai({ date_planifiee: "2026-09-21" });
    const [c] = construireCartes([b], [tacheEssai({ statut: "validee", realisee_le: "2026-09-21T16:00:00Z" })], ANNUAIRES);
    expect(c?.faite).toBe(true);
    expect(c?.termineeLe).toBe("2026-09-21T16:00:00Z");
    const [d] = construireCartes([b], [tacheEssai({ statut: "refusee", realisee_le: null })], ANNUAIRES);
    expect(d?.faite).toBe(false);
    expect(d?.termineeLe).toBeNull();
  });

  it("la tâche du jour, sinon la première du métier", () => {
    const t1 = tacheEssai({ date_tache: "2026-09-21" });
    const t2 = tacheEssai({ date_tache: "2026-09-24" });
    const [c] = construireCartes([bonEssai({ date_planifiee: "2026-09-21" })], [t1, t2], ANNUAIRES);
    expect(tacheDuJour(c!, "Plomberie", "2026-09-24")?.id).toBe(t2.id);
    expect(tacheDuJour(c!, "Plomberie", "2026-10-01")?.id).toBe(t1.id);
  });

  it("tentatives illisibles écartées", () => {
    expect(tentativesDuBon({ tentatives_contact: [{ id: 1, type: "appel", date: "2026-09-21", heure: "09:12" }, { type: "fax" }] })).toEqual([{ id: "1", type: "appel", date: "2026-09-21", heure: "09:12" }]);
  });
});

describe("filtres (PLN-02)", () => {
  const b1 = bonEssai({ id: "b1", client_nom: "OPAC du Rhône", date_planifiee: "2026-09-22", technicien: "Équipe Thomas" });
  const b2 = bonEssai({ id: "b2", client_nom: "Mme Durand", bon_commande_parent_id: "b1", conducteur: "Autre", logement_statut: "vacant" });
  const b3 = bonEssai({ id: "b3", client_nom: "Syndic Bellecour", statut_workflow: "facture" });
  const b4 = bonEssai({ id: "b4", client_nom: "Régie Sud", tentatives_contact: [{ id: "x", type: "sms", date: "2026-09-20", heure: "10:00" }] });
  const cartes = construireCartes([b1, b2, b3, b4], [tacheEssai({ bon_commande_id: "b4", sous_traitant_id: "stA", date_tache: null })], ANNUAIRES);

  it("non planifiés : SAV d'abord, circuit clos écarté (D-PLN-04), sous-traitant exclu de la vue technicien", () => {
    expect(nonPlanifiees(cartes, FILTRES_VIDES, "equipe").map((c) => c.bcId)).toEqual(["b2"]);
    expect(nonPlanifiees(cartes, FILTRES_VIDES, "sous_traitant").map((c) => c.bcId)).toEqual(["b2", "b4"]);
  });

  it("filtres conducteur, logement, « problème », client, recherche multi-mots sans accents", () => {
    expect(nonPlanifiees(cartes, { ...FILTRES_VIDES, conducteur: "Autre" }, "sous_traitant").map((c) => c.bcId)).toEqual(["b2"]);
    expect(nonPlanifiees(cartes, { ...FILTRES_VIDES, logement: "probleme" }, "sous_traitant").map((c) => c.bcId)).toEqual(["b4"]);
    expect(nonPlanifiees(cartes, { ...FILTRES_VIDES, logement: "vacant" }, "sous_traitant").map((c) => c.bcId)).toEqual(["b2"]);
    expect(nonPlanifiees(cartes, { ...FILTRES_VIDES, recherche: "regie sud" }, "sous_traitant").map((c) => c.bcId)).toEqual(["b4"]);
    expect(nonPlanifiees(cartes, { ...FILTRES_VIDES, client: "Mme Durand" }, "sous_traitant").map((c) => c.bcId)).toEqual(["b2"]);
  });

  it("calendrier par équipe, cartes du jour", () => {
    const cal = cartesDuCalendrier(cartes, { ...FILTRES_VIDES, affecte: "eqA" }, "equipe");
    expect(cal.map((c) => c.bcId)).toEqual(["b1"]);
    expect(cartesDuJour(cal, "2026-09-22").map((c) => c.bcId)).toEqual(["b1"]);
    expect(cartesDuJour(cal, "2026-09-23")).toEqual([]);
  });

  it("la recherche saute à la semaine du premier résultat hors écran", () => {
    expect(semaineDuResultat(cartes, "opac", "2026-11-02")).toBe("2026-09-21");
    expect(semaineDuResultat(cartes, "opac", "2026-09-14")).toBeNull();
    expect(semaineDuResultat(cartes, "", "2026-11-02")).toBeNull();
  });

  it("en attente : ni SAV ni circuit clos ; interne ou sous-traitant", () => {
    expect(enAttente(cartes, "equipe", "", () => null).map((c) => c.bcId)).toEqual(["b1"]);
    expect(enAttente(cartes, "sous_traitant", "", () => null).map((c) => c.bcId)).toEqual(["b4"]);
  });
});

describe("planification (PLN-04 à PLN-06, PLN-32, PLN-33)", () => {
  const annuaires = ANNUAIRES;

  it("poser une carte mono-métier : rendez-vous sur les colonnes, tâche créée avec son équipe et son créneau (D-PLN-02)", () => {
    const [c] = construireCartes([bonEssai()], [], annuaires);
    const plan = planPoser(c!, "2026-09-23", "10:00", { type: "equipe", equipe: EQUIPE_A });
    expect(plan.bon).toEqual({ date_planifiee: "2026-09-23", date_planifiee_fin: "2026-09-23", heure_planifiee: "10:00", duree_heures: 1, technicien: "Équipe Thomas" });
    expect(plan.taches).toEqual([
      { type: "creer", tache: expect.objectContaining({ bon_commande_id: "bc1", metier: "Plomberie", date_tache: "2026-09-23", technicien_id: "eqA", heure_debut: "10:00", heure_fin: "11:00", libelle: "CMD-1 — Plomberie" }) },
    ]);
  });

  it("poser une carte d'un bon multi-métiers écrit le réglage du métier sans effacer les autres clés", () => {
    const b = bonEssai({ metiers: ["Peinture", "Sol"], schedule_par_metier: { Sol: { datePlanifiee: "2026-09-25" }, Peinture: { note: "garder" } } });
    const cartes = construireCartes([b], [], annuaires);
    const plan = planPoser(cartes[0]!, "2026-09-23", "08:00", { type: "sous_traitant", sousTraitant: ST_A });
    expect(plan.bon).toEqual({
      schedule_par_metier: { Sol: { datePlanifiee: "2026-09-25" }, Peinture: { note: "garder", datePlanifiee: "2026-09-23", datePlanifieeFin: "2026-09-23", heurePlanifiee: "08:00", dureeHeures: 1, sousTraitant: "Serge SARL" } },
    });
    expect(plan.taches[0]).toMatchObject({ type: "creer", tache: { metier: "Peinture", sous_traitant_id: "stA" } });
  });

  it("déplacer une carte déplace sa journée au lieu d'en laisser une fantôme (D-PLN-08)", () => {
    const t = tacheEssai({ date_tache: "2026-09-21" });
    const [c] = construireCartes([bonEssai({ date_planifiee: "2026-09-21", technicien: "eqA" })], [t], annuaires);
    const plan = planPoser(c!, "2026-09-24", "09:00", null);
    expect(plan.taches).toEqual([{ type: "maj", id: t.id, champs: { technicien_id: "eqA", sous_traitant_id: null, date_tache: "2026-09-24", heure_debut: "09:00", heure_fin: "10:00" } }]);
  });

  it("une tâche dé-datée (pièce reçue) reprend le rendez-vous au lieu d'une jumelle", () => {
    const t = tacheEssai({ date_tache: null, commentaire: "fuite sous évier" });
    const [c] = construireCartes([bonEssai()], [t], annuaires);
    expect(planPoser(c!, "2026-09-24", "08:00", { type: "equipe", equipe: EQUIPE_A }).taches).toEqual([
      { type: "maj", id: t.id, champs: { technicien_id: "eqA", date_tache: "2026-09-24", heure_debut: "08:00", heure_fin: "09:00" } },
    ]);
  });

  it("une carte faite et datée ne se déplace pas ; sans date elle se pose (PLN-33)", () => {
    const faite = tacheEssai({ statut: "realisee" });
    const [datee] = construireCartes([bonEssai({ date_planifiee: "2026-09-21" })], [faite], annuaires);
    expect(() => planPoser(datee!, "2026-09-24", "08:00", null)).toThrow(MSG_INTERVENTION_FAITE);
    const [sansDate] = construireCartes([bonEssai()], [tacheEssai({ statut: "realisee", date_tache: null })], annuaires);
    // Faite (le métier est pointé) mais hors calendrier : la reposer n'est pas la déplacer.
    expect(sansDate?.faite).toBe(true);
    expect(() => planPoser(sansDate!, "2026-09-24", "08:00", null)).not.toThrow();
  });

  it("déplanifier : refus si faite (PLN-50) ou journée supplémentaire pointée ; sinon supprime les autres journées et dé-date l'origine", () => {
    const origine = tacheEssai({ date_tache: "2026-09-21" });
    const suppl = tacheEssai({ date_tache: "2026-09-23" });
    const [c] = construireCartes([bonEssai({ date_planifiee: "2026-09-21" })], [origine, suppl], annuaires);
    expect(questionDeplanifier(c!)).toMatch(/1 autre\(s\) date/);
    expect(planDeplanifier(c!, AUCUN_TRAVAIL)).toEqual({
      bon: { date_planifiee: null, date_planifiee_fin: null },
      taches: [{ type: "supprimer", id: suppl.id }, { type: "maj", id: origine.id, champs: { date_tache: null } }],
    });
    expect(() => planDeplanifier(c!, new Set([suppl.id]))).toThrow(/déjà été pointées/);
    const [faite] = construireCartes([bonEssai({ date_planifiee: "2026-09-21" })], [tacheEssai({ statut: "validee" })], annuaires);
    expect(() => planDeplanifier(faite!, AUCUN_TRAVAIL)).toThrow(MSG_INTERVENTION_FAITE);
    expect(() => planAvancer(faite!, AUCUN_TRAVAIL)).toThrow(MSG_INTERVENTION_FAITE);
  });

  it("« ← » défait d'abord l'étirement", () => {
    const [c] = construireCartes([bonEssai({ date_planifiee: "2026-09-21", date_planifiee_fin: "2026-09-23", heure_dernier_jour: "13:00" })], [], annuaires);
    expect(planAvancer(c!, AUCUN_TRAVAIL)).toEqual({ bon: { date_planifiee_fin: "2026-09-21", duree_dernier_jour: null, heure_dernier_jour: null }, taches: [] });
    expect(planDateFin(c!, "2026-09-10").bon).toEqual({ date_planifiee_fin: "2026-09-21" });
  });

  it("heure et durée (1 à 8 h) : la journée d'origine suit, sauf si elle est pointée (PLN-32)", () => {
    const t = tacheEssai({ date_tache: "2026-09-21" });
    const [c] = construireCartes([bonEssai({ date_planifiee: "2026-09-21", heure_planifiee: "08:00", duree_heures: 1 })], [t], annuaires);
    expect(planCreneau(c!, { duree: 12 })).toEqual({ bon: { duree_heures: 8 }, taches: [{ type: "maj", id: t.id, champs: { heure_debut: "08:00", heure_fin: "16:00" } }] });
    const [pointee] = construireCartes([bonEssai({ date_planifiee: "2026-09-21" })], [tacheEssai({ statut: "realisee" })], annuaires);
    expect(planCreneau(pointee!, { heure: "10:00" }).taches).toEqual([]);
  });

  it("changer d'équipe : sur le bon et sur toutes les tâches ; refusé si faite", () => {
    const t = tacheEssai({ technicien_id: "eqA" });
    const [c] = construireCartes([bonEssai({ date_planifiee: "2026-09-21" })], [t], annuaires);
    expect(planAffectation(c!, { type: "equipe", equipe: EQUIPE_B })).toEqual({ bon: { technicien: "Équipe Karim" }, taches: [{ type: "maj", id: t.id, champs: { technicien_id: "eqB" } }] });
    expect(planAffectation(c!, { type: "equipe", equipe: null }).bon).toEqual({ technicien: null });
    expect(affectationConnue(c!, "equipe", annuaires)).toEqual({ type: "equipe", equipe: EQUIPE_A });
  });

  it("journées supplémentaires : doublon refusé, création par métier, retrait refusé si pointée (PLN-06)", () => {
    const t = tacheEssai({ date_tache: "2026-09-21", technicien_id: "eqA" });
    const [c] = construireCartes([bonEssai({ date_planifiee: "2026-09-21" })], [t], annuaires);
    expect(() => planAjouterDate(c!, "2026-09-21", "08:00", 1)).toThrow(MSG_DATE_EN_DOUBLE);
    const plan = planAjouterDate(c!, "2026-09-25", "13:00", 3);
    expect(plan.taches).toEqual([{ type: "creer", tache: expect.objectContaining({ date_tache: "2026-09-25", technicien_id: "eqA", heure_debut: "13:00", heure_fin: "16:00" }) }]);

    const commentee = tacheEssai({ date_tache: "2026-09-25", commentaire: "vu" });
    const [d] = construireCartes([bonEssai({ date_planifiee: "2026-09-21" })], [t, commentee], annuaires);
    expect(() => planRetirerDate(d!, "2026-09-25", AUCUN_TRAVAIL)).toThrow(MSG_JOURNEE_POINTEE);
    const vierge = tacheEssai({ date_tache: "2026-09-26" });
    const [e] = construireCartes([bonEssai({ date_planifiee: "2026-09-21" })], [t, vierge], annuaires);
    expect(planRetirerDate(e!, "2026-09-26", AUCUN_TRAVAIL).taches).toEqual([{ type: "supprimer", id: vierge.id }]);
    expect(() => planRetirerDate(e!, "2026-09-26", new Set([vierge.id]))).toThrow(MSG_JOURNEE_POINTEE);
    expect(planCreneauJournee(e!, "2026-09-26", { duree: 2 }).taches).toEqual([{ type: "maj", id: vierge.id, champs: { heure_debut: "08:00", heure_fin: "10:00" } }]);
  });

  it("rdvAEcrire ignore le sous-traitant d'un bon mono-métier (il vit sur les tâches)", () => {
    expect(rdvAEcrire({ metierKey: null, bon: bonEssai() }, { sousTraitant: "Serge SARL" })).toBeNull();
  });
});

describe("contacts (PLN-07)", () => {
  it("tentatives, rappel, lien tel:", () => {
    const t = ajouterTentative([], "appel", "2026-09-21", "09:30", "id1");
    expect(t).toEqual([{ id: "id1", type: "appel", date: "2026-09-21", heure: "09:30" }]);
    expect(retirerTentative(t, "id1")).toEqual([]);
    expect(refusRappel("2026-09-20", "2026-09-21")).toMatch(/passée/);
    expect(refusRappel("2026-09-21", "2026-09-21")).toBeNull();
    expect(refusRappel("", "2026-09-21")).toMatch(/Choisissez/);
    expect(lienTelephone("06 12.34 56 78")).toBe("tel:0612345678");
    expect(lienTelephone("+33 6 12")).toBe("tel:+33612");
    expect(lienTelephone("  ")).toBeNull();
  });
});
