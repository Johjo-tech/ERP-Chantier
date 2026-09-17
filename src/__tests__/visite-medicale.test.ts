/**
 * Le suivi en santé au travail.
 *
 * Ces règles décident de deux choses qui doivent rester d'accord : la pastille
 * de l'écran RH et la notification de la cloche. Les faire diverger, ce serait
 * un salarié signalé à jour d'un côté et en retard de l'autre.
 *
 * Les plafonds sont ceux du code du travail depuis le décret 2016-1908 : 5 ans
 * en suivi simple (R.4624-16), 3 ans en adapté (R.4624-17), 4 ans en renforcé
 * avec une intermédiaire à 2 ans (R.4624-28). Les tests les fixent, parce que
 * s'en écarter ne se verrait nulle part ailleurs.
 */

import { describe, expect, it } from "vitest";
import {
  AVIS_APTITUDE,
  REGIMES_SUIVI,
  TYPES_VISITE,
  ajouterMois,
  avisAptitude,
  derniereVisite,
  depasseLePlafondLegal,
  echeanceEnCours,
  etatVisite,
  joursEntre,
  libelleAvis,
  prochaineVisiteSuggeree,
  regimeSuivi,
  trierVisites,
  typeVisite,
  type VisiteMedicale,
} from "@/api/regles-visite-medicale";

const AUJOURDHUI = "2026-09-17";

function visite(partiel: Partial<VisiteMedicale> = {}): VisiteMedicale {
  return {
    id: partiel.id ?? "v1",
    salarieId: partiel.salarieId ?? "s1",
    dateVisite: partiel.dateVisite ?? "2026-09-10",
    type: partiel.type ?? "periodique",
    suivi: partiel.suivi ?? "simple",
    ...partiel,
  };
}

describe("catalogues", () => {
  it("rend un code connu, et rabat l'inconnu sans le faire disparaître", () => {
    expect(typeVisite("reprise").libelle).toBe("Visite de reprise");
    expect(regimeSuivi("renforce").plafondMois).toBe(48);
    /* Un code retiré du catalogue ne doit pas escamoter la visite : sa pièce
       jointe resterait dans le bucket sans que personne puisse la retirer. */
    expect(typeVisite("visite-2019").code).toBe("periodique");
    expect(regimeSuivi(null).code).toBe("simple");
    expect(avisAptitude("apte_sous_conditions")?.libelle).toBe("apte_sous_conditions");
    expect(avisAptitude(null)).toBeNull();
  });

  it("porte les trois régimes et leurs plafonds légaux", () => {
    const parCode = Object.fromEntries(REGIMES_SUIVI.map((r) => [r.code, r]));
    expect(parCode.simple.plafondMois).toBe(60);
    expect(parCode.adapte.plafondMois).toBe(36);
    expect(parCode.renforce.plafondMois).toBe(48);
    expect(parCode.renforce.intermediaireMois).toBe(24);
    /* Seul le renforcé impose une visite intercalaire. */
    expect(parCode.simple.intermediaireMois).toBeUndefined();
    expect(parCode.adapte.intermediaireMois).toBeUndefined();
  });

  it("ne fait remettre le compteur à zéro qu'aux visites qui le méritent", () => {
    const parCode = Object.fromEntries(TYPES_VISITE.map((t) => [t.code, t]));
    /* La préreprise s'organise PENDANT l'arrêt, pour préparer le retour : elle
       ne vaut pas examen, et lui faire repousser l'échéance laisserait un
       salarié sans suivi réel. */
    expect(parCode.prereprise.reinitialiseLEcheance).toBe(false);
    expect(parCode.a_la_demande.reinitialiseLEcheance).toBe(false);
    expect(parCode.embauche.reinitialiseLEcheance).toBe(true);
    expect(parCode.reprise.reinitialiseLEcheance).toBe(true);
  });

  it("classe les avis par gravité, l'inaptitude n'étant pas une information", () => {
    const parCode = Object.fromEntries(AVIS_APTITUDE.map((a) => [a.code, a]));
    expect(parCode.apte.gravite).toBe("ok");
    expect(parCode.apte_amenagements.gravite).toBe("warn");
    expect(parCode.inapte.gravite).toBe("danger");
    expect(parCode.inapte_temporaire.gravite).toBe("danger");
    expect(libelleAvis(null)).toBe("Avis non renseigné");
  });
});

