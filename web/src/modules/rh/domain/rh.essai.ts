import { describe, expect, it } from "vitest";
import { absenceEnCours, demandeJustificatif, schemaSaisieAbsence, soldeCpRestant } from "./conges";
import { aVerifier, conformiteRh, droitsRh, filtrerDossiers, motifIncomplet, resumeDossier } from "./conformite";
import { pastilleDocument, libelleDepuisNomFichier, type DocumentRh } from "./documents";
import { cheminPieceRh, cheminPieceSousTraitant } from "./fichiers";
import { comptesSousTraitantLiables, echeanceDocumentSousTraitant, membresDe, planConducteur, roleAProposer, sansEquipe, schemaSaisieEquipe, schemaSaisieSousTraitant } from "./intervenants";
import { choixPoste, filtrerSalaries, metiersDuFiltre, POSTE_AUTRE, registreDuPersonnel, schemaSaisieSalarie, valeursFormulaire, type Salarie } from "./salarie";
import { schemaSaisieVisite, visiteParDefaut } from "./visites";

const AUJ = "2026-09-25";
const SEUILS = { documentLegal: 30, visiteMedicale: 45, carteBtp: 60, habilitation: 60 };
const doc = (type: string, dateExpiration: string | null = null): DocumentRh => ({ id: `${type}-${dateExpiration}`, salarieId: "s1", type, dateExpiration });
const COMPLET = ["contrat", "dpae", "rib"].map((t) => doc(t)).concat([doc("pieceIdentite", "2030-01-01"), doc("carteBtp", "2030-01-01")]);

describe("conformité RH (RH-09)", () => {
  it("dossier complet et visite à jour : conforme", () => {
    const c = conformiteRh(COMPLET, "2027-06-01", AUJ, SEUILS);
    expect(c.complet).toBe(true);
    expect(resumeDossier(c)).toBeNull();
  });

  it("aucune échéance médicale connue vaut manquement, même dossier complet", () => {
    const c = conformiteRh(COMPLET, null, AUJ, SEUILS);
    expect(c.manqueMedical).toBe(true);
    expect(c.complet).toBe(false);
    expect(motifIncomplet(c)).toBe("Suivi médical");
    expect(resumeDossier(c)).toBe("1 manquant");
  });

  it("un document quelconque expiré rend le dossier incomplet sans rien « manquer »", () => {
    const c = conformiteRh([...COMPLET, doc("habilitation", "2026-01-01")], "2027-06-01", AUJ, SEUILS);
    expect(c.manquants).toEqual([]);
    expect(c.complet).toBe(false);
    expect(motifIncomplet(c)).toBe("Document expiré");
    expect(resumeDossier(c)).toBe("1 expiré");
  });

  it("la pastille d'une colonne est l'état le PIRE des documents du type", () => {
    const deux = [doc("carteBtp", "2030-01-01"), doc("carteBtp", "2026-01-01")];
    expect(pastilleDocument(deux, "carteBtp", AUJ, 30)).toBe("expire");
    expect(pastilleDocument([doc("carteBtp")], "carteBtp", AUJ, 30)).toBe("sansDate");
    expect(pastilleDocument([], "rib", AUJ, 30)).toBe("manquant");
    expect(pastilleDocument([doc("rib")], "rib", AUJ, 30)).toBe("ok");
  });

  it("filtres du tableau : incomplets, expirés, bientôt", () => {
    const lignes = [{ bilan: conformiteRh(COMPLET, "2027-06-01", AUJ, SEUILS) }, { bilan: conformiteRh([doc("contrat", "2026-10-01")], null, AUJ, SEUILS) }];
    expect(filtrerDossiers(lignes, "incomplets")).toHaveLength(1);
    expect(filtrerDossiers(lignes, "bientot")).toHaveLength(1);
    expect(filtrerDossiers(lignes, "expires")).toHaveLength(0);
    expect(filtrerDossiers(lignes, "")).toHaveLength(2);
  });
});

