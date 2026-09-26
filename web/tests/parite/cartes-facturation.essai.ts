/**
 * Parité des mots d'une carte de Facturation contre `app.js`, évalué TEL
 * QU'IL EST ÉCRIT : la ligne du locataire, le badge d'échéance, le badge du
 * logement, le mode de paiement et la synthèse « n sur N ».
 */
import { describe, expect, it } from "vitest";
import { montant } from "../../src/lib/money";
import { badgeLogement, delaiBadge, etatCarte, libelleModePaiement, ligneLocataire, syntheseListe } from "../../src/modules/facturation/domain/carte";
import { evaluer, lireAncien, sourceDe } from "./source";

const app = lireAncien("src/pages/app.js");
const esc = (s: unknown) => (s ?? "").toString();
const AUJOURDHUI = "2026-09-25";

const ancien = evaluer<{
  locataireCardLine: (i: Record<string, string>) => string;
  delaiBadgeHTML: (f: { echeance?: string; date: string }, reste: number) => string;
  logementBadge: (s: string) => string;
  libelleModePaiement: (m: string) => string;
  syntheseListe: (r: number, t: number, q: string, a: boolean) => string;
}>(
  [
    sourceDe(app, "function withVille("),
    sourceDe(app, "function locataireCardLine("),
    sourceDe(app, "function joursDepuisEcheance("),
    sourceDe(app, "function delaiBadgeHTML("),
    sourceDe(app, "function logementLabel("),
    sourceDe(app, "function logementBadge("),
    app.slice(app.indexOf("const LIBELLES_MODE_PAIEMENT"), app.indexOf("};", app.indexOf("const LIBELLES_MODE_PAIEMENT")) + 2),
    sourceDe(app, "function libelleModePaiement("),
    sourceDe(app, "function syntheseListe("),
  ],
  ["locataireCardLine", "delaiBadgeHTML", "logementBadge", "libelleModePaiement", "syntheseListe"],
  { esc, todayISO: () => AUJOURDHUI }
);

/** Le texte d'un fragment HTML de l'ancien, balises ôtées. */
const texte = (html: string) => html.replace(/<[^>]+>/g, "");

const LIEUX = [
  {},
  { adresseLocataire: "5 impasse des Lilas", codePostal: "69100", ville: "Villeurbanne" },
  { occupant: "M. Martin", numeroLogement: "12" },
  { occupant: "M. Martin", adresseLocataire: "3 rue X", ville: "Lyon" },
  { ancienLocataire: "Mme Roux", numeroLogement: "4B", adresseLocataire: "1 place Y" },
  { precisionCommune: "Cave", adresseLocataire: "1 place Y", codePostal: "69003" },
  { numeroLogement: "7" },
];

describe("parité — la carte d'une facture", () => {
  it("la ligne du locataire", () => {
    for (const l of LIEUX) {
      const nouveau = ligneLocataire({
        adresse_locataire: l.adresseLocataire ?? null, code_postal: l.codePostal ?? null, ville: l.ville ?? null, occupant: l.occupant ?? null,
        numero_logement: l.numeroLogement ?? null, precision_commune: l.precisionCommune ?? null, ancien_locataire: l.ancienLocataire ?? null,
      });
      expect(nouveau ?? "", JSON.stringify(l)).toBe(texte(ancien.locataireCardLine(l as Record<string, string>)));
    }
  });

  it("le badge d'échéance", () => {
    for (const echeance of ["2026-09-25", "2026-09-01", "2026-10-25", undefined]) {
      for (const reste of [0, 0.01, 0.02, 120]) {
        const f = { echeance: echeance ?? null, date: "2026-08-01" };
        const n = delaiBadge(f, montant(reste), AUJOURDHUI);
        expect(n ? texte(`${n.texte}`) : "", `${echeance} ${reste}`).toBe(texte(ancien.delaiBadgeHTML({ echeance, date: f.date }, reste)));
        if (n) expect(ancien.delaiBadgeHTML({ echeance, date: f.date }, reste)).toContain(`badge ${n.classe}`);
      }
    }
  });

  it("le badge du logement, le mode de paiement, la synthèse", () => {
    for (const s of ["occupé", "vacant", "commune", "", "autre"]) {
      const b = badgeLogement(s);
      expect(b ? `<span class="badge ${b.classe}">${b.libelle}</span>` : "").toBe(ancien.logementBadge(s));
    }
    for (const m of ["virement", "cheque", "especes", "carte", "prelevement", "traite", "autre", "inconnu", ""]) expect(libelleModePaiement(m)).toBe(ancien.libelleModePaiement(m));
    for (const [r, t, a] of [[3, 10, true], [10, 10, true], [1, 4, true], [3, 10, false]] as const) {
      expect(syntheseListe(r, t, "facture", a) ?? "").toBe(texte(ancien.syntheseListe(r, t, "facture", a)));
    }
  });

  it("un brouillon se dit « Non réglée », une pièce reprise « Réglée (reprise) » de tout son TTC — comme l'ancien écran", () => {
    expect(etatCarte({ cle: "brouillon", paye: 0, reste: 495, sens: 1 }, montant(495)).libelle).toBe("Non réglée");
    expect(etatCarte({ cle: "brouillon", paye: 0, reste: 0, sens: 1 }, montant(0)).libelle).toBe("Réglée");
    const reprise = etatCarte({ cle: "reprise", paye: 0, reste: 0, sens: 1 }, montant(120));
    expect([reprise.libelle, reprise.paye.toString()]).toEqual(["Réglée (reprise)", "120"]);
  });
});
