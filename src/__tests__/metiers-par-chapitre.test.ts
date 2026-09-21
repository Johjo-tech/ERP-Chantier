/**
 * Le métier lu sur les chapitres d'un bon de commande.
 *
 * Les cas viennent de la production, relevés le 14/09/2026 sur les 20 bons qui
 * portent des chapitres — y compris « PLOMBEIRE », faute de frappe réelle, et
 * deux chapitres qui ne désignent aucun métier. Rien n'est inventé ici : une
 * règle de reconnaissance ne vaut que par les libellés qu'elle rencontre.
 */

import { describe, it, expect } from "vitest";
import {
  DISTANCE_MAX,
  METIER_AUCUN,
  memeMetier,
  metierAffiche,
  metierDeLaLigne,
  metierDuChapitre,
  metiersDesChapitres,
  normaliserLibelle,
  referentielMetiers,
  tachesAcreer,
} from "@/api/regles-metiers";

/** Le référentiel réel de KTA Plomberie : déclarés, puis employés sur ses bons. */
const CONNUS = ["CARRELAGE", "PEINTURE", "SOL", "PLOMBERIE", "ETANCHEITE"];

describe("Comparaison de deux métiers", () => {
  /* La règle vivait à deux endroits et a divergé : `tacheDuBonCommande`
     traitait `null` et `""` comme un seul cas, `tachePourMetier` non. Une
     tâche au métier vide est devenue invalidable sur un bon qui déclarait
     PEINTURE et SOL — c'est le blocage de BC-2026-0866. */
  it("traite « pas de métier » comme un seul et même cas", () => {
    expect(memeMetier(null, "")).toBe(true);
    expect(memeMetier(undefined, null)).toBe(true);
    expect(memeMetier("", "   ")).toBe(true);
    expect(memeMetier("", "PEINTURE")).toBe(false);
  });

  it("ignore la casse et les accents", () => {
    // 49 bons portent « PLOMBERIE », 3 portent « Plomberie »
    expect(memeMetier("Plomberie", "PLOMBERIE")).toBe(true);
    expect(memeMetier("Étanchéité", "ETANCHEITE")).toBe(true);
  });

  it("ne confond pas deux métiers distincts", () => {
    expect(memeMetier("SOL", "SOLS ET MURS")).toBe(false);
    expect(memeMetier("PEINTURE", "PLOMBERIE")).toBe(false);
  });
});

describe("Normalisation d'un libellé", () => {
  it("retire accents et ponctuation, met en majuscules", () => {
    expect(normaliserLibelle("Étanchéité")).toBe("ETANCHEITE");
    expect(normaliserLibelle("  Peinture,  chambre 1 ")).toBe("PEINTURE CHAMBRE 1");
    expect(normaliserLibelle(null)).toBe("");
  });
});