describe("joursEntre", () => {
  it("compte en jours calendaires", () => {
    expect(joursEntre("2026-09-17", "2026-09-18")).toBe(1);
    expect(joursEntre("2026-09-17", "2026-09-17")).toBe(0);
    expect(joursEntre("2026-09-17", "2026-09-10")).toBe(-7);
  });

  it("ne franchit pas la journée sur un changement d'heure", () => {
    /* Paris passe à l'heure d'hiver le 25 octobre 2026 : un calcul en heure
       locale rend 30,96 jours et arrondit à 31. */
    expect(joursEntre("2026-10-01", "2026-10-31")).toBe(30);
  });

  it("rend null sur une date absente ou illisible", () => {
    expect(joursEntre(AUJOURDHUI, null)).toBeNull();
    expect(joursEntre(AUJOURDHUI, "")).toBeNull();
    expect(joursEntre(AUJOURDHUI, "dans deux ans")).toBeNull();
  });
});

describe("ajouterMois", () => {
  it("avance de mois entiers", () => {
    expect(ajouterMois("2026-09-10", 24)).toBe("2028-09-10");
    expect(ajouterMois("2026-09-10", 60)).toBe("2031-09-10");
    expect(ajouterMois("2026-01-15", 1)).toBe("2026-02-15");
  });

  it("rabat sur le dernier jour du mois d'arrivée", () => {
    /* Sans ce rabat, le 31 mars + 1 mois donnerait le 1er mai et l'échéance
       dériverait d'un jour à chaque report. */
    expect(ajouterMois("2026-03-31", 1)).toBe("2026-04-30");
    expect(ajouterMois("2026-01-31", 1)).toBe("2026-02-28");
    expect(ajouterMois("2028-01-31", 1)).toBe("2028-02-29");
  });

  it("franchit l'année, et rend null sur une date illisible", () => {
    expect(ajouterMois("2026-11-05", 3)).toBe("2027-02-05");
    expect(ajouterMois("05/11/2026", 3)).toBeNull();
    expect(ajouterMois("", 12)).toBeNull();
  });
});

describe("prochaineVisiteSuggeree", () => {
  it("propose le plafond du régime en simple et en adapté", () => {
    expect(prochaineVisiteSuggeree("2026-09-10", "simple", "periodique")).toBe("2031-09-10");
    expect(prochaineVisiteSuggeree("2026-09-10", "adapte", "periodique")).toBe("2029-09-10");
  });

  it("propose l'intermédiaire, pas le plafond, en suivi renforcé", () => {
    /* En SIR l'examen du médecin tient quatre ans, mais une visite
       intermédiaire s'intercale à deux : c'est elle, le prochain rendez-vous
       dû. Porter 4 ans à l'agenda ferait manquer l'intercalaire. */
    expect(prochaineVisiteSuggeree("2026-09-10", "renforce", "periodique")).toBe("2028-09-10");
  });

  it("ne propose rien pour une visite qui ne remet aucun compteur à zéro", () => {
    expect(prochaineVisiteSuggeree("2026-09-10", "simple", "prereprise")).toBeNull();
    expect(prochaineVisiteSuggeree("2026-09-10", "simple", "a_la_demande")).toBeNull();
  });
});

