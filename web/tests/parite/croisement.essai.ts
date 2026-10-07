/**
 * Parité du croisement facture ↔ bon (TRV-07) contre
 * `src/api/regles-liens-facture-bc.ts` et `origineDeLaCorrespondance` de
 * `src/integrations/recherche.ts`, importés tels quels. Le nouveau lit les
 * colonnes de la base (snake_case), l'ancien les champs de l'adaptateur.
 */
import { describe, expect, it } from "vitest";
import * as ancien from "../../../src/api/regles-liens-facture-bc";
import * as ancienneRecherche from "../../../src/integrations/recherche";
import { montantsCherchables, origineDeLaCorrespondance } from "../../src/lib/recherche";
import { montant } from "../../src/lib/money";
import * as nouveau from "../../src/modules/facturation/domain/croisement";
import { generateur } from "./aleatoire";

const g = generateur(20260927);
const TIRAGES = 400;

const NUMEROS = ["BC-2024-0187", "bc 2024 0187", "BC-2024-0187\nBC-2024-0190", "Sans BC", "En attente de BC", "SAV-12", "  Crédit Logement ", "crédit  logement", "", null, "4500012345", "BÂT A-7"];
const TEXTES = ["", null, "Rue de la Paix", "12 rue Émile Zola", "Martin", "Réfection peinture", "2e étage", "Apt 12"];

function bonAleatoire(i: number) {
  return {
    id: `b${i}`,
    numero_bc: g.parmi(NUMEROS),
    numero_interne: g.parmi([null, `BC-INT-${i}`]),
    nature_travaux: g.parmi(TEXTES),
    reference_chantier: g.parmi(TEXTES),
    adresse: g.parmi(TEXTES),
    adresse_locataire: g.parmi(TEXTES),
    code_postal: g.parmi(["", null, "69003"]),
    ville: g.parmi(["", null, "Lyon"]),
    occupant: g.parmi(TEXTES),
    ancien_locataire: g.parmi(TEXTES),
    numero_logement: g.parmi(TEXTES),
    etage: g.parmi(TEXTES),
  };
}

function factureAleatoire(i: number, bons: readonly { id: string }[]) {
  return {
    id: `f${i}`,
    numero: g.parmi([null, `FA-2026-${i}`]),
    bon_commande_id: g.reel() < 0.3 ? g.parmi(bons).id : null,
    ref_bon_commande_client: g.parmi(NUMEROS),
    occupant: g.parmi(TEXTES),
    adresse_locataire: g.parmi(TEXTES),
  };
}

const versAncienBon = (b: ReturnType<typeof bonAleatoire>) => ({
  id: b.id, numeroBC: b.numero_bc, numeroInterne: b.numero_interne, natureTravaux: b.nature_travaux, referenceChantier: b.reference_chantier,
  adresse: b.adresse, adresseLocataire: b.adresse_locataire, codePostal: b.code_postal, ville: b.ville, occupant: b.occupant,
  ancienLocataire: b.ancien_locataire, numeroLogement: b.numero_logement, etage: b.etage,
});
const versAncienneFacture = (f: ReturnType<typeof factureAleatoire>) => ({
  id: f.id, numero: f.numero, bonCommandeId: f.bon_commande_id, refBonCommandeClient: f.ref_bon_commande_client, occupant: f.occupant, adresseLocataire: f.adresse_locataire,
});
const ids = (l: readonly { id: string }[]) => l.map((x) => x.id);

describe("parité du croisement facture ↔ bon", () => {
  it(`${TIRAGES} jeux : mêmes clés, mêmes bons par facture, mêmes factures par bon, mêmes apports`, () => {
    for (let t = 0; t < TIRAGES; t++) {
      const bons = Array.from({ length: g.entier(1, 6) }, (_, i) => bonAleatoire(i));
      const factures = Array.from({ length: g.entier(0, 6) }, (_, i) => factureAleatoire(i, bons));
      const iN = nouveau.construireIndex(factures, bons);
      const iA = ancien.construireIndexFactureBC({ factures: factures.map(versAncienneFacture), bons: bons.map(versAncienBon) });
      for (const f of factures) {
        expect(nouveau.cleRapprochement(f.ref_bon_commande_client)).toBe(ancien.cleRapprochement(f.ref_bon_commande_client));
        expect(ids(nouveau.bonsDeLaFacture(f, iN))).toEqual(ids(ancien.bonsDeLaFacture(versAncienneFacture(f), iA)));
      }
      for (const b of bons) {
        expect(ids(nouveau.facturesDuBon(b, iN))).toEqual(ids(ancien.facturesDuBon(versAncienBon(b), iA)));
        expect(nouveau.apportsDuBon(b)).toEqual(ancien.apportsDuBon(versAncienBon(b)));
        for (const f of factures) {
          const m = montantsCherchables(montant(g.entier(0, 100_000) / 100));
          expect(nouveau.apportsDeLaFacture(f, b, m)).toEqual(ancien.apportsDeLaFacture(versAncienneFacture(f), versAncienBon(b), m));
        }
      }
    }
  });

  it("d'où vient la correspondance : mêmes apports cités que l'ancien", () => {
    const apports = [
      { etiquette: "BC", valeur: "BC-2024-0187" },
      { etiquette: "Locataire", valeur: "Martin 2e étage" },
      { etiquette: "Montant", valeur: "1 234,50 € 1234.50" },
    ];
    const doc = { client: "OPH Lyon", numero: "FA-2026-12", occupant: "Martin" };
    for (const requete of ["0187", "martin", "oph 0187", "1234.50", "étage", "rien", "", "FA-2026 martin"]) {
      const a = ancienneRecherche.origineDeLaCorrespondance(doc, requete, apports);
      expect(origineDeLaCorrespondance(requete, [doc.client, doc.numero, doc.occupant], apports), requete).toEqual(a);
    }
  });
});
