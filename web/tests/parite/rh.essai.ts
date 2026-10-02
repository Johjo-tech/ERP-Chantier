/**
 * Parité RH, contre l'ancien code pris TEL QUEL :
 *  - `src/api/regles-documents-rh.ts` (dossier, états, tri, libellés) ;
 *  - `src/api/regles-visite-medicale.ts` (régimes, échéances, plafonds) ;
 *  - `nbJoursOuvres`, `soldeCPRestant`, `technicienLabel` d'`app.js`, dont la
 *    SOURCE est extraite (le monolithe ne s'importe pas).
 */
import { describe, expect, it } from "vitest";
import * as ancienDocs from "../../../src/api/regles-documents-rh";
import * as ancienVisites from "../../../src/api/regles-visite-medicale";
import { nbJoursOuvres, soldeCpRestant } from "../../src/modules/rh/domain/conges";
import * as docs from "../../src/modules/rh/domain/documents";
import { libelleEquipe } from "../../src/modules/rh/domain/intervenants";
import * as visites from "../../src/modules/rh/domain/visites";
import { generateur } from "./aleatoire";
import { sourceDe } from "./source-app";

const g = generateur(26092606);
const TIRAGES = 2000;

const pad = (n: number) => String(n).padStart(2, "0");
const dateAleatoire = () => `${g.entier(2024, 2028)}-${pad(g.entier(1, 12))}-${pad(g.entier(1, 31))}`.replace(/-(3[01]|29)$/, (m) => (g.reel() < 0.5 ? m : "-28"));
const dateOuVide = () => g.parmi([null, undefined, "", "abîmé", dateAleatoire(), dateAleatoire(), dateAleatoire()]);
const CODES_DOC = [...docs.TYPES_DOCUMENT_RH.map((t) => t.code), "inconnu", "", " contrat "];

function documentAleatoire(i: number) {
  return {
    id: `d${i}`,
    salarieId: "s1",
    type: g.parmi(CODES_DOC),
    nom: g.parmi([null, "", "  ", "Contrat signé", "Zèbre"]),
    fichierNom: g.parmi([null, "", "scan.pdf"]),
    dateExpiration: dateOuVide(),
  };
}

describe("parité du dossier documentaire (RH-04, RH-09)", () => {
  it(`${TIRAGES} dossiers : même bilan, mêmes états, même tri`, () => {
    for (let i = 0; i < TIRAGES; i++) {
      const liste = Array.from({ length: g.entier(0, 8) }, (_, k) => documentAleatoire(k));
      const jour = dateAleatoire();
      const seuil = g.entier(0, 90);
      expect(docs.dossierSalarie(liste, jour, seuil), JSON.stringify({ liste, jour, seuil })).toEqual(ancienDocs.dossierSalarie(liste, jour, seuil));
      expect(docs.trierDocumentsRh(liste).map((d) => d.id)).toEqual(ancienDocs.trierDocumentsRh(liste).map((d) => d.id));
      for (const d of liste) {
        expect(docs.etatDocumentRh(d, jour, seuil)).toEqual(ancienDocs.etatDocumentRh(d, jour, seuil));
        expect(docs.libelleDocumentRh(d)).toBe(ancienDocs.libelleDocumentRh(d));
        expect(docs.typeDocumentRh(d.type)).toEqual(ancienDocs.typeDocumentRh(d.type));
      }
    }
  });

  it("le catalogue des types est le même", () => {
    expect(docs.TYPES_DOCUMENT_RH).toEqual(ancienDocs.TYPES_DOCUMENT_RH);
  });
});

