/**
 * Parité du portail client contre `app.js` (source extraite, D-045) :
 * `statutClientBC` (couleur d'un bon), l'ordre d'affichage et
 * `CHAMPS_CHERCHES_PORTAIL` (ce qu'un client peut chercher).
 */
import { describe, expect, it } from "vitest";
import { CHAMPS_CHERCHES_PORTAIL, chercherBonsClient, statutClientBon, trierBonsClient } from "../../src/modules/espace-client/domain/bons";
import { generateur } from "./aleatoire";
import { constanteDe, sourceDe } from "./source-app";

const g = generateur(6529);

interface BonAncien {
  id: string;
  numeroBC: string;
  __fait: boolean;
  dateInterventionTerminee: string;
  pieceACommander: boolean;
  datePlanifiee: string;
  heurePlanifiee: string;
}

const ancien = new Function(
  "bcInterventionFaite", "fmtDate",
  `${sourceDe("statutClientBC")}\n${constanteDe("CHAMPS_CHERCHES_PORTAIL")}\nreturn { statutClientBC, CHAMPS_CHERCHES_PORTAIL };`
)((b: BonAncien) => b.__fait, (d: string) => d.split("-").reverse().join("/")) as {
  statutClientBC: (b: BonAncien) => { cle: string };
  CHAMPS_CHERCHES_PORTAIL: string[];
};

const camel = (s: string) => (s === "numero_bc" ? "numeroBC" : s.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase()));

describe("parité du suivi client (ESP-02, ESP-03)", () => {
  it("couleur d'un bon et ordre : 2 000 tirages", () => {
    for (let i = 0; i < 2000; i++) {
      const bons = Array.from({ length: 5 }, (_, j) => ({
        id: `b${j}`,
        numero_bc: g.parmi(["CMD-1", "CMD-2", "A-9", ""]),
        travaux_faits: g.parmi([true, false]),
        date_intervention_terminee: g.parmi(["", "2026-09-01"]) || null,
        piece_a_commander: g.parmi([true, false]),
        date_planifiee: g.parmi(["", "2026-10-02"]) || null,
        heure_planifiee: g.parmi(["", "08:30"]) || null,
      }));
      const anciens: BonAncien[] = bons.map((b) => ({
        id: b.id, numeroBC: b.numero_bc, __fait: b.travaux_faits, dateInterventionTerminee: b.date_intervention_terminee ?? "",
        pieceACommander: b.piece_a_commander, datePlanifiee: b.date_planifiee ?? "", heurePlanifiee: b.heure_planifiee ?? "",
      }));
      bons.forEach((b, k) => expect(statutClientBon(b).cle).toBe(ancien.statutClientBC(anciens[k] as BonAncien).cle));
      const ordre = { rouge: 0, jaune: 1, orange: 2, vert: 3 } as Record<string, number>;
      const attendu = [...anciens].sort((a, b) => (ordre[ancien.statutClientBC(a).cle] ?? 0) - (ordre[ancien.statutClientBC(b).cle] ?? 0) || (a.numeroBC || "").localeCompare(b.numeroBC || "")).map((b) => b.id);
      expect(trierBonsClient(bons).map((b) => b.id)).toEqual(attendu);
    }
  });

  it("les 13 champs cherchables sont ceux de l'ancien portail — et aucun champ interne", () => {
    expect(CHAMPS_CHERCHES_PORTAIL.map(camel).sort()).toEqual([...ancien.CHAMPS_CHERCHES_PORTAIL].sort());
    const bon = { numero_bc: "CMD-1", adresse: null, adresse_locataire: "14 rue Garibaldi", code_postal: "69003", ville: "Lyon", numero_logement: "12", etage: null, precision_commune: null, occupant: "M. Martin", ancien_locataire: null, interlocuteur: null, nature_travaux: "Fuite", piece_a_commander_detail: null, notes: "client difficile" };
    expect(chercherBonsClient([bon], "garibaldi martin")).toHaveLength(1);
    // Une note interne ne se sonde pas par la recherche.
    expect(chercherBonsClient([bon], "difficile")).toHaveLength(0);
  });
});