describe("Le métier d'un chapitre", () => {
  const metier = (titre: string) => metierDuChapitre(titre, CONNUS)?.metier ?? null;
  const certitude = (titre: string) => metierDuChapitre(titre, CONNUS)?.certitude ?? null;

  it("reconnaît un chapitre qui ne porte que le métier", () => {
    expect(metier("SOL")).toBe("SOL");
    expect(metier("PEINTURE")).toBe("PEINTURE");
    expect(metier("PLOMBERIE")).toBe("PLOMBERIE");
    expect(certitude("SOL")).toBe("exact");
  });

  it("reconnaît le métier au milieu d'un intitulé de chantier", () => {
    expect(metier("SOL TOUT LE LOGEMENT")).toBe("SOL");
    expect(metier("PEINTURE TOUT LE LOGEMENT")).toBe("PEINTURE");
    expect(metier("SOL CHAMBRE 1")).toBe("SOL");
    expect(metier("PEINTURE LOGEMENT COMPLET")).toBe("PEINTURE");
    expect(metier("PEINTURE COMPLET DU LOGEMENT")).toBe("PEINTURE");
    expect(metier("PEINTURE CHAMBRE 1, CHAMBRE 2 ET CHAMBRE 3")).toBe("PEINTURE");
    expect(certitude("SOL CHAMBRE 1")).toBe("contenu");
  });

  /* Relevé tel quel en production : le chapitre d'un vrai bon de commande. */
  it("rattrape une faute de frappe", () => {
    expect(metier("PLOMBEIRE")).toBe("PLOMBERIE");
    expect(certitude("PLOMBEIRE")).toBe("approchant");
  });

  it("ignore un chapitre qui ne désigne aucun métier", () => {
    expect(metier("ARTICLE BPU")).toBeNull();
    expect(metier("LA C'EST UN AUTRE CHAPITRE")).toBeNull();
    expect(metier("Main d'œuvre")).toBeNull();
    expect(metier("")).toBeNull();
  });

  /* « SOL » est court : une recherche par sous-chaîne le trouverait partout. */
  it("ne reconnaît que des mots entiers", () => {
    expect(metier("ISOLATION DES COMBLES")).toBeNull();
    expect(metier("SOLDE DU MARCHE")).toBeNull();
    expect(metier("REPRISE PARQUET")).toBeNull();
  });

  it("accepte le pluriel", () => {
    expect(metier("SOLS ET PLINTHES")).toBe("SOL");
    expect(metier("PEINTURES INTERIEURES")).toBe("PEINTURE");
  });

  it("accepte les accents sur le chapitre comme sur le métier", () => {
    expect(metierDuChapitre("Étanchéité toiture", CONNUS)?.metier).toBe("ETANCHEITE");
  });

  /* Un chapitre ambigu ne vaut pas mieux qu'un chapitre muet : on ne choisit
     pas à la place de l'utilisateur. */
  it("renonce quand deux métiers conviennent également", () => {
    expect(metier("PEINTURE ET SOL")).toBeNull();
  });

  it("renonce quand le référentiel est vide", () => {
    expect(metierDuChapitre("PEINTURE", [])).toBeNull();
  });

  it("n'approche jamais un métier trop court pour ça", () => {
    // « SEL » est à 1 de « SOL », mais trois lettres ne prouvent rien.
    expect(metier("SEL")).toBeNull();
    expect(DISTANCE_MAX).toBe(2);
  });
});

describe("Les métiers d'un document", () => {
  const chapitre = (designation: string) => ({ type: "chapitre", designation });
  const ligne = (designation: string) => ({ type: "ligne", designation });

  it("lit les chapitres dans l'ordre, sans doublon", () => {
    const lu = metiersDesChapitres(
      [
        chapitre("PEINTURE TOUT LE LOGEMENT"),
        ligne("Murs et plafonds"),
        chapitre("SOL CHAMBRE 1"),
        ligne("Dépose ancien revêtement"),
        chapitre("SOL CHAMBRE 2"),
      ],
      CONNUS
    );

    expect(lu.metiers).toEqual(["PEINTURE", "SOL"]);
    expect(lu.origines).toEqual({
      PEINTURE: "PEINTURE TOUT LE LOGEMENT",
      SOL: "SOL CHAMBRE 1",
    });
    expect(lu.ignores).toEqual([]);
  });

  it("met de côté les chapitres qui ne sont pas des métiers", () => {
    const lu = metiersDesChapitres(
      [chapitre("ARTICLE BPU"), chapitre("PLOMBEIRE"), chapitre("LA C'EST UN AUTRE CHAPITRE")],
      CONNUS
    );

    expect(lu.metiers).toEqual(["PLOMBERIE"]);
    expect(lu.ignores).toEqual(["ARTICLE BPU", "LA C'EST UN AUTRE CHAPITRE"]);
  });

  /* Une désignation de ligne suggérerait un métier bien plus souvent qu'elle
     ne le désignerait : seuls les chapitres sont lus. */
  it("ne lit jamais les lignes ordinaires", () => {
    const lu = metiersDesChapitres([ligne("PEINTURE des murs"), { designation: "SOL" }], CONNUS);
    expect(lu.metiers).toEqual([]);
  });

  it("ne renvoie rien sur un document sans chapitre", () => {
    expect(metiersDesChapitres([], CONNUS).metiers).toEqual([]);
    expect(metiersDesChapitres(null, CONNUS).metiers).toEqual([]);
  });
});

