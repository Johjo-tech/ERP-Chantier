/**
 * Recherche et filtrage des documents.
 *
 * Logique pure : ces tests construisent leurs documents à la main et
 * n'atteignent jamais la base. Ils décrivent ce qu'un utilisateur attend en
 * tapant dans la barre, pas la mécanique interne.
 */

import { describe, it, expect } from "vitest";
import {
  correspond,
  dansLaPeriode,
  dateDocument,
  filtrerDocuments,
  grouperParClient,
  lignesHaystack,
  multiWordMatch,
  sansAccents,
  SANS_CLIENT,
  texteDocument,
} from "@/integrations/recherche";

/** Date ISO décalée de `n` jours, sans passer par toISOString. */
function dans(n: number): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + n);
  const mois = String(d.getMonth() + 1).padStart(2, "0");
  return `${d.getFullYear()}-${mois}-${String(d.getDate()).padStart(2, "0")}`;
}

const FACTURE = {
  id: "f1",
  client: "ALPES ISERE HABITAT",
  numero: "FAC-2026-0042",
  ville: "Grenoble",
  statut: "impayée",
  conducteur: "PAUL",
  interlocuteur: "Marie Dupont",
  date: dans(0),
  lignes: [
    { type: "ligne", designation: "Réfection étanchéité terrasse" },
    { type: "commentaire", designation: "Support sain" },
  ],
};

describe("Accents et casse", () => {
  it("retire les accents", () => {
    expect(sansAccents("Étanchéité")).toBe("Etancheite");
  });

  it("trouve un mot accentué depuis une saisie sans accent", () => {
    expect(multiWordMatch("étanchéité toiture", "etancheite")).toBe(true);
  });

  it("trouve un mot sans accent depuis une saisie accentuée", () => {
    expect(multiWordMatch("evreux", "ÉVREUX")).toBe(true);
  });
});

describe("Recherche multi-mots", () => {
  it("exige tous les mots, mais dans n'importe quel ordre", () => {
    const texte = "peinture logement grenoble";
    expect(multiWordMatch(texte, "grenoble peinture")).toBe(true);
    expect(multiWordMatch(texte, "peinture marseille")).toBe(false);
  });

  it("accepte des mots venus de champs différents", () => {
    // « étanchéité » est dans une ligne, « grenoble » dans l'en-tête
    expect(correspond(FACTURE, "etancheite grenoble")).toBe(true);
  });

  it("ne filtre rien sur une requête vide", () => {
    expect(correspond(FACTURE, "")).toBe(true);
    expect(correspond(FACTURE, "   ")).toBe(true);
  });
});

describe("Champs parcourus", () => {
  it("retrouve un document par la désignation d'une de ses lignes", () => {
    // C'est le besoin qui manquait : chercher par ce qui est facturé
    expect(correspond(FACTURE, "réfection")).toBe(true);
  });

  it("retrouve un document par son statut", () => {
    // Divergence historique : le tableau de bord le trouvait, pas l'écran
    expect(correspond(FACTURE, "impayée")).toBe(true);
  });

  it("retrouve un document par sa ville et par son conducteur", () => {
    expect(correspond(FACTURE, "grenoble")).toBe(true);
    expect(correspond(FACTURE, "paul")).toBe(true);
  });

  it("retrouve un bon de commande par son numéro client", () => {
    const bc = { numeroBC: "2025-3232", client: "AUTO'SERVICE" };
    expect(correspond(bc, "2025-3232")).toBe(true);
  });

  it("retrouve un bon par son métier, quelle que soit la forme du champ", () => {
    expect(correspond({ metiers: ["PEINTURE", "SOL"] }, "peinture")).toBe(true);
    expect(correspond({ metier: "PEINTURE" }, "peinture")).toBe(true);
  });

  it("cherche dans les montants que l'appelant lui passe", () => {
    // Les totaux dépendent de la remise : ils sont calculés hors du module
    expect(correspond(FACTURE, "1250", ["1 250,00 €", "1250.00"])).toBe(true);
  });

  it("ne plante pas sur un document sans lignes ni champs", () => {
    expect(lignesHaystack(undefined)).toBe("");
    expect(texteDocument({})).toBe("");
    expect(correspond({}, "quoi que ce soit")).toBe(false);
  });
});

describe("Date de référence", () => {
  it("préfère la date de réception quand elle existe", () => {
    expect(dateDocument({ dateReception: "2026-03-01", date: "2026-04-01" })).toBe(
      "2026-03-01"
    );
  });

  it("retombe sur la date du document", () => {
    // Cas réel : la date de réception n'est renseignée que six fois sur dix
    expect(dateDocument({ date: "2026-04-01" })).toBe("2026-04-01");
  });

  it("retombe en dernier recours sur la date de création", () => {
    expect(dateDocument({ createdAt: "2026-05-06T14:30:00Z" })).toBe("2026-05-06");
  });

  it("rend une chaîne vide plutôt que de deviner", () => {
    expect(dateDocument({})).toBe("");
  });
});

