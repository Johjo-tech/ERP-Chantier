/**
 * Règles de chiffrage et mise en forme de la pré-facture.
 *
 * Logique pure : ces tests construisent leurs dossiers à la main et n'atteignent
 * jamais la base. Ils décrivent ce que le directeur doit voir et ce qui doit
 * l'empêcher de valider — pas la mécanique interne.
 */

import { describe, it, expect } from "vitest";
import {
  blocagesChiffrage,
  blocagesValidationConducteur,
  lignesSansPrix,
  messageBlocages,
  peutValiderConducteur,
  tachesNonPointees,
  tachesNonValidees,
  travauxNonChiffres,
} from "@/api/regles-bc";
import {
  CHAPITRE_BON_COMMANDE,
  CHAPITRE_TRAVAUX_SUP,
  CLASSE_AJOUT,
  comptesRendusTerrain,
  lignesDocumentDirecteur,
} from "@/integrations/prefacture";

const TACHE_VALIDEE = { statut: "validee", libelle: "Plomberie — jour 1" };

/** Dossier complet : rien ne doit bloquer. */
function dossierComplet() {
  return {
    statutWorkflow: "en_cours",
    taches: [TACHE_VALIDEE],
    travaux: [{ statut: "chiffre", libelle: "Siphon" }],
    lignes: [{ type: "ligne", designation: "Réfection", prixUnitaire: 120 }],
  };
}

describe("Tâches en attente", () => {
  it("retient tout ce qui n'est pas validé", () => {
    const taches = [
      { statut: "validee" },
      { statut: "realisee" },
      { statut: "planifiee" },
      { statut: "refusee" },
    ];
    expect(tachesNonValidees(taches)).toHaveLength(3);
  });

  it("traite une tâche sans statut comme planifiée", () => {
    // Une tâche que personne n'a touchée ne peut pas valoir accord
    expect(tachesNonValidees([{ statut: null }])).toHaveLength(1);
  });
});

describe("Validation conducteur — toutes les tâches ou aucune", () => {
  /* Une affaire porte plusieurs métiers confiés à des équipes différentes :
     le sol un jour, la peinture un autre. C'est le cas de 43 bons en base. */
  const SOL = { statut: "realisee", metier: "SOL" };
  const PEINTURE_A_VENIR = { statut: "planifiee", metier: "PEINTURE" };

  it("laisse passer quand tous les métiers sont pointés", () => {
    expect(blocagesValidationConducteur([SOL, { statut: "realisee", metier: "PEINTURE" }])).toEqual([]);
  });

  it("bloque tant qu'un métier n'est pas pointé, et le nomme", () => {
    // Le défaut corrigé : la peinture était ignorée en silence
    const b = blocagesValidationConducteur([SOL, PEINTURE_A_VENIR]);
    expect(b.map((x) => x.code)).toEqual(["taches_non_pointees"]);
    expect(b[0].details).toEqual(["PEINTURE"]);
  });

  it("accepte une tâche déjà validée aux côtés d'une tâche pointée", () => {
    // Le conducteur arbitre au fil de l'eau : le sol validé hier ne rebloque pas
    expect(peutValiderConducteur([{ statut: "validee", metier: "SOL" }, SOL])).toBe(true);
  });

  it("bloque sur une tâche refusée : elle attend une reprise", () => {
    const b = blocagesValidationConducteur([SOL, { statut: "refusee", metier: "PEINTURE" }]);
    expect(b[0].code).toBe("taches_non_pointees");
  });

  it("bloque un métier annoncé sur le bon mais jamais planifié", () => {
    /* Le bon annonce PEINTURE+SOL, seule la peinture a été planifiée : le sol
       n'apparaît dans aucune tâche et serait passé inaperçu. */
    const b = blocagesValidationConducteur(
      [{ statut: "realisee", metier: "PEINTURE" }],
      ["PEINTURE", "SOL"]
    );
    expect(b.map((x) => x.code)).toEqual(["metiers_sans_tache"]);
    expect(b[0].details).toEqual(["SOL"]);
  });

  it("ne réclame rien quand chaque métier du bon a sa tâche", () => {
    expect(
      peutValiderConducteur(
        [
          { statut: "realisee", metier: "PEINTURE" },
          { statut: "validee", metier: "SOL" },
        ],
        ["PEINTURE", "SOL"]
      )
    ).toBe(true);
  });

  it("bloque une affaire sans aucune tâche", () => {
    // L'ancien garde-fou répondait « terminé » pour un bon vide
    expect(blocagesValidationConducteur([]).map((x) => x.code)).toEqual(["aucune_tache"]);
  });

  it("traite une tâche sans statut comme non pointée", () => {
    expect(tachesNonPointees([{ statut: null, metier: "SOL" }])).toHaveLength(1);
  });

  it("nomme par la date une tâche sans métier", () => {
    const b = blocagesValidationConducteur([{ statut: "planifiee", libelle: "Reprise" }]);
    expect(b[0].details).toEqual(["Reprise"]);
  });
});

