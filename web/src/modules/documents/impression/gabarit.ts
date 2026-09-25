/**
 * Le HTML des pièces commerciales — PORT LITTÉRAL de l'application historique
 * (`src/pages/app.js`, commit 6f6ac74 : `renderPrintDoc` l. 4032 et ses
 * auxiliaires l. 3616-4282). Mêmes balises, mêmes classes, mêmes libellés, au
 * caractère près : c'est ce HTML que `impression.css` (copie verbatim de la
 * feuille) met en page, à l'écran comme dans le PDF (D-PDF-01).
 *
 * Seules différences, toutes d'ENTRÉE et non de rendu :
 *  - les globales (`state`, `window.*`) deviennent des paramètres ;
 *  - les montants CALCULÉS (totaux, TVA, sous-totaux, net) viennent de
 *    `domain/totaux` en décimal exact et s'arrondissent au bord (D-006) —
 *    l'ancien additionnait des flottants ; l'écart ne se voit qu'aux demi-
 *    centimes pathologiques (tests/parite/impression.essai.ts) ;
 *  - les mentions légales arrivent déjà composées (règle corrigée gardée).
 *
 * La parité est vérifiée en évaluant la source même de l'ancien sur les mêmes
 * données (tests/parite/impression.essai.ts) : une retouche de l'ancien gabarit
 * fait échouer le test au lieu de laisser diverger celui-ci.
 */
import Big from "big.js";
import { formatEuros, montant, type Montant } from "@/lib/money";
import { identifiantsLegaux } from "../domain/identite";
import { montantLigneHt, soldeAPayer, sousTotauxChapitres, totauxDocument } from "../domain/totaux";

/** Une ligne telle que l'ancien la portait (html-adapter.ts : `qte`, `prixUnitaire`). */
export interface LigneImprimable {
  type?: string | null;
  designation?: string | null;
  qte?: number | string | null;
  unite?: string | null;
  prixUnitaire?: number | string | null;
  tva?: number | string | null;
  /** Pré-facture : ce qui a été ajouté en cours de chantier (`p-ajout`) et son badge. */
  classe?: string | null;
  badge?: string | null;
}

/** Le document, sous les noms de champ de l'ancien écran. */
export interface DocImprimable {
  numero?: string | null;
  date?: string | null;
  client?: string | null;
  adresse?: string | null;
  clientSiret?: string | null;
  clientTvaIntracom?: string | null;
  interlocuteur?: string | null;
  numeroLogement?: string | null;
  occupant?: string | null;
  telephoneLocataire?: string | null;
  ancienLocataire?: string | null;
  adresseLocataire?: string | null;
  codePostal?: string | null;
  ville?: string | null;
  logementStatut?: string | null;
  etage?: string | null;
  precisionCommune?: string | null;
  refBonCommandeClient?: string | null;
  dateFinExecution?: string | null;
  lignes?: LigneImprimable[] | null;
  remisePourcentage?: number | string | null;
  acomptesDeduits?: number | string | null;
  retenueGarantiePourcentage?: number | string | null;
  emetteurNom?: string | null;
  emetteurAdresse?: string | null;
  emetteurCodePostal?: string | null;
  emetteurVille?: string | null;
  emetteurSiret?: string | null;
  emetteurTvaIntracom?: string | null;
  emetteurIban?: string | null;
  echeance?: string | null;
  conditionsReglement?: string | null;
  modePaiement?: string | null;
  refMarche?: string | null;
  motifRectification?: string | null;
  /** Bon de commande. */
  numeroBC?: string | null;
  conducteur?: string | null;
}

/** Les réglages d'impression (`reglages.documents` de l'ancien). */
export interface ReglagesDocuments {
  afficherIban?: boolean;
  conditionsDevis?: string | null;
  mentionsComplementaires?: string | null;
  piedDePage?: string | null;
  siteWeb?: string | null;
}

