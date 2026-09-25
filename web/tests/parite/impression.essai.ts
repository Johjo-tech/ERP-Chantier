/**
 * Parité des pièces imprimées (D-PDF-01) : la SOURCE même de l'ancien gabarit
 * (`renderPrintDoc`, `renderPrintIntervention` et leurs auxiliaires, extraits
 * de app.js et évalués) contre le port de `documents/impression/`, sur les
 * mêmes données — le HTML doit être identique, à l'espace près.
 *
 * Seul écart admis : un montant CALCULÉ peut différer d'un centime quand
 * l'ancien, qui additionnait des flottants, tombait sur un demi-centime
 * (0,055 € s'écrivait 0,05 €) ; web/ arrondit au bord en décimal exact
 * (D-006). Sur des données sans demi-centime, l'égalité est stricte.
 */
import { describe, expect, it } from "vitest";
import * as ancienAvoir from "../../../src/api/regles-avoir";
import * as ancienEfacture from "../../../src/api/regles-efacture";
import * as ancienTotaux from "../../../src/api/regles-totaux";
import { finDeValidite } from "../../src/modules/devis/domain/validite";
import { renderPrintDoc, type ContexteImpression, type DocImprimable, type SocieteImprimable, type TypeImprimable } from "../../src/modules/documents/impression/gabarit";
import { renderPrintIntervention, type InterventionImprimable } from "../../src/modules/interventions/domain/gabarit-rapport";
import { CONTROLES_PAR_METIER } from "../../src/modules/interventions/domain/rapport";
import { generateur } from "./aleatoire";
import { appJs, constanteDe, sourceDe } from "./source-app";

const FONCTIONS = [
  "money", "fmtDate", "esc", "withVille", "logementLabel", "societeName", "computeTotalsAvecRemise", "computeChapterSubtotals",
  "metierLabel", "metierDisplayLabel", "bcMetiersDuBC", "bcNumeroDepuisId", "sousTotalChapitreHTML", "printableLignesRows",
  "bonCommandeDocMetaLignes", "validiteDevis", "metaDocHTML", "carteChantierHTML", "documentImprimable", "renderPrintDoc",
  "logoHTML", "libelleModePaiement", "blocTotauxHTML", "factureDocMetaLignes", "blocReglementHTML", "blocMentionsHTML",
  "piedDePageHTML", "renderPrintIntervention",
];
const CONSTANTES = ["METIERS", "CONTROLES_PAR_METIER", "LIBELLES_MODE_PAIEMENT"];

interface Etat {
  societeId: string;
  settings: Record<string, SocieteImprimable>;
  devis: Record<string, unknown>[];
  factures: Record<string, unknown>[];
  bonsCommande: Record<string, unknown>[];
}

interface Ancien {
  renderPrintDoc: (type: TypeImprimable, id: string, hidePrices?: boolean) => string;
  renderPrintIntervention: (it: object) => string;
}

const SOCIETE = { id: "soc-alpha", nom: "ALPHA" };

/**
 * Le correctif 4f129c7 de l'ancien (« un brouillon dit qu'il n'est pas émis »),
 * publié sur main après la version d'où cette branche est partie : tant que
 * l'arbre porte l'ancienne ligne, on l'applique à l'extrait — mot pour mot le
 * diff du commit —, pour comparer au comportement de référence d'aujourd'hui.
 */
const AVANT_4F129C7 = "const l = [['Numéro', esc(doc.numero)], [\"Date d'émission\", fmtDate(doc.date)]];";
const APRES_4F129C7 = `const numero = String(doc.numero || '').trim();
  const l = [
    [numero? 'Numéro' : 'État', numero? esc(numero) : 'Brouillon — non émis'],
    ["Date d'émission", fmtDate(doc.date)],
  ];`;

function sourceDeReference(nom: string): string {
  const source = sourceDe(nom);
  return nom === "metaDocHTML" ? source.replace(AVANT_4F129C7, APRES_4F129C7) : source;
}