describe("« à vérifier » suit les seuils réglables (RH-10, D-RH-04)", () => {
  it("la carte BTP à 45 jours alerte sous le seuil de 60, pas sous l'ancien 30 codé en dur", () => {
    expect(aVerifier("2026-11-09", [], AUJ, SEUILS)).toEqual(["Carte BTP"]);
    expect(aVerifier("2026-11-09", [], AUJ, { ...SEUILS, carteBtp: 30 })).toEqual([]);
  });

  it("les habilitations proches ou expirées se comptent", () => {
    expect(aVerifier(null, [doc("habilitation", "2026-10-01"), doc("habilitation", "2029-01-01"), doc("contrat", "2026-10-01")], AUJ, SEUILS)).toEqual(["1 habilitation(s)"]);
  });
});

describe("congés (RH-08, RH-20)", () => {
  it("le solde retire les seuls congés payés", () => {
    expect(soldeCpRestant("25", [{ type: "Congé payé", nbJours: 5 }, { type: "Arrêt maladie", nbJours: 3 }])).toBe(20);
    expect(soldeCpRestant(null, [])).toBe(0);
  });

  it("une absence qui finit avant de commencer est refusée", () => {
    const r = schemaSaisieAbsence.safeParse({ type: "Congé payé", dateDebut: "2026-10-10", dateFin: "2026-10-01", commentaire: "" });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.message).toBe("La date de fin doit être après la date de début.");
  });

  it("les dates sont exigées, le commentaire vide part à null", () => {
    expect(schemaSaisieAbsence.safeParse({ type: "Congé payé", dateDebut: "", dateFin: "", commentaire: "" }).success).toBe(false);
    expect(schemaSaisieAbsence.parse({ type: "Congé payé", dateDebut: "2026-10-01", dateFin: "2026-10-01", commentaire: " " }).commentaire).toBeNull();
  });

  it("l'absence en cours est celle qui couvre aujourd'hui ; arrêt et accident appellent un justificatif", () => {
    expect(absenceEnCours([{ dateDebut: "2026-09-20", dateFin: "2026-09-30" }], AUJ)).not.toBeNull();
    expect(absenceEnCours([{ dateDebut: "2026-09-26", dateFin: "2026-09-30" }], AUJ)).toBeNull();
    expect(demandeJustificatif("Arrêt maladie")).toBe(true);
    expect(demandeJustificatif("Congé payé")).toBe(false);
  });
});

const salarie = (p: Partial<Salarie>): Salarie => ({
  id: "s1", nom: "Durand", prenom: "Paul", poste: null, email: null, telephone: null, dateEntree: null, dateSortie: null, typeContrat: null, carteBtpNumero: null, carteBtpValidite: null,
  visiteMedicaleDate: null, visiteMedicaleProchaine: null, technicienId: null, salaireMensuelNet: null, coutHoraireCharge: null, soldeCpInitial: null, dateNaissance: null, nationalite: null, sexe: null, actif: true, profileId: null, ...p,
});

describe("fiche salarié (RH-01, RH-03, RH-05)", () => {
  const REF = ["Plomberie", "Peinture"];

  it("un poste saisi à la main reste « Autre… » avec son texte : rouvrir la fiche ne le change pas", () => {
    expect(choixPoste("Chef d'équipe", REF)).toEqual({ choix: POSTE_AUTRE, libre: "Chef d'équipe" });
    expect(choixPoste("plomberie", REF)).toEqual({ choix: "Plomberie", libre: "" });
    const v = valeursFormulaire(salarie({ poste: "Chef d'équipe" }), REF);
    expect(schemaSaisieSalarie.parse(v).poste).toBe("Chef d'équipe");
  });

  it("le filtre métier : le référentiel d'abord, puis les postes hors référentiel", () => {
    expect(metiersDuFiltre(REF, [{ poste: "Apprenti" }, { poste: "plomberie" }, { poste: null }])).toEqual(["Plomberie", "Peinture", "Apprenti"]);
  });

  it("la recherche porte sur nom, prénom et poste, sans accents ni casse", () => {
    const liste = [salarie({ id: "a", nom: "Éric", poste: "Peinture" }), salarie({ id: "b", nom: "Zoé" })];
    expect(filtrerSalaries(liste, "eric pein", "").map((s) => s.id)).toEqual(["a"]);
    expect(filtrerSalaries(liste, "", "Peinture").map((s) => s.id)).toEqual(["a"]);
  });

  it("le registre suit l'ordre d'embauche, les fiches sans date à la fin", () => {
    const r = registreDuPersonnel([salarie({ id: "x" }), salarie({ id: "b", dateEntree: "2024-01-01" }), salarie({ id: "a", dateEntree: "2020-05-01" })]);
    expect(r.map((s) => s.id)).toEqual(["a", "b", "x"]);
  });

  it("montants à la française, au centime ; vides à null ; fin avant début refusée", () => {
    const base = valeursFormulaire(null, REF);
    const ok = schemaSaisieSalarie.parse({ ...base, nom: "X", coutHoraireCharge: "32,50", salaireMensuelNet: "1 850", soldeCpInitial: "" });
    expect(ok).toMatchObject({ coutHoraireCharge: 32.5, salaireMensuelNet: 1850, soldeCpInitial: null, email: null, dateNaissance: null });
    expect(schemaSaisieSalarie.safeParse({ ...base, nom: "X", coutHoraireCharge: "12abc" }).success).toBe(false);
    expect(schemaSaisieSalarie.safeParse({ ...base, nom: "X", dateEntree: "2026-05-01", dateSortie: "2026-04-01" }).success).toBe(false);
    expect(schemaSaisieSalarie.safeParse({ ...base, nom: " " }).success).toBe(false);
  });
});