describe("depasseLePlafondLegal", () => {
  it("tolère le plafond exact et refuse le jour d'après", () => {
    const pile = depasseLePlafondLegal("2026-09-10", "2030-09-10", "renforce");
    expect(pile.plafond).toBe("2030-09-10");
    expect(pile.depasse).toBe(false);

    expect(depasseLePlafondLegal("2026-09-10", "2030-09-11", "renforce").depasse).toBe(true);
  });

  it("n'avertit de rien quand l'échéance n'est pas renseignée", () => {
    expect(depasseLePlafondLegal("2026-09-10", null, "simple").depasse).toBe(false);
    expect(depasseLePlafondLegal("2026-09-10", "", "simple").depasse).toBe(false);
  });

  it("nomme la référence légale, pour que l'avertissement s'explique", () => {
    expect(depasseLePlafondLegal("2026-09-10", "2032-01-01", "simple").regime.reference)
      .toContain("R.4624-16");
  });
});

describe("etatVisite", () => {
  it("classe selon l'échéance et le seuil", () => {
    const seuil = 45;
    expect(etatVisite("2026-09-16", AUJOURDHUI, seuil).etat).toBe("depassee");
    expect(etatVisite("2026-11-01", AUJOURDHUI, seuil).etat).toBe("bientot");
    expect(etatVisite("2026-11-02", AUJOURDHUI, seuil).etat).toBe("aJour");
  });

  it("le jour même n'est pas encore dépassé", () => {
    /* C'est le piège `toISOString()` de tête de projet : une comparaison qui
       passe par l'heure locale déclare périmée, avant 1 h du matin, une
       échéance encore valable toute la journée. */
    const etat = etatVisite(AUJOURDHUI, AUJOURDHUI, 45);
    expect(etat.etat).toBe("bientot");
    expect(etat.jours).toBe(0);
  });

  it("distingue « pas d'échéance » de « à jour »", () => {
    /* Un salarié sans échéance connue n'est pas en règle : on ne sait pas s'il
       est suivi, ce qui pour l'inspection vaut manquement. */
    expect(etatVisite(null, AUJOURDHUI, 45).etat).toBe("inconnue");
    expect(etatVisite("", AUJOURDHUI, 45).etat).toBe("inconnue");
  });

  it("suit le seuil qu'on lui donne, pas un seuil écrit en dur", () => {
    expect(etatVisite("2026-10-20", AUJOURDHUI, 30).etat).toBe("aJour");
    expect(etatVisite("2026-10-20", AUJOURDHUI, 45).etat).toBe("bientot");
  });
});

describe("trierVisites et derniereVisite", () => {
  it("met la plus récente devant", () => {
    const ordre = trierVisites([
      visite({ id: "vieille", dateVisite: "2019-01-01" }),
      visite({ id: "recente", dateVisite: "2026-09-10" }),
      visite({ id: "moyenne", dateVisite: "2023-05-04" }),
    ]).map((v) => v.id);
    expect(ordre).toEqual(["recente", "moyenne", "vieille"]);
  });

  it("départage deux visites du même jour par l'ordre d'enregistrement", () => {
    /* La correction saisie en second est celle qui fait foi. */
    const derniere = derniereVisite([
      visite({ id: "saisie1", dateVisite: "2026-09-10", creeLe: "2026-09-10T08:00:00Z" }),
      visite({ id: "saisie2", dateVisite: "2026-09-10", creeLe: "2026-09-10T17:30:00Z" }),
    ]);
    expect(derniere?.id).toBe("saisie2");
  });

  it("rend l'échéance en cours, et rien sur un registre vide", () => {
    expect(
      echeanceEnCours([
        visite({ dateVisite: "2019-01-01", prochaineVisite: "2024-01-01" }),
        visite({ dateVisite: "2026-09-10", prochaineVisite: "2031-09-10" }),
      ])
    ).toBe("2031-09-10");
    expect(echeanceEnCours([])).toBeNull();
    /* Une dernière visite sans échéance saisie : pas d'échéance, pas de faux
       « à jour » hérité de la visite d'avant. */
    expect(echeanceEnCours([visite({ dateVisite: "2026-09-10" })])).toBeNull();
  });
});