/** L'ancien écran, reconstitué autour de SA source : globales `state`, `SOCIETES`, `window`. */
function ancienEcran(etat: Etat, validiteDevisJours: number): Ancien {
  const source = [...CONSTANTES.map((c) => constanteDe(c)), ...FONCTIONS.map((f) => sourceDeReference(f))];
  const window = { ...ancienTotaux, ...ancienEfacture, libelleDocument: ancienAvoir.libelleDocument };
  const reglagesCourants = () => ({ documents: { validiteDevisJours } });
  return new Function("state", "SOCIETES", "window", "reglagesCourants", `${source.join("\n")}\nreturn { renderPrintDoc, renderPrintIntervention };`)(
    etat,
    [SOCIETE],
    window,
    reglagesCourants
  ) as Ancien;
}

const g = generateur(40927);
const peutEtre = <T>(v: T): T | "" | null => g.parmi([v, v, null, ""]);

function societe(): SocieteImprimable {
  const perso = g.parmi(["", "", "Pied maison — SAS au capital de 10 000 €"]);
  return {
    raisonSocialeLegale: peutEtre("ALPHA Rénovation SAS"),
    formeJuridique: peutEtre("SAS"),
    adresse: peutEtre("12 rue des Lilas"),
    codePostal: peutEtre("69003"),
    ville: peutEtre("Lyon"),
    telephone: peutEtre("04 72 00 00 00"),
    email: peutEtre("contact@alpha.fr"),
    siret: peutEtre("73282932000074"),
    siren: peutEtre("732829320"),
    tvaIntracom: peutEtre("FR44732829320"),
    capitalSocial: g.parmi(["", 0, 10000, 150000]),
    rcsNumero: peutEtre("732829320"),
    rcsVille: peutEtre("Lyon"),
    codeNaf: peutEtre("43.22A"),
    iban: peutEtre("FR76 3000 6000 0112 3456 7890 189"),
    bic: peutEtre("AGRIFRPP"),
    logo: g.parmi([null, "data:image/png;base64,iVBORw0KGgo="]),
    reglages: {
      documents: {
        afficherIban: g.parmi([true, false]),
        conditionsDevis: g.parmi(["", "Acompte de 30 % à la commande."]),
        mentionsComplementaires: g.parmi(["", "Garantie décennale AXA n° 123."]),
        piedDePage: perso,
        siteWeb: g.parmi(["", " alpha.fr "]),
      },
    },
  };
}

/** Des montants « sages » (sans demi-centime) ou quelconques, selon le tirage. */
function lignes(sages: boolean) {
  const n = g.entier(0, 12);
  return Array.from({ length: n }, (_, i) => {
    const type = g.parmi(["ligne", "ligne", "ligne", "chapitre", "commentaire", ""]);
    return {
      type,
      designation: g.parmi([`Poste ${i} <fenêtre> & « volets »`, "Peinture O'Neil", "Plomberie — 2e étage"]),
      qte: sages ? g.entier(0, 12) : g.parmi([1, 2.5, 0.75, 3, 12.345]),
      unite: g.parmi(["u", "m²", "", "ml"]),
      prixUnitaire: sages ? g.entier(0, 400) : g.parmi([0, 12.33, 99.99, 1.005, 250]),
      tva: sages ? g.parmi([0, 10, 20]) : g.parmi([0, 5.5, 10, 20]),
    };
  });
}

function lieu(): DocImprimable {
  return {
    numeroLogement: peutEtre("12"),
    occupant: peutEtre("Mme Dupont"),
    telephoneLocataire: peutEtre("06 11 22 33 44"),
    ancienLocataire: peutEtre("M. Martin"),
    adresseLocataire: peutEtre("14 rue Garibaldi"),
    codePostal: peutEtre("69003"),
    ville: peutEtre("Lyon"),
    logementStatut: g.parmi([null, "", "occupé", "vacant", "commune"]),
    etage: peutEtre("2"),
    precisionCommune: peutEtre("Hall B"),
  };
}