describe("Travaux supplémentaires", () => {
  it("ne retient que ceux restés à chiffrer", () => {
    const travaux = [
      { statut: "a_chiffrer", libelle: "Siphon" },
      { statut: "chiffre", libelle: "Peinture" },
    ];
    expect(travauxNonChiffres(travaux).map((t) => t.libelle)).toEqual(["Siphon"]);
  });

  it("laisse passer un travail chiffré à 0 €", () => {
    // Le geste commercial est une décision, pas un oubli
    expect(travauxNonChiffres([{ statut: "chiffre" }])).toHaveLength(0);
  });
});

describe("Lignes sans prix", () => {
  it("ignore les chapitres et les commentaires", () => {
    const lignes = [
      { type: "chapitre", designation: "Plomberie" },
      { type: "commentaire", designation: "Support sain" },
    ];
    expect(lignesSansPrix(lignes)).toHaveLength(0);
  });

  it("retient une ligne à 0 € et une ligne sans prix du tout", () => {
    const lignes = [
      { type: "ligne", designation: "Reprise WC", prixUnitaire: 0 },
      { type: "ligne", designation: "Mise sous pression" },
      { type: "ligne", designation: "Facturable", prixUnitaire: 90 },
    ];
    expect(lignesSansPrix(lignes).map((l) => l.designation)).toEqual([
      "Reprise WC",
      "Mise sous pression",
    ]);
  });

  it("considère une ligne sans type comme une ligne", () => {
    expect(lignesSansPrix([{ designation: "Sans type" }])).toHaveLength(1);
  });
});

describe("Blocages de la validation directeur", () => {
  it("ne bloque rien sur un dossier complet", () => {
    expect(blocagesChiffrage(dossierComplet())).toEqual([]);
  });

  it("bloque un bon déjà facturé, et n'inspecte pas le reste", () => {
    // Le document est figé : signaler un prix manquant n'aiderait personne
    const b = blocagesChiffrage({
      ...dossierComplet(),
      statutWorkflow: "facture",
      lignes: [{ type: "ligne", designation: "Sans prix" }],
    });
    expect(b.map((x) => x.code)).toEqual(["deja_facture"]);
  });

  it("bloque un bon sans aucune tâche", () => {
    // La base laisse passer ce cas : aucune tâche restante, donc aucune en attente
    const b = blocagesChiffrage({ ...dossierComplet(), taches: [] });
    expect(b.map((x) => x.code)).toEqual(["aucune_tache"]);
  });

  it("bloque tant qu'une tâche n'est pas validée, et la nomme", () => {
    const b = blocagesChiffrage({
      ...dossierComplet(),
      taches: [TACHE_VALIDEE, { statut: "realisee", libelle: "Peinture — jour 2" }],
    });
    expect(b[0].code).toBe("taches_non_validees");
    expect(b[0].details).toEqual(["Peinture — jour 2"]);
  });

  it("nomme une tâche sans libellé par son métier", () => {
    const b = blocagesChiffrage({
      ...dossierComplet(),
      taches: [{ statut: "planifiee", metier: "PEINTURE" }],
    });
    expect(b[0].details).toEqual(["PEINTURE"]);
  });

  it("bloque sur un travail supplémentaire non chiffré", () => {
    const b = blocagesChiffrage({
      ...dossierComplet(),
      travaux: [{ statut: "a_chiffrer", libelle: "Siphon" }],
    });
    expect(b.map((x) => x.code)).toEqual(["travaux_non_chiffres"]);
  });

  it("cumule les blocages dans l'ordre où l'utilisateur doit les traiter", () => {
    const b = blocagesChiffrage({
      statutWorkflow: "en_cours",
      taches: [{ statut: "realisee", libelle: "Plomberie" }],
      travaux: [{ statut: "a_chiffrer", libelle: "Siphon" }],
      lignes: [{ type: "ligne", designation: "Reprise", prixUnitaire: 0 }],
    });
    expect(b.map((x) => x.code)).toEqual([
      "taches_non_validees",
      "travaux_non_chiffres",
      "lignes_sans_prix",
    ]);
  });
});

describe("Message de blocage", () => {
  it("nomme les désignations fautives, pas seulement leur nombre", () => {
    // « 3 tâche(s) » n'a jamais aidé personne à savoir lesquelles
    const message = messageBlocages(
      blocagesChiffrage({
        ...dossierComplet(),
        lignes: [{ type: "ligne", designation: "Mise sous pression" }],
      })
    );
    expect(message).toContain("Mise sous pression");
  });

  it("résume au-delà de cinq désignations", () => {
    const lignes = Array.from({ length: 8 }, (_, i) => ({
      type: "ligne",
      designation: `Ligne ${i}`,
    }));
    const message = messageBlocages(blocagesChiffrage({ ...dossierComplet(), lignes }));
    expect(message).toContain("et 3 autre(s)");
  });

  it("rend une chaîne vide quand rien ne bloque", () => {
    expect(messageBlocages([])).toBe("");
  });
});

