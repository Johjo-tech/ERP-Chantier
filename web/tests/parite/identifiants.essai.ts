/**
 * Parité avec l'application historique : les fonctions portées dans web/
 * doivent rendre EXACTEMENT ce que rend le module d'origine, importé tel quel.
 */
import { describe, expect, it } from "vitest";
import * as ancien from "../../../src/api/regles-efacture";
import * as nouveau from "../../src/modules/clients/domain/identifiants";
import * as delais from "../../src/modules/clients/domain/delais";
import { generateur } from "./aleatoire";

const g = generateur();
const TIRAGES = 2000;

function saisieAleatoire(): string {
  const formes = [
    () => g.chiffres(9),
    () => g.chiffres(14),
    () => `356000000${g.chiffres(5)}`,
    () => `${g.chiffres(3)} ${g.chiffres(3)} ${g.chiffres(3)}`,
    () => g.chiffres(g.entier(0, 16)),
    () => `FR${g.chiffres(2)}${g.chiffres(9)}`,
    () => `fr ${g.chiffres(11)}`,
    () => `BE${g.chiffres(10)}`,
    () => `FRAB${g.chiffres(9)}`,
    () => "",
  ];
  return g.parmi(formes)();
}

describe("parité identifiants (SIREN, SIRET, TVA)", () => {
  it(`${TIRAGES} saisies aléatoires donnent les mêmes verdicts`, () => {
    for (let i = 0; i < TIRAGES; i++) {
      const s = saisieAleatoire();
      expect(nouveau.sirenValide(s), s).toBe(ancien.sirenValide(s));
      expect(nouveau.siretValide(s), s).toBe(ancien.siretValide(s));
      expect(nouveau.sirenDuSiret(s), s).toBe(ancien.sirenDuSiret(s));
      expect(nouveau.cleTvaFr(s), s).toBe(ancien.cleTvaFr(s));
      expect(nouveau.tvaIntracomFr(s), s).toBe(ancien.tvaIntracomFr(s));
      expect(nouveau.analyserTvaIntracom(s), s).toEqual(ancien.analyserTvaIntracom(s));
    }
  });

  it("verifierIdentifiants relève les mêmes anomalies que verifierEntite", () => {
    for (let i = 0; i < TIRAGES; i++) {
      const e = { siret: saisieAleatoire(), siren: saisieAleatoire(), tva: saisieAleatoire(), pays: g.parmi(["FR", "BE", "", null]) };
      // Écart assumé (DECISIONS D-012) : un pays VIDE vaut « FR » dans web/, là où
      // l'ancien code comparait au pays "" et reprochait « le pays est . ».
      const paysAncien = e.pays === "" ? "FR" : e.pays;
      const avant = ancien.verifierEntite({ siret: e.siret, siren: e.siren, tvaIntracom: e.tva, paysCode: paysAncien });
      const apres = nouveau.verifierIdentifiants({ siret: e.siret, siren: e.siren, tva_intracom: e.tva, pays_code: e.pays });
      // Seule la graphie du champ change (snake_case des colonnes).
      expect(apres.map((a) => [a.champ.replace("tva_intracom", "tvaIntracom"), a.libelle])).toEqual(
        avant.map((a) => [a.champ, a.libelle])
      );
    }
  });

  it("écart assumé : un pays vide n'est pas un pays", () => {
    const tva = "BE0123456789";
    expect(ancien.verifierEntite({ tvaIntracom: tva, paysCode: "" })[0]?.libelle).toMatch(/le pays est \.$/);
    expect(nouveau.verifierIdentifiants({ tva_intracom: tva, pays_code: "" })[0]?.libelle).toMatch(/le pays est FR\.$/);
  });

  it("cas connus", () => {
    expect(nouveau.tvaIntracomFr("732 829 320")).toBe("FR44732829320");
    expect(nouveau.siretValide("73282932000074")).toBe(true);
  });
});

describe("parité délais et échéances", () => {
  const modes = ["net", "fin_de_mois"] as const;

  it(`${TIRAGES} dates × délais donnent la même échéance, le même libellé, le même avertissement`, () => {
    for (let i = 0; i < TIRAGES; i++) {
      const date = `${g.entier(2020, 2030)}-${String(g.entier(1, 12)).padStart(2, "0")}-${String(g.entier(1, 31)).padStart(2, "0")}`;
      const delai = { jours: g.entier(0, 120), mode: g.parmi(modes) };
      expect(delais.dateEcheance(date, delai), `${date} ${delai.jours} ${delai.mode}`).toBe(ancien.dateEcheance(date, delai));
      expect(delais.libelleDelaiPaiement(delai)).toBe(ancien.libelleDelaiPaiement(delai));
      expect(delais.delaiHorsPlafond(delai)).toBe(ancien.delaiHorsPlafond(delai));
      expect(delais.delaiPreregle(delai)?.cle ?? null).toBe(ancien.delaiPreregle(delai)?.cle ?? null);
    }
  });

  it("dates illisibles : pas d'échéance inventée", () => {
    for (const d of ["", "15/01/2026", "2026-1-5", null]) {
      expect(delais.dateEcheance(d, { jours: 30, mode: "net" })).toBe(ancien.dateEcheance(d, { jours: 30, mode: "net" }));
    }
  });

  it("le délai retenu suit le client, puis la société, puis 30 jours net", () => {
    const cas: [number | null, string | null, number | null, string | null][] = [
      [0, null, 45, "fin_de_mois"],
      [null, null, 45, "fin_de_mois"],
      [null, null, null, null],
      [60, "fin_de_mois", 30, "net"],
      [21, "bizarre", null, null],
    ];
    for (const [cj, cm, sj, sm] of cas) {
      expect(
        delais.delaiPaiementRetenu(
          { delai_paiement_jours: cj, delai_paiement_mode: cm },
          { delai_paiement_jours: sj, delai_paiement_mode: sm }
        )
      ).toEqual(
        ancien.delaiPaiementRetenu(
          { delaiPaiementJours: cj, delaiPaiementMode: cm },
          { delaiPaiementJours: sj, modeDelaiPaiement: sm }
        )
      );
    }
  });
});
