/**
 * Rapprochement du client lu avec le fichier clients.
 *
 * Le point délicat est la prudence : mieux vaut proposer que se tromper de
 * client, un bon de commande mal rattaché étant plus coûteux à corriger qu'un
 * champ laissé à confirmer.
 */

import { describe, it, expect } from "vitest";
import { rapprocherClient, versSaisieBonCommande, type ExtractionBC } from "@/integrations/ocr";

const CLIENTS = [
  "ALPES ISERE HABITAT OFFICE PUBLIC DE L'HABITAT (ALPES ISERE HABITAT)",
  "SOCIETE D'HABITATIONS DES ALPES SA HLM",
  "ALKIA MENUISERIE SERRURERIE",
  "CHM ENTRETIEN",
];

describe("Rapprochement du client", () => {
  it("reconnaît un nom identique", () => {
    const r = rapprocherClient("CHM ENTRETIEN", CLIENTS);
    expect(r.reconnu).toBe(true);
    expect(r.nom).toBe("CHM ENTRETIEN");
  });

  it("ignore casse et accents", () => {
    const r = rapprocherClient("chm entretien", CLIENTS);
    expect(r.reconnu).toBe(true);
    expect(r.nom).toBe("CHM ENTRETIEN");
  });

  it("retrouve un libellé plus court que celui enregistré", () => {
    const r = rapprocherClient("ALPES ISERE HABITAT", CLIENTS);
    expect(r.reconnu).toBe(true);
    expect(r.nom).toBe(CLIENTS[0]);
  });

  it("neutralise les formes juridiques", () => {
    const r = rapprocherClient("Societe d'Habitations des Alpes", CLIENTS);
    expect(r.reconnu).toBe(true);
    expect(r.nom).toBe("SOCIETE D'HABITATIONS DES ALPES SA HLM");
  });

  it("propose sans trancher quand la lecture est inconnue", () => {
    const r = rapprocherClient("ENTREPRISE TOTALEMENT INCONNUE", CLIENTS);
    expect(r.reconnu).toBe(false);
    // Le nom lu est conservé : l'utilisateur peut créer le client
    expect(r.nom).toBe("ENTREPRISE TOTALEMENT INCONNUE");
  });

  it("propose la liste quand rien n'a été lu", () => {
    const r = rapprocherClient(null, CLIENTS);
    expect(r.reconnu).toBe(false);
    expect(r.nom).toBe("");
    expect(r.suggestions.length).toBeGreaterThan(0);
  });

  it("ne choisit pas entre deux clients également proches", () => {
    const ambigus = ["MAIRIE DE GRENOBLE", "MAIRIE DE LYON"];
    const r = rapprocherClient("MAIRIE", ambigus);
    expect(r.reconnu).toBe(false);
    expect(r.suggestions).toHaveLength(2);
  });

  it("ne plante pas sur une liste de clients vide", () => {
    const r = rapprocherClient("QUELQU'UN", []);
    expect(r.reconnu).toBe(false);
    expect(r.suggestions).toEqual([]);
  });
});

/**
 * Le pont entre ce que le modèle a lu et ce que le formulaire enregistre.
 *
 * Trois champs lus — `referenceChantier`, `natureTravaux`, `dateFinTravaux` —
 * n'étaient pas transmis : le formulaire les portait déjà, l'utilisateur les
 * ressaisissait à la main. Et le lieu d'intervention partait dans
 * `adresseLocataire`, que `saveBonCommande` ne lit jamais pour un bon de
 * commande : il était donc perdu à l'enregistrement.
 */
describe("Le brouillon issu de la lecture", () => {
  const lu: ExtractionBC = {
    client: "OPH DES TROIS VALLÉES",
    numeroBC: "90210",
    dateBC: "2026-09-03",
    referenceChantier: "77104",
    natureTravaux: "REMISE EN ETAT LOGEMENT",
    dateFinTravaux: "2026-10-30",
    adresse: "Résidence Les Tilleuls, 14 avenue des Peupliers",
    codePostal: "38100",
    ville: "GRENOBLE",
    numeroLogement: "42",
    logementStatut: "vacant",
    etage: "3ème",
    montantTotalHT: 1501,
    lignes: [{ type: "ligne", designation: "Peinture séjour", qte: 1, unite: "forfait" }],
    avertissements: [],
  };

  it("transmet les trois champs que la saisie manuelle devait reprendre", () => {
    const saisie = versSaisieBonCommande(lu);
    expect(saisie.referenceChantier).toBe("77104");
    expect(saisie.natureTravaux).toBe("REMISE EN ETAT LOGEMENT");
    expect(saisie.dateFinTravaux).toBe("2026-10-30");
  });

  it("place le lieu d'intervention là où le formulaire le lit", () => {
    const saisie = versSaisieBonCommande(lu);
    expect(saisie.adresse).toBe("Résidence Les Tilleuls, 14 avenue des Peupliers");
    expect(saisie.codePostal).toBe("38100");
    expect(saisie.ville).toBe("GRENOBLE");
    // `saveBonCommande` ne lit pas ce champ pour un bon : rien ne doit y aller.
    expect(saisie.adresseLocataire).toBeUndefined();
  });

  it("ne retient qu'un statut de logement que la base accepte", () => {
    expect(versSaisieBonCommande(lu).logementStatut).toBe("vacant");
    expect(
      versSaisieBonCommande({ ...lu, logementStatut: "inoccupé" }).logementStatut
    ).toBeUndefined();
  });

  it("marque le bon comme sans numéro quand la lecture n'en a trouvé aucun", () => {
    const saisie = versSaisieBonCommande({ ...lu, numeroBC: null });
    expect(saisie.sansBC).toBe(true);
  });
});
