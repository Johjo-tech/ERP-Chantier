/**
 * Parité de la carte d'un bon (`bonCommandeCardHTML` et ses aides), contre la
 * SOURCE de `app.js` extraite et évaluée : ce que la carte écrit — adresse,
 * locataire, pièce attendue, pastilles, synthèse des filtres — au caractère
 * près. Le HTML de l'ancien est réduit à son texte (balises ôtées, entités
 * décodées), celui que l'œil lit.
 */
import { describe, expect, it } from "vitest";
import * as carte from "../../src/modules/commandes/domain/carte";
import { generateur } from "./aleatoire";
import { sourceDe } from "./source-app";

const g = generateur(6880);
const TIRAGES = 500;

const aides = ["esc", "fmtDate", "withVille", "logementLabel", "logementBadge", "locataireCardLine", "badgeClass", "pieceAttendueLigne", "syntheseListe"].map((n) => sourceDe(n)).join("\n");
const ancien = new Function(`${aides}; return { withVille, logementLabel, logementBadge, locataireCardLine, badgeClass, pieceAttendueLigne, syntheseListe };`)() as Record<string, (...a: unknown[]) => string>;

/** Le texte que l'œil lit dans un fragment de l'ancien HTML. */
const texte = (html: string) => html.replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");

const peutEtre = (valeurs: readonly string[]) => (g.entier(0, 2) === 0 ? null : g.parmi(valeurs));

describe("carte d'un bon — parité avec app.js", () => {
  it("adresse, locataire, logement, statut : au caractère près", () => {
    for (let i = 0; i < TIRAGES; i++) {
      const b = {
        adresse: peutEtre(["14 rue Garibaldi", "3 place Bellecour", "Chemin <du> Moulin & fils"]),
        adresse_locataire: peutEtre(["Bât. C, apt 12", "5 impasse des Lilas"]),
        code_postal: peutEtre(["69003", "69100"]),
        ville: peutEtre(["Lyon", "Villeurbanne"]),
        numero_logement: peutEtre(["12", "3B"]),
        precision_commune: peutEtre(["Cave", "Hall d'entrée"]),
        ancien_locataire: peutEtre(["M. Dupont"]),
        occupant: peutEtre(["Mme Durand", "O'Brien"]),
        logement_statut: g.parmi(["occupé", "vacant", "commune", null] as const),
        statut: g.parmi(["en attente", "en cours", "terminé", "annulé", "brouillon", null]),
      };
      expect(carte.avecVille(b.adresse, b.code_postal, b.ville)).toBe(ancien.withVille?.(b.adresse, b.code_postal, b.ville));
      const legacy = { numeroLogement: b.numero_logement, adresseLocataire: b.adresse_locataire, codePostal: b.code_postal, ville: b.ville, precisionCommune: b.precision_commune, ancienLocataire: b.ancien_locataire, occupant: b.occupant };
      expect(carte.ligneLocataire(b)).toBe(texte(ancien.locataireCardLine?.(legacy) ?? ""));
      expect(carte.libelleLogement(b.logement_statut)).toBe(ancien.logementLabel?.(b.logement_statut));
      if (b.logement_statut) expect(`<span class="badge ${carte.classeLogement(b.logement_statut)}">${carte.libelleLogement(b.logement_statut)}</span>`).toBe(ancien.logementBadge?.(b.logement_statut));
      expect(carte.classeStatut(b.statut)).toBe(ancien.badgeClass?.(b.statut));
    }
  });

  it("la pièce attendue : étape, fournisseur, couleur", () => {
    for (let i = 0; i < TIRAGES; i++) {
      const p = {
        pieceACommander: g.entier(0, 1) === 1,
        description: g.parmi(["", "Mitigeur thermostatique", "Joint <spécial>"]),
        fournisseur: g.parmi(["", "Cedeo", "Point P"]),
        dateCommande: g.parmi(["", "2026-09-20"]),
        // Une date sans heure : l'ancien la découpe, le nouveau la lit à Paris — même jour ici.
        recueLe: g.parmi(["", "2026-09-24"]),
      };
      const html = ancien.pieceAttendueLigne?.({ pieceACommander: p.pieceACommander, pieceACommanderDetail: p.description, pieceACommanderFournisseur: p.fournisseur, pieceACommanderDateCommande: p.dateCommande, pieceRecueLe: p.recueLe }, "card-sub") ?? "";
      const lue = carte.pieceAttendue(p);
      if (!html) {
        expect(lue).toBeNull();
        continue;
      }
      expect(lue?.texte).toBe(texte(html));
      expect(html.includes("#12875A")).toBe(lue?.recue);
    }
  });

  it("la synthèse « 3 bons de commande sur 12. »", () => {
    for (const [r, t, actif] of [[3, 12, true], [1, 12, true], [12, 12, true], [3, 12, false], [0, 5, true]] as const) {
      expect(carte.syntheseListe(r, t, "bon de commande", actif)).toBe(texte(ancien.syntheseListe?.(r, t, "bon de commande", actif) ?? "") || null);
    }
  });
});