/** Un document au format de l'ancien, et l'état qui l'entoure. */
function tirage(sages: boolean) {
  const type = g.parmi<TypeImprimable>(["devis", "facture", "bonCommande"]);
  const s = societe();
  const commun = {
    id: "doc-1",
    ...lieu(),
    date: g.parmi(["2026-09-15", "2026-01-31"]),
    client: g.parmi(["OPAC du Rhône", "Régie <Sud>"]),
    adresse: peutEtre("1 place Bellecour"),
    interlocuteur: peutEtre("M. Chargé"),
    lignes: lignes(sages),
    remisePourcentage: sages ? g.parmi([0, 0, 10]) : g.parmi([0, 5, 12.5, 150, -3]),
  };
  const etat: Etat = { societeId: SOCIETE.id, settings: { [SOCIETE.id]: s }, devis: [{ id: "dev-0", numero: "DEV-2026-000003" }], factures: [{ id: "fac-0", numero: "FAC-2026-000009", date: "2026-01-02" }], bonsCommande: [] };
  let doc: Record<string, unknown>;
  if (type === "devis") {
    doc = { ...commun, numero: "DEV-2026-900001" };
    etat.devis.push(doc);
  } else if (type === "facture") {
    doc = {
      ...commun,
      numero: peutEtre("FAC-2026-000010"),
      typeDocument: g.parmi(["facture", "avoir", "acompte"]),
      clientSiret: peutEtre("27380003700015"),
      clientTvaIntracom: peutEtre("FR9"),
      refBonCommandeClient: peutEtre("CMD-OPAC-7781"),
      dateFinExecution: g.parmi([null, "", "2026-09-15", "2026-09-10"]),
      acomptesDeduits: sages ? g.parmi([0, 100]) : g.parmi([0, 100, 33.33, -5]),
      retenueGarantiePourcentage: sages ? g.parmi([null, 0, 10]) : g.parmi([null, 0, 5, 7.5]),
      emetteurNom: peutEtre("ALPHA FIGÉE"),
      emetteurAdresse: peutEtre("9 rue Figée"),
      emetteurCodePostal: peutEtre("69001"),
      emetteurVille: peutEtre("Lyon"),
      emetteurSiret: peutEtre("11111111111111"),
      emetteurTvaIntracom: peutEtre("FR00111111111"),
      emetteurIban: peutEtre("FR76 FIGÉ"),
      echeance: peutEtre("2026-10-15"),
      conditionsReglement: peutEtre("30 jours net"),
      modePaiement: g.parmi([null, "virement", "cheque", "especes", "carte", "prelevement", "traite", "autre", "inconnu"]),
      refMarche: peutEtre("M-2026-4"),
      motifRectification: peutEtre("Double facturation"),
      devisId: g.parmi([null, "dev-0", "dev-absent"]),
      factureRectifieeId: g.parmi([null, "fac-0"]),
    };
    etat.factures.push(doc);
  } else {
    doc = {
      ...commun,
      numeroInterne: peutEtre("BC-2026-900001"),
      numeroBC: peutEtre("CMD-OPAC-7781"),
      dateReception: peutEtre("2026-09-12"),
      conducteur: peutEtre("Christophe"),
      metiers: g.parmi([[], ["plomberie", "PEINTURE"], ["etancheite"]]),
      metier: g.parmi(["", "electricite"]),
    };
    etat.bonsCommande.push(doc);
  }
  return { type, s, etat, doc, masquer: g.parmi([false, false, true]), validiteJours: g.parmi([0, 30, 45]) };
}