describe("Document du directeur", () => {
  const LIGNES = [
    { type: "ligne", designation: "Réfection", prixUnitaire: 120, qte: 1 },
    { type: "ligne", designation: "Pose", prixUnitaire: 80, qte: 2 },
  ];

  it("laisse les lignes intactes en l'absence de travaux supplémentaires", () => {
    expect(lignesDocumentDirecteur(LIGNES, [])).toEqual(LIGNES);
  });

  it("encadre les lignes d'origine dans leur propre chapitre dès qu'il ajoute le sien", () => {
    /* Le rendu n'émet un sous-total qu'après un chapitre : sans ce premier
       chapitre, seules les travaux supplémentaires en auraient un, et ce
       montant intermédiaire isolé se lirait comme le total du document. */
    const doc = lignesDocumentDirecteur(LIGNES, [
      { libelle: "Siphon", origine: "technicien", prix_vente_ht: 85 },
    ]);
    expect(doc[0]).toMatchObject({ type: "chapitre", designation: CHAPITRE_BON_COMMANDE });
    expect(doc[3]).toMatchObject({ type: "chapitre", designation: CHAPITRE_TRAVAUX_SUP });
  });

  it("n'ouvre pas de chapitre « Bon de commande » quand le bon n'a aucune ligne", () => {
    const doc = lignesDocumentDirecteur([], [{ libelle: "Siphon", origine: "technicien" }]);
    expect(doc[0]).toMatchObject({ designation: CHAPITRE_TRAVAUX_SUP });
  });

  it("surligne les travaux supplémentaires et distingue leur origine", () => {
    const doc = lignesDocumentDirecteur([], [
      { libelle: "Siphon", origine: "technicien", prix_vente_ht: 85 },
      { libelle: "Peinture", origine: "conducteur", prix_vente_ht: 120 },
    ]);
    expect(doc[1].classe).toBe(CLASSE_AJOUT);
    expect(doc[1].badge).toBe("Ajouté — technicien");
    expect(doc[2].badge).toBe("Ajouté — conducteur");
  });

  it("reste lisible quand l'origine est inconnue", () => {
    const doc = lignesDocumentDirecteur([], [{ libelle: "Divers", origine: null }]);
    expect(doc[1].badge).toBe("Ajouté en cours de chantier");
  });

  it("applique les valeurs par défaut d'un travail non chiffré", () => {
    const doc = lignesDocumentDirecteur([], [{ libelle: "Siphon", statut: "a_chiffrer" }]);
    expect(doc[1]).toMatchObject({ qte: 1, unite: "u", prixUnitaire: 0 });
    expect(doc[1].tva).toBeGreaterThan(0);
  });

  it("respecte le taux de TVA de la société, pas un taux figé", () => {
    // Du neuf se facture à 20 %, de l'amélioration énergétique à 5,5 %
    expect(lignesDocumentDirecteur([], [{ libelle: "Siphon" }], 20)[1].tva).toBe(20);
    expect(lignesDocumentDirecteur([], [{ libelle: "Siphon" }], 5.5)[1].tva).toBe(5.5);
  });

  it("laisse le taux propre au travail primer sur le défaut", () => {
    expect(lignesDocumentDirecteur([], [{ libelle: "Siphon", tva: 10 }], 20)[1].tva).toBe(10);
  });

  it("produit une ligne repérable par la règle des prix manquants", () => {
    // Le document et le blocage doivent voir la même chose
    const doc = lignesDocumentDirecteur([], [{ libelle: "Siphon", statut: "a_chiffrer" }]);
    expect(lignesSansPrix(doc).map((l) => l.designation)).toEqual(["Siphon"]);
  });
});

describe("Comptes rendus du terrain", () => {
  it("garde toutes les tâches commentées, pas seulement la première", () => {
    // C'est le défaut de reconstituerWorkflow : `taches.find(t => t.commentaire)`
    const rendus = comptesRendusTerrain([
      { libelle: "Plomberie", commentaire: "Fuite au niveau du siphon" },
      { libelle: "Peinture", commentaire: "Reprise du plafond" },
    ]);
    expect(rendus.map((r) => r.libelle)).toEqual(["Plomberie", "Peinture"]);
  });

  it("écarte une tâche sans commentaire ni croquis", () => {
    expect(comptesRendusTerrain([{ libelle: "Rien à signaler" }])).toEqual([]);
  });

  it("écarte un commentaire qui n'est que des espaces", () => {
    expect(comptesRendusTerrain([{ commentaire: "   " }])).toEqual([]);
  });

  it("retient une tâche qui n'a qu'un croquis", () => {
    const rendus = comptesRendusTerrain([{ croquis: "data:image/png;base64,xxx" }]);
    expect(rendus).toHaveLength(1);
    expect(rendus[0].commentaire).toBe("");
  });

  it("assemble la plage horaire quand elle est renseignée", () => {
    const rendus = comptesRendusTerrain([
      { commentaire: "Fait", heure_debut: "08:00", heure_fin: "12:00" },
    ]);
    expect(rendus[0].heures).toBe("08:00 – 12:00");
  });

  it("ne fabrique pas de plage horaire quand aucune heure n'est saisie", () => {
    expect(comptesRendusTerrain([{ commentaire: "Fait" }])[0].heures).toBe("");
  });
});