/**
 * `state.settings[societe]` de l'ancien : colonnes de `societes` puis le JSON
 * libre qui les recouvre (`lireSettings`, html-adapter.ts).
 */
export interface SocieteImprimable {
  raisonSocialeLegale?: string | null;
  formeJuridique?: string | null;
  adresse?: string | null;
  codePostal?: string | null;
  ville?: string | null;
  telephone?: string | null;
  email?: string | null;
  siret?: string | null;
  siren?: string | null;
  tvaIntracom?: string | null;
  capitalSocial?: number | string | null;
  rcsNumero?: string | null;
  rcsVille?: string | null;
  codeNaf?: string | null;
  iban?: string | null;
  bic?: string | null;
  logo?: string | null;
  reglages?: { documents?: ReglagesDocuments } | null;
}

export type TypeImprimable = "devis" | "facture" | "bonCommande";

/** Ce que l'ancien allait chercher dans `state` ou sur `window`. */
export interface ContexteImpression {
  type: TypeImprimable;
  /** « DEVIS », « FACTURE », « AVOIR », « FACTURE D'ACOMPTE », « BON DE COMMANDE ». */
  titre: string;
  doc: DocImprimable;
  s: SocieteImprimable;
  /** `societeName(state.societeId)` : le nom d'usage de la société. */
  nomSociete: string;
  /** Mode discret / pré-facture sans prix : « ••• » à la place des montants. */
  masquerPrix?: boolean;
  lignesRemplacees?: LigneImprimable[] | null;
  /** Devis : `validiteDevis(doc)` (date déjà calculée par `dateEcheance`). */
  validite?: { jours: number; date: string } | null;
  /** Facture : le numéro du devis d'origine (`factureDocMetaLignes`). */
  devisNumero?: string | null;
  /** Avoir : la facture rectifiée. */
  rectifiee?: { numero: string | null; date: string | null } | null;
  /** Bon de commande : ses métiers, déjà en libellés (`metierDisplayLabel`). */
  metiers?: string[];
  /** `window.mentionsLegales(s)` : lues seulement pour une facture. */
  mentions?: string[];
}

/* ── Formats de l'ancien (app.js l. 625, 800, 834) ─────────────────────── */

const euros = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });

/** `money(n)` : une valeur SAISIE (prix unitaire), formatée telle que l'ancien la formatait. */
function money(n: number | string | null | undefined): string {
  return euros.format(Number(n) || 0);
}

/** Un montant CALCULÉ, arrondi au bord (D-006). */
const argent = (m: Montant) => formatEuros(m);

export function fmtDate(d: string | null | undefined): string {
  if (!d) return "—";
  const p = d.split("-");
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : d;
}

const ECHAPPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