/** Le contexte que web/ fabrique : ce que l'ancien allait chercher dans `state` ou `window`. */
function contexteWeb(t: ReturnType<typeof tirage>): ContexteImpression {
  const d = t.doc as DocImprimable & Record<string, unknown>;
  const base = { type: t.type, s: t.s, nomSociete: SOCIETE.nom, masquerPrix: t.masquer };
  if (t.type === "devis") {
    const fin = d.date ? finDeValidite(d.date, t.validiteJours) : null;
    return { ...base, titre: "DEVIS", doc: d, validite: fin ? { jours: t.validiteJours, date: fin } : null };
  }
  if (t.type === "facture") {
    const devis = t.etat.devis.find((x) => x.id === d.devisId) as { numero: string } | undefined;
    const rect = t.etat.factures.find((x) => x.id === d.factureRectifieeId) as { numero: string; date: string } | undefined;
    return {
      ...base,
      titre: ancienAvoir.libelleDocument(d.typeDocument as ancienAvoir.TypeDocument),
      doc: d,
      devisNumero: devis?.numero ?? null,
      rectifiee: rect ?? null,
      mentions: ancienEfacture.mentionsLegales(t.s as ancienEfacture.MentionsEmetteur),
    };
  }
  const metiers = (Array.isArray(d.metiers) && d.metiers.length ? d.metiers : [d.metier].filter(Boolean)) as string[];
  const labels: Record<string, string> = { plomberie: "Plomberie", electricite: "Électricité", etancheite: "Étanchéité" };
  return {
    ...base,
    titre: "BON DE COMMANDE",
    doc: { ...d, numero: (d.numeroInterne as string) || (d.numeroBC as string) || "", date: (d.dateReception as string) || d.date },
    metiers: metiers.map((m) => labels[m] || m).filter(Boolean),
  };
}

/* Un montant de l'ancien (Intl fr-FR, espaces fines insécables) — ou « ••• » en mode sans prix. */
const MONTANT = /-?\d{1,3}(?:[\u202F\u00A0]\d{3})*,\d{2}\u00A0\u20AC/g;
const enNombre = (m: string) => Number(m.replace(/[\u202F\u00A0\u20AC]/g, "").replace(",", "."));

/** Le HTML, montants remplacés par un repère, et les montants à part. */
function separer(html: string): { gabarit: string; montants: number[] } {
  return { gabarit: html.replace(MONTANT, "#"), montants: (html.match(MONTANT) ?? []).map(enNombre) };
}

describe("parité du gabarit des pièces commerciales (renderPrintDoc)", () => {
  it("données sans demi-centime : HTML strictement identique (2 000 tirages)", () => {
    for (let i = 0; i < 2000; i++) {
      const t = tirage(true);
      const ancien = ancienEcran(t.etat, t.validiteJours).renderPrintDoc(t.type, "doc-1", t.masquer);
      expect(ancien).toContain('<div class="p-page p-doc">');
      expect(renderPrintDoc(contexteWeb(t)), `tirage ${i} (${t.type})`).toBe(ancien);
    }
  });

  it("données quelconques : même gabarit, montants à un centime près au plus (2 000 tirages, D-006)", () => {
    let ecarts = 0;
    for (let i = 0; i < 2000; i++) {
      const t = tirage(false);
      const ancien = separer(ancienEcran(t.etat, t.validiteJours).renderPrintDoc(t.type, "doc-1", t.masquer));
      const nouveau = separer(renderPrintDoc(contexteWeb(t)));
      expect(nouveau.gabarit, `tirage ${i} (${t.type})`).toBe(ancien.gabarit);
      expect(nouveau.montants.length).toBe(ancien.montants.length);
      nouveau.montants.forEach((m, k) => {
        const ecart = Math.abs(m - (ancien.montants[k] ?? NaN));
        expect(ecart, `tirage ${i}, montant ${k}`).toBeLessThanOrEqual(0.0100001);
        if (ecart > 0) ecarts++;
      });
    }
    // L'écart existe bien (sinon ce test ne prouverait rien) et reste rare.
    expect(ecarts).toBeGreaterThan(0);
  });
});

