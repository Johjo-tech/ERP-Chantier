/**
 * Parité Réglages et société, contre l'ancien code pris TEL QUEL :
 *  - `src/integrations/reglages.ts#fusionnerReglages` (lecture tolérante du JSON) ;
 *  - `src/api/regles-theme.ts#paletteSociete` (couleur de la société) ;
 *  - `src/api/regles-efacture.ts` (complétude, régimes, schémas d'adresse) ;
 *  - `src/api/regles-referentiels.ts` (normalisation, tri, position) ;
 *  - `apercuNumero` et `SERIES_NUMEROTATION` de `src/api/queries/parametres.ts`,
 *    dont la SOURCE est extraite (le module importe le client Supabase).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import * as ancienEfacture from "../../../src/api/regles-efacture";
import * as ancienReferentiels from "../../../src/api/regles-referentiels";
import * as ancienTheme from "../../../src/api/regles-theme";
import { fusionnerReglages as ancienFusionner } from "../../../src/integrations/reglages";
import { apercuNumero, SERIES_NUMEROTATION } from "../../src/modules/reglages/domain/numerotation";
import { normaliserEntree, ordonner, prochainePosition } from "../../src/modules/reglages/domain/listes";
import { fusionnerReglages } from "../../src/modules/societes/domain/reglages-societe";
import * as societe from "../../src/modules/societes/domain/societe";
import { paletteSociete } from "../../src/modules/societes/theme/palette";
import { generateur } from "./aleatoire";

const g = generateur(26092601);
const TIRAGES = 2000;

const VALEURS = [undefined, null, "", "abc", 0, -5, 12, "15", 7.5, true, false, [], {}, "#FF6A1A", "fin_de_mois", " texte "];
const valeur = () => g.parmi(VALEURS);

function documentAleatoire(): unknown {
  if (g.reel() < 0.05) return g.parmi([null, undefined, "abîmé", 42, []]);
  const doc: Record<string, unknown> = {};
  for (const cle of ["validiteDevisJours", "delaiPaiementJours", "modeDelaiPaiement", "tvaDefaut", "modeReglementDefaut", "conditionsDevis", "piedDePage", "mentionAcceptation", "mentionsComplementaires", "afficherIban", "couleurAccent", "couleurSecondaire", "siteWeb"]) {
    if (g.reel() < 0.5) doc[cle] = valeur();
  }
  const seuils: Record<string, unknown> = {};
  for (const cle of ["vehiculeCarte", "vehiculeControle", "documentLegal", "carteBtp", "visiteMedicale", "habilitation", "conducteurSansRdv", "inconnu"]) {
    if (g.reel() < 0.4) seuils[cle] = valeur();
  }
  return {
    documents: g.reel() < 0.9 ? doc : valeur(),
    unites: g.parmi([undefined, [], ["U", " ml ", ""], "U", [1, null, "m²"]]),
    tauxTva: g.parmi([undefined, [], [20, "10", -1, 20, "x"], [0, 5.5], "20", [null]]),
    metiers: g.parmi([undefined, ["Peinture", ""], []]),
    seuils: g.reel() < 0.8 ? seuils : valeur(),
    notifications: g.parmi([undefined, { actives: false, destinataires: "a@b.fr" }, { actives: "oui" }, null]),
  };
}

describe("parité fusionnerReglages (SOC-23, PAR-02)", () => {
  it(`${TIRAGES} documents stockés, abîmés compris, donnent les mêmes réglages`, () => {
    for (let i = 0; i < TIRAGES; i++) {
      const brut = documentAleatoire();
      expect(fusionnerReglages(brut), JSON.stringify(brut)).toEqual(ancienFusionner(brut));
    }
  });
});

describe("parité paletteSociete (SOC-04)", () => {
  const hex = () => `#${g.chiffres(0) || ""}${Array.from({ length: 6 }, () => "0123456789abcdefABCDEF"[g.entier(0, 21)]).join("")}`;
  it(`${TIRAGES} couleurs, malformées comprises, donnent la même palette`, () => {
    for (let i = 0; i < TIRAGES; i++) {
      const a = g.parmi([hex(), hex(), hex(), "#FF6A1A", "#fff", "rouge", "", null, undefined]);
      const b = g.parmi([hex(), "#182233", "", null, "#12"]);
      expect(paletteSociete(a, b), `${String(a)} / ${String(b)}`).toEqual(ancienTheme.paletteSociete(a, b));
    }
  });
});

describe("parité identité légale (SOC-05, SOC-06)", () => {
  const CHAMPS: [keyof typeof societe.schemaSociete.shape, string][] = [
    ["raison_sociale_legale", "raisonSocialeLegale"], ["siret", "siret"], ["tva_intracom", "tvaIntracom"], ["forme_juridique", "formeJuridique"],
    ["adresse", "adresse"], ["code_postal", "codePostal"], ["ville", "ville"], ["adresse_electronique_valeur", "adresseElectroniqueValeur"],
    ["capital_social", "capitalSocial"], ["rcs_numero", "rcsNumero"], ["rcs_ville", "rcsVille"], ["telephone", "telephone"], ["email", "email"],
    ["iban", "iban"], ["bic", "bic"],
  ];
  const FORMES = ["", "SAS", "SASU", "EI", "e.i.", "Entreprise individuelle", "micro-entreprise", "EURL", "  sarl  ", null];

  it(`${TIRAGES} fiches : mêmes manques, mêmes recommandations, même verdict « société »`, () => {
    for (let i = 0; i < TIRAGES; i++) {
      const neuve: Record<string, string | null> = {};
      const ancienne: Record<string, string | null> = {};
      for (const [col, camel] of CHAMPS) {
        const v = col === "forme_juridique" ? g.parmi(FORMES) : g.parmi(["", "  ", "x", null, "12"]);
        neuve[col] = v;
        ancienne[camel] = v;
      }
      const libelles = (l: readonly { libelle: string }[]) => l.map((a) => a.libelle);
      expect(libelles(societe.completudeSociete(neuve))).toEqual(libelles(ancienEfacture.completudeSociete(ancienne)));
      expect(libelles(societe.recommandationsSociete(neuve))).toEqual(libelles(ancienEfacture.recommandationsSociete(ancienne)));
      expect(societe.estSociete(neuve.forme_juridique)).toBe(ancienEfacture.estSociete(ancienne.formeJuridique));
      const manques = societe.completudeSociete(neuve);
      if (manques.length) expect(societe.messageManques(manques)).toBe(ancienEfacture.messageAnomalies(ancienEfacture.completudeSociete(ancienne)));
    }
  });

  it("mêmes régimes de TVA, périodicités, schémas d'adresse et indemnité", () => {
    expect(societe.REGIMES_TVA).toEqual(ancienEfacture.REGIMES_TVA);
    expect(societe.PERIODICITES_EREPORTING).toEqual(ancienEfacture.PERIODICITES_EREPORTING);
    expect(societe.SCHEMAS_ADRESSE_ELECTRONIQUE).toEqual(ancienEfacture.SCHEMAS_ADRESSE_ELECTRONIQUE);
    expect(societe.MENTION_FRANCHISE_EN_BASE).toBe(ancienEfacture.MENTION_FRANCHISE_EN_BASE);
    expect(societe.INDEMNITE_RECOUVREMENT_EUR).toBe(ancienEfacture.INDEMNITE_RECOUVREMENT_EUR);
    for (const r of ["franchise_en_base", "reel_simplifie", "", null, "autre"]) expect(societe.sansTva(r)).toBe(ancienEfacture.sansTva(r));
  });
});

describe("parité listes de choix (PAR-04)", () => {
  const LIBELLES = ["Échafaudage", "ECHAFAUDAGE", "Location de matériel", "  m²  ", "Main-d'œuvre", "", "Ça & là", "Nacelle 12 m"];

  it("même normalisation des libellés", () => {
    for (const l of LIBELLES) expect(normaliserEntree(l)).toBe(ancienReferentiels.normaliserEntree(l));
  });

  it(`${TIRAGES} listes : même ordre, même prochaine position`, () => {
    for (let i = 0; i < TIRAGES / 10; i++) {
      const entrees = Array.from({ length: g.entier(0, 8) }, (_, k) => ({ id: `e${k}`, libelle: g.parmi(LIBELLES), position: g.entier(0, 4), domaine: "unite", societeId: "s" }));
      expect(ordonner(entrees).map((e) => e.id)).toEqual(ancienReferentiels.entreesDuDomaine(entrees, "unite", "s").map((e) => e.id));
      expect(prochainePosition(entrees)).toBe(ancienReferentiels.prochainePosition(entrees, "unite", "s"));
    }
  });
});

describe("parité numérotation (PAR-03)", () => {
  const source = readFileSync(join(import.meta.dirname, "../../../src/api/queries/parametres.ts"), "utf8");
  const debut = source.indexOf("export function apercuNumero(");
  const corps = source.slice(debut, source.indexOf("\n}\n", debut) + 2).replace("export ", "").replace(/: (string|number)/g, "");
  const ancienApercu = new Function(`${corps}\nreturn apercuNumero;`)() as (p: string, v: number, a: number) => string;

  it("même aperçu du prochain numéro", () => {
    for (let i = 0; i < TIRAGES; i++) {
      const p = g.parmi(["DEV", "FAC", " INT ", "", "SAV", "X_1"]);
      const v = g.entier(0, 1_200_000);
      const a = g.entier(2020, 2030);
      expect(apercuNumero(p, v, a)).toBe(ancienApercu(p, v, a));
    }
  });

  it("mêmes séries, mêmes préfixes par défaut (pas de série BC)", () => {
    for (const s of SERIES_NUMEROTATION) expect(source).toContain(`{ type: "${s.type}", label: "${s.libelle}", prefixe: "${s.prefixe}" }`);
    expect(SERIES_NUMEROTATION.map((s) => s.type)).not.toContain("bon_commande");
  });
});
