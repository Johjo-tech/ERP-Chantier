/**
 * Ce que l'écran dit pendant la lecture automatique d'un bon de commande.
 *
 * Le défaut que ces cas tiennent en échec : le 14/09/2026, la fonction edge a
 * été tuée à 150 s sans émettre de réponse HTTP. La promesse du navigateur ne
 * s'est jamais résolue, le `catch` n'a jamais été atteint, et « Lecture du
 * document en cours… » serait resté à l'écran indéfiniment — sans chronomètre,
 * sans délai maximal, sans moyen de renoncer et sans message d'erreur.
 *
 * `index.html` n'a aucun test : les seuils et les formulations vivent ici, et
 * c'est ici qu'ils sont éprouvés.
 */

import { describe, it, expect } from "vitest";
import {
  attenteAnnoncee,
  DELAI_BASCULE_ANALYSE_MS,
  DELAI_LECTURE_MS,
  DUREE_HABITUELLE_MS,
  ETAPES_LECTURE,
  etatAnnule,
  etatDelaiDepasse,
  etatEchec,
  etatLecture,
  formaterDuree,
  SEUIL_PLUS_LONG_QUE_DHABITUDE_MS,
} from "@/api/regles-ocr";

describe("Durées affichées", () => {
  it("compte en secondes en deçà de la minute", () => {
    expect(formaterDuree(0)).toBe("0 s");
    expect(formaterDuree(8_400)).toBe("8 s");
    expect(formaterDuree(59_999)).toBe("59 s");
  });

  it("passe aux minutes au-delà, sans perdre les secondes", () => {
    expect(formaterDuree(60_000)).toBe("1 min 00");
    expect(formaterDuree(65_000)).toBe("1 min 05");
    expect(formaterDuree(125_000)).toBe("2 min 05");
  });

  it("ne rend jamais de durée négative", () => {
    expect(formaterDuree(-4_000)).toBe("0 s");
  });

  it("annonce une attente que l'utilisateur peut anticiper", () => {
    expect(attenteAnnoncee()).toContain(formaterDuree(DUREE_HABITUELLE_MS));
  });
});

describe("Les étapes de la lecture", () => {
  it("nomme chaque étape, sans trou", () => {
    for (const etape of ETAPES_LECTURE) {
      const etat = etatLecture(etape, 0);
      expect(etat.libelle.length).toBeGreaterThan(0);
      expect(etat.enCours).toBe(true);
    }
  });

  /* Préparer et encoder sont deux opérations pour la machine, une seule pour
     l'utilisateur : il ne doit pas voir passer un vocabulaire d'informaticien. */
  it("ne distingue pas ce que l'utilisateur ne distingue pas", () => {
    expect(etatLecture("encodage", 0).libelle).toBe(etatLecture("preparation", 0).libelle);
  });

  it("reste calme tant que la durée est ordinaire", () => {
    const etat = etatLecture("analyse", DUREE_HABITUELLE_MS - 1_000);
    expect(etat.ton).toBe("neutre");
    expect(etat.alerte).toBeNull();
  });

  /* Long n'est pas cassé. On le dit, sans alarmer — c'est exactement ce que
     l'utilisateur cherchait à savoir : « faut-il attendre encore ? » */
  it("signale une attente inhabituelle sans crier à la panne", () => {
    const etat = etatLecture("analyse", SEUIL_PLUS_LONG_QUE_DHABITUDE_MS);
    expect(etat.ton).toBe("attention");
    expect(etat.alerte).toMatch(/plus long/i);
    expect(etat.enCours).toBe(true);
  });

  /* Ces évènements n'arrivent pas encore — la fonction répond en un bloc. Ils
     arriveront quand elle diffusera ses étapes ; l'écran, lui, sait déjà les
     formuler et n'aura pas à changer. */
  it("sait déjà nommer un réessai du serveur", () => {
    const etat = etatLecture("analyse", 20_000, [
      { type: "saturation", modele: "mistral-ocr-latest" },
    ]);
    expect(etat.alerte).toContain("mistral-ocr-latest");
    expect(etat.alerte).toMatch(/satur/i);
    expect(etat.ton).toBe("attention");
  });

  it("sait nommer une bascule de modèle", () => {
    const etat = etatLecture("analyse", 25_000, [
      { type: "bascule", modele: "mistral-medium-latest" },
    ]);
    expect(etat.alerte).toContain("mistral-medium-latest");
  });

  it("retient le dernier évènement, pas le premier", () => {
    const etat = etatLecture("analyse", 25_000, [
      { type: "saturation", modele: "mistral-ocr-latest" },
      { type: "bascule", modele: "mistral-medium-latest" },
    ]);
    expect(etat.alerte).toContain("mistral-medium-latest");
  });
});

describe("Les fins de lecture", () => {
  /* Trois issues, trois messages. Les confondre faisait passer un abandon
     volontaire pour une panne. */
  it("distingue un abandon d'une panne", () => {
    const annule = etatAnnule(5_000);
    expect(annule.enCours).toBe(false);
    expect(annule.ton).toBe("neutre");
    expect(annule.libelle).toContain("5 s");
    expect(annule.alerte).toMatch(/à la main/i);
  });

  it("dit clairement que le serveur n'a rien répondu", () => {
    const expire = etatDelaiDepasse(DELAI_LECTURE_MS);
    expect(expire.enCours).toBe(false);
    expect(expire.ton).toBe("erreur");
    expect(expire.libelle).toContain("2 min 00");
    expect(expire.alerte).toMatch(/réessayez|à la main/i);
  });

  it("rapporte le motif d'un échec plutôt qu'un message générique", () => {
    const echec = etatEchec("PDF trop volumineux (22 Mo, limite 14 Mo).");
    expect(echec.enCours).toBe(false);
    expect(echec.ton).toBe("erreur");
    expect(echec.alerte).toContain("22 Mo");
  });

  /* Aucune issue ne doit laisser l'écran en « lecture en cours » : c'est
     précisément l'état dans lequel le défaut du 14/09 laissait l'utilisateur. */
  it("aucune fin ne prétend que la lecture continue", () => {
    for (const etat of [etatAnnule(1), etatDelaiDepasse(1), etatEchec("peu importe")]) {
      expect(etat.enCours).toBe(false);
    }
  });
});

describe("Cohérence des délais", () => {
  /* En marche normale, c'est le message précis du serveur qui doit gagner : il
     sait combien de temps il a attendu et quels modèles il a essayés. Le délai
     du navigateur n'est qu'un filet pour le cas où il meurt sans rien dire. */
  it("le navigateur patiente plus longtemps que le budget du serveur", () => {
    const BUDGET_SERVEUR_MS = 110_000;
    expect(DELAI_LECTURE_MS).toBeGreaterThan(BUDGET_SERVEUR_MS);
  });

  it("rend la main avant la limite de la plateforme", () => {
    const TEMPS_MURAL_PLATEFORME_MS = 150_000;
    expect(DELAI_LECTURE_MS).toBeLessThan(TEMPS_MURAL_PLATEFORME_MS);
  });

  it("bascule sur « lecture » bien avant de trouver l'attente longue", () => {
    expect(DELAI_BASCULE_ANALYSE_MS).toBeLessThan(DUREE_HABITUELLE_MS);
    expect(DUREE_HABITUELLE_MS).toBeLessThanOrEqual(SEUIL_PLUS_LONG_QUE_DHABITUDE_MS);
  });
});