describe("parité du rapport d'intervention (renderPrintIntervention)", () => {
  it("HTML strictement identique (1 000 tirages)", () => {
    for (let i = 0; i < 1000; i++) {
      const s = societe();
      const metier = g.parmi(["plomberie", "electricite", "etancheite"] as const);
      const points = CONTROLES_PAR_METIER[metier];
      const it: InterventionImprimable & { typePanne: string; bonCommandeId: string | null } = {
        ...lieu(),
        typePanne: metier,
        numero: peutEtre("RI-2026-000004"),
        date: g.parmi(["2026-09-15", ""]),
        heure: peutEtre("09:30"),
        client: "OPAC <du> Rhône",
        interlocuteur: peutEtre("M. Chargé"),
        adresse: peutEtre("1 place Bellecour"),
        controles: Object.fromEntries(points.map((p) => [p.cle, g.parmi([true, false])])),
        controleAutreTexte: peutEtre("Vanne d'arrêt"),
        rapport: { constatations: peutEtre("Fuite\nsous l'évier"), preconisations: peutEtre("Remplacer le siphon x2") },
        photos: g.parmi([[], [{ dataUrl: "data:image/png;base64,AAA" }, { dataUrl: "data:image/png;base64,BBB" }]]),
        signature: peutEtre("data:image/png;base64,SIG"),
        signatureTechnicien: peutEtre("data:image/png;base64,TEC"),
        bonCommandeId: g.parmi([null, "bc-1", "bc-absent"]),
      };
      const etat: Etat = { societeId: SOCIETE.id, settings: { [SOCIETE.id]: s }, devis: [], factures: [], bonsCommande: [{ id: "bc-1", numeroBC: peutEtre("CMD-7781") }] };
      const ancien = ancienEcran(etat, 30).renderPrintIntervention(it);
      expect(ancien).toContain("RAPPORT D'INTERVENTION");
      const bcNumero = it.bonCommandeId ? String((etat.bonsCommande.find((b) => b.id === it.bonCommandeId) as { numeroBC?: string } | undefined)?.numeroBC || "") : undefined;
      const nouveau = renderPrintIntervention({ it, s, nomSociete: SOCIETE.nom, bcNumero, controlesDuMetier: points.map((p) => ({ key: p.cle, label: p.libelle })) });
      expect(nouveau, `tirage ${i}`).toBe(ancien);
    }
  });

  it("les points de contrôle de web/ sont ceux de l'ancien, dans le même ordre", () => {
    const ancien = new Function(`${constanteDe("CONTROLES_PAR_METIER")}\nreturn CONTROLES_PAR_METIER;`)() as Record<string, { key: string; label: string }[]>;
    for (const [metier, points] of Object.entries(CONTROLES_PAR_METIER)) expect(points.map((p) => ({ key: p.cle, label: p.libelle }))).toEqual(ancien[metier]);
  });
});

describe("la feuille des pièces est celle de l'ancien", () => {
  it("impression.css recopie mot pour mot le gabarit .p-* de index.html", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const ancienne = readFileSync(join(import.meta.dirname, "../../../src/pages/index.html"), "utf8").split("\n");
    const copie = readFileSync(join(import.meta.dirname, "../../src/modules/documents/impression/impression.css"), "utf8");
    const bloc = ancienne.slice(1362, 1639).join("\n");
    expect(bloc.startsWith("#printArea{")).toBe(true);
    expect(copie).toContain(bloc);
  });

  it("le gabarit n'a pas bougé dans app.js depuis le port (sinon : reporter, puis régénérer)", () => {
    expect(appJs).toContain("function renderPrintDoc(type, id, hidePrices, lignesOverride){");
    expect(sourceDeReference("metaDocHTML")).toContain("'Brouillon — non émis'");
  });

  it("un brouillon (sans numéro) dit qu'il n'est pas émis, au lieu d'un « Numéro » vide (4f129c7)", () => {
    for (let i = 0; i < 200; i++) {
      const t = tirage(true);
      t.doc.numero = g.parmi([null, "", "   "]);
      if (t.type === "bonCommande") Object.assign(t.doc, { numeroInterne: null, numeroBC: g.parmi([null, ""]) });
      const ancien = ancienEcran(t.etat, t.validiteJours).renderPrintDoc(t.type, "doc-1", t.masquer);
      const nouveau = renderPrintDoc(contexteWeb(t));
      expect(nouveau).toBe(ancien);
      expect(nouveau).toContain("<dt>État</dt><dd>Brouillon — non émis</dd>");
    }
  });
});