describe("Filtre de période", () => {
  it("laisse tout passer sur « toute la période »", () => {
    expect(dansLaPeriode("", "tout")).toBe(true);
    expect(dansLaPeriode("1998-01-01", "tout")).toBe(true);
  });

  it("écarte un document sans date, sauf sur « toute la période »", () => {
    expect(dansLaPeriode("", "mois")).toBe(false);
  });

  it("retient le mois et l'année en cours", () => {
    expect(dansLaPeriode(dans(0), "mois")).toBe(true);
    expect(dansLaPeriode(dans(0), "annee")).toBe(true);
  });

  it("inclut les deux bornes d'une plage", () => {
    expect(dansLaPeriode("2026-03-01", "plage", "2026-03-01", "2026-03-31")).toBe(true);
    expect(dansLaPeriode("2026-03-31", "plage", "2026-03-01", "2026-03-31")).toBe(true);
    expect(dansLaPeriode("2026-04-01", "plage", "2026-03-01", "2026-03-31")).toBe(false);
  });

  it("ne fait pas basculer le 31 décembre dans l'année suivante", () => {
    // Comparaison de chaînes, pas d'objets Date : le fuseau ne joue pas
    expect(dansLaPeriode("2026-12-31", "plage", "2026-01-01", "2026-12-31")).toBe(true);
  });
});

describe("Filtrage combiné", () => {
  const liste = [
    { id: "a", client: "ALPES", interlocuteur: "Marie", date: dans(0) },
    { id: "b", client: "ALPES", interlocuteur: "Paul", date: dans(0) },
    { id: "c", client: "AUTO", interlocuteur: "Marie", date: "2020-01-01" },
  ];

  it("combine deux critères sans en perdre un", () => {
    const r = filtrerDocuments(liste, { client: "ALPES", interlocuteur: "Marie" });
    expect(r.map((d) => d.id)).toEqual(["a"]);
  });

  it("croise un filtre et la période", () => {
    const r = filtrerDocuments(liste, { interlocuteur: "Marie", periode: "mois" });
    expect(r.map((d) => d.id)).toEqual(["a"]);
  });

  it("n'applique pas un critère vide", () => {
    // C'est ce qui permet à une vue de n'afficher qu'une partie des filtres
    expect(filtrerDocuments(liste, {})).toHaveLength(3);
    expect(filtrerDocuments(liste, { client: "" })).toHaveLength(3);
  });

  it("filtre sur le statut de règlement fourni par l'appelant", () => {
    const factures = [
      { id: "p", client: "X" },
      { id: "i", client: "X" },
    ];
    const r = filtrerDocuments(factures, { reglement: "payee" }, (d) => ({
      reglements: d.id === "p" ? ["payee"] : ["impayee"],
    }));
    expect(r.map((d) => d.id)).toEqual(["p"]);
  });

  it("retient une facture à la fois impayée et en retard sous les deux filtres", () => {
    const factures = [{ id: "r" }, { id: "n" }];
    const ctx = (d: Record<string, unknown>) => ({
      reglements: d.id === "r" ? ["impayee", "retard"] : ["impayee"],
    });
    expect(filtrerDocuments(factures, { reglement: "retard" }, ctx)).toHaveLength(1);
    expect(filtrerDocuments(factures, { reglement: "impayee" }, ctx)).toHaveLength(2);
  });

  it("filtre sur le métier fourni par l'appelant", () => {
    const bons = [{ id: "x" }, { id: "y" }];
    const r = filtrerDocuments(bons, { metier: "SOL" }, (d) => ({
      metiers: d.id === "x" ? ["PEINTURE", "SOL"] : ["PEINTURE"],
    }));
    expect(r.map((d) => d.id)).toEqual(["x"]);
  });
});

describe("Regroupement par client", () => {
  it("trie les clients et conserve leurs documents", () => {
    const g = grouperParClient([
      { id: "1", client: "ZEBRE" },
      { id: "2", client: "ALPHA" },
      { id: "3", client: "ALPHA" },
    ]);
    expect(g.map((x) => x.client)).toEqual(["ALPHA", "ZEBRE"]);
    expect(g[0].documents).toHaveLength(2);
  });

  it("range les documents sans client sous un libellé explicite", () => {
    const g = grouperParClient([{ id: "1" }]);
    expect(g[0].client).toBe(SANS_CLIENT);
  });

  it("ne rend aucun groupe pour une liste vide", () => {
    // Un dossier vide laisserait croire à une file en attente
    expect(grouperParClient([])).toEqual([]);
  });
});