describe("Quelles tâches restent à créer", () => {
  const posee = (date: string, metier: string | null) => ({ date_tache: date, metier });

  /* La régression de BC-2026-0866 : trois enregistrements du même bon, le même
     jour, deux métiers — sept tâches là où trois suffisaient, et cinq d'entre
     elles non validées bloquaient le passage au chiffrage. */
  it("ne recrée rien quand le jour et le métier ont déjà leur tâche", () => {
    const posees = [posee("2026-09-14", "PEINTURE"), posee("2026-09-14", "SOL")];
    expect(tachesAcreer(posees, ["2026-09-14"], ["PEINTURE", "SOL"])).toEqual([]);
  });

  it("crée la tâche du métier qui manque, et lui seul", () => {
    const posees = [posee("2026-09-14", "PEINTURE")];
    expect(tachesAcreer(posees, ["2026-09-14"], ["PEINTURE", "SOL"])).toEqual([
      { date: "2026-09-14", metier: "SOL" },
    ]);
  });

  it("distingue deux journées du même métier", () => {
    const posees = [posee("2026-09-14", "PEINTURE")];
    expect(tachesAcreer(posees, ["2026-09-16"], ["PEINTURE"])).toEqual([
      { date: "2026-09-16", metier: "PEINTURE" },
    ]);
  });

  it("traite « pas de métier » comme une valeur, pas comme une absence", () => {
    expect(tachesAcreer([posee("2026-09-14", "")], ["2026-09-14"], [null])).toEqual([]);
    expect(tachesAcreer([posee("2026-09-14", null)], ["2026-09-14"], [""])).toEqual([]);
  });

  it("ignore la casse, comme partout ailleurs", () => {
    expect(tachesAcreer([posee("2026-09-14", "Plomberie")], ["2026-09-14"], ["PLOMBERIE"]))
      .toEqual([]);
  });

  it("ne crée qu'une tâche si la même date est listée deux fois", () => {
    expect(tachesAcreer([], ["2026-09-16", "2026-09-16"], ["SOL"])).toEqual([
      { date: "2026-09-16", metier: "SOL" },
    ]);
  });

  it("écarte les dates vides", () => {
    expect(tachesAcreer([], ["", null, "   "], ["SOL"])).toEqual([]);
  });
});

describe("Référentiel des métiers d'une société", () => {
  /* KTA ne déclare que trois métiers, mais ses bons en portent cinq :
     PLOMBERIE (49 bons) et ETANCHEITE (47) n'étaient plus proposés à la
     saisie, donc impossibles à recocher. */
  it("réunit les métiers déclarés et ceux déjà employés", () => {
    expect(referentielMetiers(["CARRELAGE", "PEINTURE", "SOL"], ["PLOMBERIE", "ETANCHEITE", "SOL"]))
      .toEqual(["CARRELAGE", "ETANCHEITE", "PEINTURE", "PLOMBERIE", "SOL"]);
  });

  it("ne garde qu'une orthographe, celle du référentiel déclaré", () => {
    expect(referentielMetiers(["PLOMBERIE"], ["Plomberie", "plomberie"])).toEqual(["PLOMBERIE"]);
  });

  it("écarte les entrées vides", () => {
    expect(referentielMetiers(["PEINTURE", "", null, "   "], [undefined])).toEqual(["PEINTURE"]);
  });
});

