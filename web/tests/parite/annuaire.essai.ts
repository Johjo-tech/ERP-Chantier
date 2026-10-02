/**
 * Parité de l'annuaire des entreprises (CLI-02, CLI-23) contre
 * `src/integrations/entreprise.ts`, dont la SOURCE est évaluée (son import
 * `@/api/…` ne se résout pas depuis web/) avec `tvaIntracomFr` de l'ancien
 * module de règles et un `fetch` factice : mêmes réponses de l'API, même
 * résultat. Et le remplissage de la fiche contre `appliquerEtablissement`
 * d'`app.js`, évalué sur un faux formulaire.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as regles from "../../../src/api/regles-efacture";
import { rechercherEntreprise, reinitialiserAnnuaire } from "../../src/modules/clients/api/annuaire";
import { appliquerEtablissement, interpreterReponse, nettoyerAdresse, nomDuDirigeant, type EntrepriseApi, type EtablissementTrouve } from "../../src/modules/clients/domain/annuaire";
import { lireAncien, sansTypes } from "./source";
import { sourceDe } from "./source-app";

type Ancien = {
  rechercherEntreprise: (s: string) => Promise<unknown>;
  nettoyerAdresse: (a: string, cp: string, v: string) => string;
  nomDuDirigeant: (d: unknown) => string;
};

function ancienAnnuaire(fetchFactice: (url: string) => Promise<Response>): Ancien {
  const source = sansTypes(lireAncien("src/integrations/entreprise.ts").replace(/^import .*$/m, ""));
  return new Function("tvaIntracomFr", "fetch", "console", `${source}\nreturn { rechercherEntreprise, nettoyerAdresse, nomDuDirigeant };`)(regles.tvaIntracomFr, fetchFactice, { warn: () => undefined }) as Ancien;
}

const etab = (p: Record<string, unknown>) => ({ siret: "73282932000074", adresse: "12 RUE DE LA PAIX 75002 PARIS", code_postal: "75002", libelle_commune: "PARIS", activite_principale: "43.34Z", etat_administratif: "A", est_siege: true, ...p });

const REPONSES: Record<string, EntrepriseApi[]> = {
  "peinture martin": [
    { siren: "732829320", nom_complet: "PEINTURE MARTIN", nature_juridique: "5710", siege: etab({}), dirigeants: [{ nom: "MARTIN (MARTIN)", prenoms: "Paul", qualite: "Président de SAS" }], tva: ["FR44732829320"] },
    { siren: "552100554", nom_complet: "MAIRIE DE LYON (69003)", nature_juridique: "7210", siege: etab({ siret: "55210055400013", adresse: "1 PL. DE LA COMEDIE 69001 LYON (69003)", code_postal: "69001", libelle_commune: "LYON (69003)" }), dirigeants: [{ denomination: "VILLE DE LYON" }] },
    { siren: "111111111", nom_complet: "SANS SIEGE", siege: null },
  ],
  "732829320": [
    {
      siren: "732829320", nom_complet: "PEINTURE MARTIN", nature_juridique: "5710", siege: etab({}), etat_administratif: "C", date_fermeture: "2025-12-31",
      matching_etablissements: [etab({ siret: "73282932000082", est_siege: false, adresse: "3 AV. X 69003 LYON", code_postal: "69003", libelle_commune: "LYON" }), etab({ siret: "73282932000090", est_siege: false, etat_administratif: "F" })],
    },
  ],
  "73282932000082": [{ siren: "732829320", nom_complet: "PEINTURE MARTIN", siege: etab({}), matching_etablissements: [etab({ siret: "73282932000082", est_siege: false })] }],
  "73282932000090": [{ siren: "732829320", nom_complet: "PEINTURE MARTIN", siege: etab({}), matching_etablissements: [etab({ siret: "73282932000090", est_siege: false, etat_administratif: "F" })] }],
  "12345678901234": [{ siren: "123456789", nom_complet: "AUTRE", siege: etab({ siret: "12345678900011" }) }],
};

function fetchFactice(url: string): Promise<Response> {
  const q = new URL(url).searchParams.get("q") ?? "";
  return Promise.resolve(new Response(JSON.stringify({ results: REPONSES[q] ?? [] }), { status: 200, headers: { "content-type": "application/json" } }));
}

describe("parité de l'annuaire des entreprises", () => {
  beforeEach(() => {
    reinitialiserAnnuaire();
    vi.stubGlobal("fetch", vi.fn(fetchFactice));
  });
  afterEach(() => vi.unstubAllGlobals());

  const SAISIES = ["peinture martin", "732829320", "732 829 320", "73282932000082", "73282932000090", "12345678901234", "inconnue sarl", "  ", "99"];

  for (const s of SAISIES) {
    it(`« ${s} » : même résultat`, async () => {
      const ancien = ancienAnnuaire(fetchFactice);
      expect(await rechercherEntreprise(s)).toEqual(await ancien.rechercherEntreprise(s));
    });
  }

  it("nettoyage d'adresse et nom du dirigeant, caractères spéciaux compris", () => {
    const ancien = ancienAnnuaire(fetchFactice);
    for (const [a, cp, v] of [["1 PL. DE LA COMEDIE 69001 LYON (69003)", "69001", "LYON (69003)"], ["12 RUE X 75001 PARIS", "75001", "PARIS"], ["L'ISLE 38080", "38080", "L'ISLE-D'ABEAU"], ["", "1", "x"], ["RUE", "", ""]] as const) {
      expect(nettoyerAdresse(a, cp, v)).toBe(ancien.nettoyerAdresse(a, cp, v));
    }
    for (const d of [{ nom: "CHOUMANE (CHOUMANE)", prenoms: "Ali" }, { nom: "DUPONT (DURAND)", prenoms: "" }, { denomination: " SAS X " }, undefined, {}]) {
      expect(nomDuDirigeant(d)).toBe(ancien.nomDuDirigeant(d));
    }
  });

  it("interpreterReponse est la même règle que l'appel, sans réseau", () => {
    expect(interpreterReponse("peinture martin", REPONSES["peinture martin"] ?? [])).toMatchObject({ type: "nom" });
  });
});

describe("parité du remplissage de la fiche (appliquerEtablissement)", () => {
  const CIBLES = { nom: "c_nom", adresse: "c_adresse", codePostal: "c_codePostal", ville: "c_ville", siren: "c_siren", tvaIntracom: "c_tvaIntracom", adresseElectroniqueValeur: "c_aev", adresseElectroniqueSchema: "c_aes" };
  const CORRESPONDANCE = { c_siret: "siret", c_nom: "nom", c_adresse: "adresse", c_codePostal: "code_postal", c_ville: "ville", c_siren: "siren", c_tvaIntracom: "tva_intracom", c_aev: "adresse_electronique_valeur", c_aes: "adresse_electronique_schema" } as const;

  function ancienRemplissage(avant: Record<string, string>, e: EtablissementTrouve): Record<string, string> {
    const champs = new Map(Object.entries(CORRESPONDANCE).map(([id, col]) => [id, { value: avant[col] ?? "" }]));
    const document = { getElementById: (id: string) => champs.get(id) ?? null };
    const window = { adresseElectroniqueParDefaut: regles.adresseElectroniqueParDefaut };
    new Function("siretCibles", "document", "window", "majApresAnnuaire", `${sourceDe("appliquerEtablissement")}\nappliquerEtablissement(arguments[4], "c_siret");`)(CIBLES, document, window, undefined, e);
    return Object.fromEntries(Object.entries(CORRESPONDANCE).map(([id, col]) => [col, champs.get(id)?.value ?? ""]));
  }

  const etabl: EtablissementTrouve = {
    siret: "73282932000074", siren: "732829320", nom: "PEINTURE MARTIN", adresse: "12 RUE DE LA PAIX", codePostal: "75002", ville: "PARIS", activite: "43.34Z", estSiege: true,
    formeJuridique: "5710", tvaIntracom: "FR44732829320", tvaConfirmee: true, dirigeant: "Paul MARTIN", dirigeantQualite: "Président", active: true, dateFermeture: "",
  };
  const VIDE = { nom: "", siret: "", siren: "", adresse: "", code_postal: "", ville: "", tva_intracom: "", adresse_electronique_valeur: "", adresse_electronique_schema: "" };

  for (const [cas, avant] of [
    ["fiche vide", VIDE],
    ["TVA et adresse électronique saisies à la main", { ...VIDE, nom: "Ancien nom", tva_intracom: "FR00999999999", adresse_electronique_valeur: "facturation@x.fr", adresse_electronique_schema: "0225" }],
    ["identité déjà remplie", { ...VIDE, nom: "X", siret: "1", siren: "2", adresse: "a", code_postal: "b", ville: "c" }],
  ] as const) {
    it(`${cas} : les mêmes champs après le choix`, () => {
      expect({ ...avant, ...appliquerEtablissement(avant, etabl) }).toEqual(ancienRemplissage(avant, etabl));
    });
  }
});