export function esc(s: unknown): string {
  return (s === undefined || s === null ? "" : String(s)).replace(/[&<>"']/g, (c) => ECHAPPES[c] ?? c);
}

export function withVille(adresse: string | null | undefined, cp: string | null | undefined, ville: string | null | undefined): string {
  const cpVille = [cp, ville].filter(Boolean).join(" ");
  return [adresse, cpVille].filter(Boolean).join(", ");
}

export function logementLabel(statut: string | null | undefined): string {
  if (statut === "occupé") return "Logement occupé";
  if (statut === "vacant") return "Logement vacant";
  if (statut === "commune") return "Partie commune";
  return "";
}

/** `METIERS` (app.js l. 121) : les trois métiers de base, qui ont un libellé accentué. */
const METIERS = [
  { value: "plomberie", label: "Plomberie" },
  { value: "electricite", label: "Électricité" },
  { value: "etancheite", label: "Étanchéité" },
];

/** `metierDisplayLabel` (app.js l. 2880) : le libellé d'un métier de base, sinon le nom tel quel. */
export function metierDisplayLabel(value: string | null | undefined): string {
  if (!value) return "";
  return METIERS.find((m) => m.value === value)?.label || value;
}

/** `window.formaterTaux` (regles-totaux.ts) : « 5,5 % ». */
function formaterTaux(taux: Montant | number): string {
  return `${String(Number(taux.toString())).replace(".", ",")} %`;
}

/** Les champs de ligne de l'ancien, lus par les règles de calcul de web/. */
const versMontant = (l: LigneImprimable) => ({ type: l.type ?? null, quantite: l.qte ?? null, prix_unitaire: l.prixUnitaire ?? null, tva: l.tva ?? null });

/* ── Lignes (app.js l. 3616-3645) ──────────────────────────────────────── */

type Formateur = (m: Montant | number | string | null | undefined) => string;

function sousTotalChapitreHTML(total: Montant, fmt: Formateur): string {
  return `<td class="st">Total HT</td><td class="stv">${fmt(total)}</td>`;
}

export function printableLignesRows(lignes: readonly LigneImprimable[] | null | undefined, hidePrices?: boolean): string {
  const fmt: Formateur = hidePrices ? () => "•••" : (m) => (m instanceof Big ? argent(m) : money(m));
  const sousTotaux = sousTotauxChapitres((lignes ?? []).map(versMontant));
  let html = "";
  let chap = 0;
  (lignes ?? []).forEach((l) => {
    const t = l.type || "ligne";
    // `classe` et `badge` marquent ce qui a été ajouté en cours de chantier
    const cls = l.classe ? " " + esc(l.classe) : "";
    const badge = l.badge ? `<span class="p-badge-origine">${esc(l.badge)}</span> ` : "";
    if (t === "chapitre") {
      html += `<tr class="p-chapitre${cls}"><td colspan="4">${esc(l.designation)}</td>${sousTotalChapitreHTML(sousTotaux[chap++] ?? montant(0), fmt)}</tr>`;
    } else if (t === "commentaire") {
      html += `<tr class="p-comment${cls}"><td colspan="6">${badge}${esc(l.designation)}</td></tr>`;
    } else {
      const sansPrix = !(parseFloat(String(l.prixUnitaire)) > 0) ? " p-sans-prix" : "";
      html += `<tr class="${(cls + sansPrix).trim()}"><td>${badge}${esc(l.designation)}</td><td class="num">${String(l.qte)}</td><td class="unite">${esc(l.unite || "u")}</td><td class="num">${fmt(l.prixUnitaire)}</td><td class="num">${fmt(montantLigneHt(versMontant(l)))}</td><td class="num">${String(l.tva)}%</td></tr>`;
    }
  });
  return html;
}

/* ── En-tête (app.js l. 3931-3977) ─────────────────────────────────────── */

function bonCommandeDocMetaLignes(b: DocImprimable, metiers: readonly string[]): [string, string][] {
  const l: ([string, string] | null)[] = [
    b.numeroBC ? ["Réf. client", esc(b.numeroBC)] : null,
    b.conducteur ? ["Conducteur", esc(b.conducteur)] : null,
    metiers.length ? ["Métiers", esc(metiers.join(", "))] : null,
  ];
  return l.filter((x): x is [string, string] => x !== null);
}

function factureDocMetaLignes(doc: DocImprimable, c: ContexteImpression): [string, string][] {
  const rect = c.rectifiee;
  const l: ([string, string] | null)[] = [
    c.devisNumero ? ["Devis", esc(c.devisNumero)] : null,
    doc.refMarche ? ["Marché", esc(doc.refMarche)] : null,
    rect && rect.numero ? ["Rectifie la facture", esc(rect.numero) + " du " + fmtDate(rect.date)] : null,
    doc.motifRectification ? ["Motif", esc(doc.motifRectification)] : null,
  ];
  return l.filter((x): x is [string, string] => x !== null);
}

function metaDocHTML(c: ContexteImpression, doc: DocImprimable): string {
  const l: [string, string][] = [["Numéro", esc(doc.numero)], ["Date d'émission", fmtDate(doc.date)]];
  if (c.type === "devis") {
    const v = c.validite;
    if (v) {
      l.push(["Valable jusqu'au", fmtDate(v.date)]);
      l.push(["Durée de validité", `${v.jours} jours`]);
    }
  }
  if (c.type === "facture" && doc.echeance) l.push(["Date d'échéance", fmtDate(doc.echeance)]);
  if (c.type === "facture") l.push(...factureDocMetaLignes(doc, c));
  if (c.type === "bonCommande") l.push(...bonCommandeDocMetaLignes(doc, c.metiers ?? []));
  return l.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join("");
}

/* ── Carte du chantier (app.js l. 3985-4011) ───────────────────────────── */

export function carteChantierHTML(doc: DocImprimable): string {
  const lieu = [
    doc.numeroLogement ? "Logement n° " + esc(doc.numeroLogement) : "",
    doc.occupant ? "<b>" + esc(doc.occupant) + "</b>" : "",
    doc.telephoneLocataire ? "☎ " + esc(doc.telephoneLocataire) : "",
    doc.ancienLocataire ? "Ancien locataire : " + esc(doc.ancienLocataire) : "",
    esc(withVille(doc.adresseLocataire, doc.codePostal, doc.ville)),
    [doc.logementStatut ? esc(logementLabel(doc.logementStatut)) : "", doc.etage ? "Étage " + esc(doc.etage) : ""].filter(Boolean).join(" — "),
    doc.precisionCommune ? esc(doc.precisionCommune) : "",
  ]
    .filter(Boolean)
    .join("<br>");
  const refs = (
    [
      doc.refBonCommandeClient ? ["Votre bon de commande", esc(doc.refBonCommandeClient)] : null,
      doc.dateFinExecution && doc.dateFinExecution !== doc.date ? ["Travaux achevés le", fmtDate(doc.dateFinExecution)] : null,
    ] as ([string, string] | null)[]
  ).filter((x): x is [string, string] => x !== null);
  if (!lieu && !refs.length) return "<div></div>";
  return `<div class="p-carte"><div class="p-carte-titre">Adresse du chantier</div>${lieu ? `<div class="p-line">${lieu}</div>` : ""}${refs.length ? `<dl class="p-carte-refs">${refs.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join("")}</dl>` : ""}</div>`;
}

/* ── Logo, règlement, totaux, mentions, pied (app.js l. 4126-4282) ─────── */

export function logoHTML(s: SocieteImprimable | null | undefined): string {
  return s && s.logo ? `<img class="p-logo" src="${esc(s.logo)}" alt="">` : "";
}

const LIBELLES_MODE_PAIEMENT: Record<string, string> = {
  virement: "virement", cheque: "chèque", especes: "espèces", carte: "carte bancaire",
  prelevement: "prélèvement", traite: "traite", autre: "tout moyen convenu",
};

export function libelleModePaiement(mode: string | null | undefined): string {
  return LIBELLES_MODE_PAIEMENT[mode ?? ""] ?? "virement";
}

function blocTotauxHTML(doc: DocImprimable, lignes: readonly LigneImprimable[], fmt: Formateur): string {
  const t = totauxDocument(lignes.map(versMontant), doc.remisePourcentage ?? 0);
  const v = t.ventilation;
  const kv = (l: string, x: string, c?: string) => `<div class="p-kv${c || ""}"><span>${l}</span><em>${x}</em></div>`;
  const solde = soldeAPayer(t.ttc, doc.acomptesDeduits, doc.retenueGarantiePourcentage);
  const unique = v.length === 1 ? v[0] : undefined;
  return (
    (v.length > 1
      ? `<div class="p-tva-detail"><b>Détail TVA</b>${v.map((pa) => kv(`TVA ${formaterTaux(pa.taux)} sur ${argent(pa.base)}`, fmt(pa.montant))).join("")}${kv("Total TVA", fmt(t.tva), " somme")}</div>`
      : "") +
    kv("Total HT", fmt(t.htAvant)) +
    (t.remisePct.gt(0) ? kv(`Remise (${Number(t.remisePct.toString())} %)`, "-" + fmt(t.remiseMontantHT)) : "") +
    kv(unique ? `Total TVA ${formaterTaux(unique.taux)}` : "Total TVA", fmt(t.tva)) +
    kv("Total TTC", fmt(t.ttc), " p-ttc") +
    (solde.acomptes.gt(0) ? kv("Acompte déjà versé", "-" + fmt(solde.acomptes)) : "") +
    (solde.retenueMontant.gt(0) ? kv(`Retenue de garantie (${formaterTaux(solde.retenuePourcentage)})`, "-" + fmt(solde.retenueMontant)) : "") +
    kv("Net à payer", fmt(solde.netAPayer), " p-net")
  );
}

interface Emetteur {
  nom: string;
  adresse: string | null | undefined;
  codePostal: string | null | undefined;
  ville: string | null | undefined;
  siret: string | null | undefined;
  tva: string | null | undefined;
  telephone: string | null | undefined;
  email: string | null | undefined;
  iban: string | null | undefined;
}

function blocReglementHTML(type: TypeImprimable, doc: DocImprimable, s: SocieteImprimable, em: Emetteur, hidePrices: boolean): string {
  const r = s.reglages?.documents ?? {};
  const iban = em.iban || s.iban;
  const avecIban = r.afficherIban !== false && !hidePrices && (iban || s.bic);
  const conditions = (type === "devis" ? r.conditionsDevis || "" : doc.conditionsReglement || "").trim();
  const echeance = type === "facture" && doc.echeance ? `<div>Échéance : <span>${fmtDate(doc.echeance)}</span></div>` : "";
  if (!avecIban && !conditions && !echeance) return "<div></div>";
  const mode = libelleModePaiement(type === "devis" ? null : doc.modePaiement);
  return (
    `<div class="p-reglement"><b>Pour votre règlement</b>` +
    (avecIban && iban ? `<div>IBAN : <span>${esc(iban)}</span></div>` : "") +
    (avecIban && s.bic ? `<div>BIC : <span>${esc(s.bic)}</span></div>` : "") +
    echeance +
    (conditions ? `<div>${esc(conditions)}</div>` : `<div>Règlement par ${esc(mode)}</div>`) +
    `</div>`
  );
}

function blocMentionsHTML(type: TypeImprimable, s: SocieteImprimable, mentions: readonly string[]): string {
  if (type !== "facture") return "";
  const complement = (s.reglages?.documents?.mentionsComplementaires || "").trim();
  if (!mentions.length && !complement) return "";
  return `<div class="p-mentions">${esc(mentions.join(" "))}${complement ? " " + esc(complement) : ""}</div>`;
}

export function piedDePageHTML(em: { nom: string; siret: string | null | undefined; tva: string | null | undefined; adresse: string | null | undefined }, s: SocieteImprimable): string {
  const capital = s.capitalSocial == null || s.capitalSocial === "" ? null : Number(s.capitalSocial);
  const identifiants = identifiantsLegaux({ ...s, capitalSocial: capital, siret: em.siret ?? null, tvaIntracom: em.tva ?? null });
  const perso = (s.reglages?.documents?.piedDePage || "").trim();
  if (perso) return perso;
  return [em.nom, ...identifiants, em.adresse].filter(Boolean).join(" — ");
}

/* ── La pièce (app.js l. 4032-4118) ────────────────────────────────────── */

export function renderPrintDoc(c: ContexteImpression): string {
  const { type, doc, s } = c;
  const hidePrices = !!c.masquerPrix;
  const lignes = c.lignesRemplacees || doc.lignes || [];
  const fmt: Formateur = hidePrices ? () => "•••" : (m) => (m instanceof Big ? argent(m) : money(m));
  const title = c.titre;

  const em: Emetteur = {
    nom: doc.emetteurNom || s.raisonSocialeLegale || c.nomSociete,
    adresse: doc.emetteurAdresse || s.adresse,
    codePostal: doc.emetteurCodePostal || s.codePostal,
    ville: doc.emetteurVille || s.ville,
    siret: doc.emetteurSiret || s.siret,
    tva: doc.emetteurTvaIntracom || s.tvaIntracom,
    telephone: s.telephone,
    email: s.email,
    iban: doc.emetteurIban || s.iban,
  };
  const r = s.reglages?.documents ?? {};
  const fisc = [em.siret ? `<b>Siret</b> ${esc(em.siret)}` : "", s.codeNaf ? `<b>APE</b> ${esc(s.codeNaf)}` : ""].filter(Boolean).join(" · ");
  const logo = logoHTML(s);
  return `
    <div class="p-page p-doc">
    <div class="p-entete-grille${logo ? "" : " p-sans-logo"}">
      ${logo ? `<div class="p-logo-case">${logo}</div>` : ""}
      <div class="p-emetteur">
        <div class="p-emetteur-nom">${esc(em.nom)}</div>
        <div class="p-emetteur-coord">${[em.adresse, [em.codePostal, em.ville].filter(Boolean).join(" "), [em.telephone, em.email].filter(Boolean).join(" · "), (r.siteWeb || "").trim()].filter(Boolean).map(esc).join("<br>")}</div>
      </div>
      <div class="p-titre-col"><div class="p-doctitre-grand">${title}<span></span></div></div>
      <div class="p-ident-fisc">${fisc}${em.tva ? `${fisc ? "<br>" : ""}<b>TVA intracommunautaire</b> ${esc(em.tva)}` : ""}</div>
      <dl class="p-meta">${metaDocHTML(c, doc)}</dl>
    </div>
    <div class="p-cartes">
      ${carteChantierHTML(doc)}
      <div class="p-carte">
        <div class="p-carte-titre">Client</div>
        <div class="p-line"><b>${esc(doc.client)}</b><br>${esc(doc.adresse)}${doc.clientSiret ? "<br>SIRET " + esc(doc.clientSiret) : ""}${doc.clientTvaIntracom ? "<br>TVA " + esc(doc.clientTvaIntracom) : ""}${doc.interlocuteur ? "<br>À l'attention de " + esc(doc.interlocuteur) : ""}</div>
      </div>
    </div>
    <table class="p-lignes">
      <tr><th style="width:44%;">Désignation</th><th class="num">Qté</th><th class="unite">Unité</th><th class="num">PU HT</th><th class="num">Montant HT</th><th class="num">% TVA</th></tr>
      ${printableLignesRows(lignes, hidePrices)}
    </table>
    <div class="p-bloc-bas">
      ${blocReglementHTML(type, doc, s, em, hidePrices)}
      <div class="p-totaux">${blocTotauxHTML(doc, lignes, fmt)}</div>
    </div>
    ${
      type === "facture"
        ? ""
        : `<table class="p-sign"><tr>
      <td>${type === "devis" ? "Bon pour accord, date et signature du client :" : "Validation de la pré-facture :"}<div class="p-sigline"></div></td>
      ${type === "devis" ? "" : `<td>Pour ${esc(em.nom)} :<div class="p-sigline"></div></td>`}
    </tr></table>`
    }
    <div class="p-bas-de-page">
      ${blocMentionsHTML(type, s, c.mentions ?? [])}
      <div class="p-footer">${esc(piedDePageHTML(em, s))}</div>
    </div>
    </div>
  `;
}

/** Nom du PDF quand le document n'a pas de numéro (app.js l. 4013). */
export const NOM_FICHIER_DEFAUT: Record<TypeImprimable, string> = { devis: "devis", facture: "facture", bonCommande: "bon-de-commande" };