describe("équipes, sous-traitants, fiche conducteur", () => {
  it("les membres sont les salariés ACTIFS rattachés ; les autres actifs sont « sans équipe »", () => {
    const l = [salarie({ id: "a", technicienId: "e1" }), salarie({ id: "b", technicienId: "e1", actif: false }), salarie({ id: "c" })];
    expect(membresDe(l, "e1").map((s) => s.id)).toEqual(["a"]);
    expect(sansEquipe(l).map((s) => s.id)).toEqual(["c"]);
  });

  it("une équipe exige un nom ; une couleur illisible retombe sur la couleur par défaut", () => {
    expect(schemaSaisieEquipe.safeParse({ nom: "", couleur: "#000000", metiers: [] }).success).toBe(false);
    expect(schemaSaisieEquipe.parse({ nom: "A", couleur: "rouge", metiers: [] }).couleur).toBe("#4F7CFF");
  });

  it("SIRET mal formé refusé, absent accepté (verifierEntite)", () => {
    const base = { nom: "ST", siret: "", siren: "", tvaIntracom: "", adresse: "", codePostal: "", ville: "", telephone: "", email: "", contactNom: "", contactEmail: "", contactProfileId: "", metiers: [] };
    expect(schemaSaisieSousTraitant.safeParse(base).success).toBe(true);
    const r = schemaSaisieSousTraitant.safeParse({ ...base, siret: "12345678901234" });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.path).toEqual(["siret"]);
  });

  it("compte relié (AUTH-44) : les membres sous-traitants libres, plus celui de la fiche", () => {
    const membres = [
      { profileId: "p1", nom: "Toit Plus", actif: true, role: "sous_traitant" as const },
      { profileId: "p2", nom: "Autre ST", actif: true, role: "sous_traitant" as const },
      { profileId: "p3", nom: "Tech", actif: true, role: "technicien" as const },
    ];
    const fiches = [{ id: "st1", contactProfileId: "p2" }, { id: "st2", contactProfileId: null }];
    expect(comptesSousTraitantLiables(membres, fiches, "st2").map((o) => o.valeur)).toEqual(["p1"]);
    expect(comptesSousTraitantLiables(membres, fiches, "st1").map((o) => o.valeur)).toEqual(["p1", "p2"]);
    expect(comptesSousTraitantLiables([], [{ id: "st1", contactProfileId: "p9" }], "st1")).toEqual([{ valeur: "p9", libelle: "Compte déjà rattaché" }]);
  });

  it("document de sous-traitant : alerte sous le seuil, rien sans date", () => {
    expect(echeanceDocumentSousTraitant("2026-10-05", AUJ, 30)).toEqual({ niveau: "bientot", jours: 10 });
    expect(echeanceDocumentSousTraitant("2026-09-01", AUJ, 30)?.niveau).toBe("expire");
    expect(echeanceDocumentSousTraitant(null, AUJ, 30)).toBeNull();
    expect(echeanceDocumentSousTraitant("2027-01-01", AUJ, 30)).toBeNull();
  });

  it("décocher « Conducteur » RETIRE la fiche (actif = false), jamais ne la supprime (RH-06)", () => {
    const fiche = { id: "c1", salarieId: "s1", profileId: null, email: null, telephone: null, actif: true };
    expect(planConducteur(salarie({}), fiche, false)).toEqual({ geste: "retirer", id: "c1" });
    expect(planConducteur(salarie({}), { ...fiche, actif: false }, false)).toEqual({ geste: "rien" });
    expect(planConducteur(salarie({}), null, false)).toEqual({ geste: "rien" });
  });

  it("cocher crée ou réactive la fiche, nom « Prénom Nom » et compte de la personne", () => {
    const plan = planConducteur(salarie({ profileId: "u9", email: "p@x.fr" }), null, true);
    expect(plan).toEqual({ geste: "ecrire", id: null, ligne: { nom: "Paul Durand", email: "p@x.fr", telephone: null, profile_id: "u9", salarie_id: "s1", actif: true } });
    const reactive = planConducteur(salarie({}), { id: "c1", salarieId: "s1", profileId: "u1", email: "old@x.fr", telephone: "06", actif: false }, true);
    expect(reactive).toMatchObject({ geste: "ecrire", id: "c1", ligne: { email: "old@x.fr", telephone: "06", profile_id: "u1", actif: true } });
  });

  it("le rôle conducteur se propose au compte qui ne l'a pas, jamais sans compte (AUTH-20)", () => {
    expect(roleAProposer(null, [])).toBeNull();
    expect(roleAProposer("u1", [{ profileId: "u1", role: "conducteur" }])).toBeNull();
    expect(roleAProposer("u1", [{ profileId: "u1", role: "admin" }])).toEqual({ profileId: "u1", roleActuel: "admin" });
    expect(roleAProposer("u1", [])).toEqual({ profileId: "u1", roleActuel: null });
  });
});

