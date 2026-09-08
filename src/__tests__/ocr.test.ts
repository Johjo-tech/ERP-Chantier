/**
 * Rapprochement du client lu avec le fichier clients.
 *
 * Le point délicat est la prudence : mieux vaut proposer que se tromper de
 * client, un bon de commande mal rattaché étant plus coûteux à corriger qu'un
 * champ laissé à confirmer.
 */

import { describe, it, expect } from "vitest";
import { rapprocherClient } from "@/integrations/ocr";

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