describe("Le métier tranché sur un chapitre", () => {
  /* Un chapitre « SALLE DE BAIN » ne désigne aucun métier connu : la
     reconnaissance ne pouvait rien en dire, et rien ne permettait de le
     corriger. C'est ce trou que le choix explicite vient combler. */
  it("l'emporte sur ce que dit le titre", () => {
    const lu = metierDeLaLigne(
      { type: "chapitre", designation: "PEINTURE SEJOUR", metier: "PLOMBERIE" },
      CONNUS
    );
    expect(lu).toEqual({
      metier: "PLOMBERIE",
      certitude: "choisi",
      chapitre: "PEINTURE SEJOUR",
    });
  });

  it("nomme un métier que le titre ne désignait pas", () => {
    expect(metierDuChapitre("SALLE DE BAIN", CONNUS)).toBeNull();
    expect(metierDeLaLigne({ designation: "SALLE DE BAIN", metier: "PLOMBERIE" }, CONNUS)?.metier)
      .toBe("PLOMBERIE");
  });

  /* Un métier retiré des Réglages ne doit pas disparaître d'un vieux document :
     c'est la même raison qui fait que `referentielMetiers` compte les métiers
     employés autant que les métiers déclarés. */
  it("est honoré même s'il ne figure plus au référentiel", () => {
    expect(metierDeLaLigne({ designation: "DIVERS", metier: "MENUISERIE" }, CONNUS)?.metier)
      .toBe("MENUISERIE");
  });

  it("refuse tout métier quand on a choisi « aucun »", () => {
    expect(metierDeLaLigne({ designation: "PEINTURE SEJOUR", metier: METIER_AUCUN }, CONNUS))
      .toBeNull();
  });

  /* L'app historique écrit `""` pour « non renseigné », et un aller-retour en
     base peut rendre `null`. Si l'un des trois valait refus, tout chapitre
     jamais tranché cesserait d'être lu — les 830 bons d'un coup. */
  it("déduit encore quand rien n'a été tranché, sous ses trois formes", () => {
    for (const vide of ["", null, undefined]) {
      expect(metierDeLaLigne({ designation: "PEINTURE SEJOUR", metier: vide }, CONNUS)?.metier)
        .toBe("PEINTURE");
    }
  });

  it("ne lit pas le métier posé sur une ligne ordinaire", () => {
    const lignes = [{ type: "ligne", designation: "Remplacement siphon", metier: "PLOMBERIE" }];
    expect(metiersDesChapitres(lignes, CONNUS).metiers).toEqual([]);
  });

  it("survit à un titre retapé — un choix ne se défait qu'explicitement", () => {
    const ligne = { type: "chapitre", designation: "PEINTURE SEJOUR", metier: "PLOMBERIE" };
    ligne.designation = "CARRELAGE CUISINE";
    expect(metierDeLaLigne(ligne, CONNUS)?.metier).toBe("PLOMBERIE");
  });

  it("compte dès qu'il est choisi, avant même que le chapitre ait un titre", () => {
    const lus = metiersDesChapitres([{ type: "chapitre", designation: "", metier: "SOL" }], CONNUS);
    expect(lus.metiers).toEqual(["SOL"]);
    // Rien à montrer comme origine : ce métier n'a pas été lu, il a été choisi.
    expect(lus.origines).toEqual({});
  });

  it("laisse un chapitre refusé parmi les ignorés", () => {
    const lus = metiersDesChapitres(
      [{ type: "chapitre", designation: "PEINTURE SEJOUR", metier: METIER_AUCUN }],
      CONNUS
    );
    expect(lus.metiers).toEqual([]);
    expect(lus.ignores).toEqual(["PEINTURE SEJOUR"]);
  });
});

describe("Ce qu'affiche la liste déroulante d'un chapitre", () => {
  it("montre la déduction en la disant devinée", () => {
    expect(metierAffiche({ designation: "PEINTURE SEJOUR" }, CONNUS)).toEqual({
      valeur: "PEINTURE",
      devine: true,
      certitude: "contenu",
    });
  });

  it("montre le choix en le disant tranché", () => {
    expect(metierAffiche({ designation: "PEINTURE SEJOUR", metier: "SOL" }, CONNUS)).toEqual({
      valeur: "SOL",
      devine: false,
      certitude: "choisi",
    });
  });

  /* Sans quoi le refus paraîtrait s'être effacé tout seul : la liste
     retomberait sur « — Déduit du titre — » et la déduction semblerait reprise. */
  it("garde « aucun » sélectionné quand on a refusé", () => {
    expect(metierAffiche({ designation: "PEINTURE SEJOUR", metier: METIER_AUCUN }, CONNUS)).toEqual({
      valeur: METIER_AUCUN,
      devine: false,
      certitude: null,
    });
  });

  it("ne propose rien sur un titre qui ne dit rien", () => {
    expect(metierAffiche({ designation: "SALLE DE BAIN" }, CONNUS)).toEqual({
      valeur: "",
      devine: true,
      certitude: null,
    });
  });

  it("signale une reconnaissance approchante, la plus permissive des trois", () => {
    expect(metierAffiche({ designation: "PLOMBEIRE" }, CONNUS).certitude).toBe("approchant");
  });
});