describe("parité du suivi médical (RH-07)", () => {
  const TYPES = [...visites.TYPES_VISITE.map((t) => t.code), "inconnu", null];
  const REGIMES = [...visites.REGIMES_SUIVI.map((r) => r.code), "farfelu", null];

  it(`${TIRAGES} visites : même échéance proposée, même plafond, même état`, () => {
    for (let i = 0; i < TIRAGES; i++) {
      const date = dateAleatoire();
      const type = g.parmi(TYPES);
      const suivi = g.parmi(REGIMES);
      const prochaine = dateOuVide();
      const jour = dateAleatoire();
      const seuil = g.entier(0, 90);
      const cas = JSON.stringify({ date, type, suivi, prochaine, jour, seuil });
      expect(visites.prochaineVisiteSuggeree(date, suivi, type), cas).toBe(ancienVisites.prochaineVisiteSuggeree(date, suivi, type));
      expect(visites.depasseLePlafondLegal(date, prochaine, suivi), cas).toEqual(ancienVisites.depasseLePlafondLegal(date, prochaine, suivi));
      expect(visites.etatVisite(prochaine, jour, seuil), cas).toEqual(ancienVisites.etatVisite(prochaine, jour, seuil));
    }
  });

  it("ajouterMois rabat le 31 comme l'ancien, sur tous les décalages", () => {
    for (let i = 0; i < TIRAGES; i++) {
      const date = dateAleatoire();
      const mois = g.entier(-30, 70);
      expect(visites.ajouterMois(date, mois), `${date} + ${mois}`).toBe(ancienVisites.ajouterMois(date, mois));
    }
  });

  it("avis, types et régimes : même lecture, codes inconnus compris", () => {
    for (const code of ["apte", "apte_amenagements", "inapte_temporaire", "inapte", "", null, "bizarre"]) {
      expect(visites.avisAptitude(code)).toEqual(ancienVisites.avisAptitude(code));
      expect(visites.libelleAvis(code)).toBe(ancienVisites.libelleAvis(code));
    }
    for (const code of TYPES) expect(visites.typeVisite(code)).toEqual(ancienVisites.typeVisite(code));
    for (const code of REGIMES) expect(visites.regimeSuivi(code)).toEqual(ancienVisites.regimeSuivi(code));
  });

  it("le tri du registre et la dernière visite sont les mêmes", () => {
    for (let i = 0; i < 500; i++) {
      const liste = Array.from({ length: g.entier(0, 6) }, (_, k) => ({ id: `v${k}`, salarieId: "s", dateVisite: dateAleatoire(), type: "periodique", suivi: "simple", creeLe: g.parmi([null, `2026-0${g.entier(1, 9)}-01T00:00:00Z`]) }));
      expect(visites.trierVisites(liste).map((v) => v.id)).toEqual(ancienVisites.trierVisites(liste).map((v) => v.id));
      expect(visites.derniereVisite(liste)?.id).toBe(ancienVisites.derniereVisite(liste)?.id);
    }
  });
});

describe("parité des congés (RH-08) et du nom d'équipe (RH-02)", () => {
  // L'ancien code est évalué tel qu'il est écrit (D-045) : une évolution de l'écran fait échouer la parité.
  const ancien = new Function(`${sourceDe("nbJoursOuvres")}\n${sourceDe("soldeCPRestant")}\n${sourceDe("technicienLabel")}\nreturn { nbJoursOuvres, soldeCPRestant, technicienLabel };`)() as {
    nbJoursOuvres: (a: string, b: string) => number;
    soldeCPRestant: (e: { soldeCpInitial: unknown; absences: { type: string; nbJours: unknown }[] }) => number;
    technicienLabel: (t: { nom1?: string; metier?: string | null; metiers?: string[] }) => string;
  };

  it(`${TIRAGES} périodes : mêmes jours ouvrés (fériés comptés, week-ends exclus)`, () => {
    for (let i = 0; i < TIRAGES; i++) {
      const debut = dateAleatoire().replace(/-(29|30|31)$/, "-28");
      const fin = visites.ajouterMois(debut, 0)?.replace(/\d{2}$/, pad(g.entier(1, 28))) ?? debut;
      expect(nbJoursOuvres(debut, fin), `${debut} → ${fin}`).toBe(ancien.nbJoursOuvres(debut, fin));
    }
  });

  it(`${TIRAGES} soldes : acquis moins les seuls congés payés`, () => {
    for (let i = 0; i < TIRAGES; i++) {
      const initial = g.parmi([null, "", "25", "12.5", 30, "abc", 0]);
      const absences = Array.from({ length: g.entier(0, 5) }, () => ({ type: g.parmi(["Congé payé", "Arrêt maladie", "Congé sans solde"]), nbJours: g.parmi([1, 2.5, "3", null, 0]) }));
      expect(soldeCpRestant(initial as string | number | null, absences as { type: string; nbJours: number | null }[])).toBe(ancien.soldeCPRestant({ soldeCpInitial: initial, absences }));
    }
  });

  it("le nom d'une équipe sans nom est son métier, sinon « Équipe »", () => {
    for (const t of [
      { nom: "Peinture A", metier: "Peinture", metiers: ["Peinture"] },
      { nom: "", metier: "Plomberie", metiers: [] },
      { nom: "", metier: null, metiers: ["Électricité"] },
      { nom: "", metier: null, metiers: [] },
    ]) {
      expect(libelleEquipe(t)).toBe(ancien.technicienLabel({ nom1: t.nom, metier: t.metier ?? "", metiers: t.metiers }));
    }
  });
});