describe("droits, visites, rangement", () => {
  it("dossiers, coûts, équipes, sous-traitants, fiche conducteur : `rh / modifier` (D-RH-05 tranché par D-AUTH-05)", () => {
    const tout = () => true;
    const voirSeul = (a: string) => a === "voir";
    expect(droitsRh(tout, "admin")).toMatchObject({ sensible: true, intervenants: true, conducteur: true });
    // La proposition 20260926110000 ouvre équipes, sous-traitants et fiche conducteur à « rh » : la secrétaire les tient.
    expect(droitsRh(tout, "secretaire")).toMatchObject({ sensible: true, intervenants: true, conducteur: true });
    expect(droitsRh(voirSeul, "conducteur")).toMatchObject({ voir: true, sensible: false, intervenants: false });
  });

  it("la première visite est une embauche, l'échéance est proposée d'emblée", () => {
    expect(visiteParDefaut(null, "2026-09-25")).toMatchObject({ type: "embauche", suivi: "simple", prochaineVisite: "2031-09-25" });
    const suivante = visiteParDefaut({ id: "v", salarieId: "s", dateVisite: "2025-01-01", type: "embauche", suivi: "renforce", organisme: "AIST" }, "2026-09-25");
    expect(suivante).toMatchObject({ type: "periodique", suivi: "renforce", organisme: "AIST", prochaineVisite: "2028-09-25" });
  });

  it("une échéance antérieure à la visite est refusée par l'écran, pas seulement par la base", () => {
    const r = schemaSaisieVisite.safeParse({ ...visiteParDefaut(null, "2026-09-25"), prochaineVisite: "2026-01-01" });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.message).toBe("La prochaine visite ne peut pas précéder celle-ci.");
  });

  it("les pièces RH se rangent sous `<société>/salaries/` — la clé de la règle `rh / modifier`", () => {
    expect(cheminPieceRh("soc", "sal", "Contrat signé.pdf", 42)).toBe("soc/salaries/sal/42_Contrat-signe.pdf");
    expect(cheminPieceSousTraitant("soc", "st", "décennale.pdf", 1)).toBe("soc/sous-traitants/st/1_decennale.pdf");
    expect(libelleDepuisNomFichier("CACES_R486-cat-A.pdf")).toBe("CACES R486 cat A");
  });
});
