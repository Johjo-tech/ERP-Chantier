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
 * Et trois corrections voulues de RENDU (DEF-REP-04, D-REP-04) : la quantité et
 * la TVA d'une ligne s'écrivent à la française (« 2,5 », « 5,5 % » — l'ancien
 * imprimait « 2.5 » et « 5.5% ») ; un avoir s'imprime en négatif (`sens`) ; un
 * SAV s'intitule « SAV » (`titre`, posé par le module des bons).
 *
 * La parité est vérifiée en évaluant la source même de l'ancien sur les mêmes
 * données (tests/parite/impression.essai.ts) : une retouche de l'ancien gabarit
 * fait échouer le test au lieu de laisser diverger celui-ci.
 */
import Big from "big.js";
import { arrondiCentimes, formatEuros, montant, type Montant } from "@/lib/money";
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
  /** Où envoyer la pièce quand ce n'est pas le siège (bon de commande, facture) : l'emporte sur la fiche. */
  facturationAdresse?: string | null;
  facturationCodePostal?: string | null;
  facturationVille?: string | null;
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
  /**
   * -1 pour un avoir : ses montants sont STOCKÉS positifs et l'ancien les imprimait
   * tels quels sous le titre AVOIR — une pièce qui se lit comme une dette du client
   * (DEF-REP-04). En négatif, comme à l'écran. Absent : 1.
   */
  sens?: 1 | -1;
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
  /**
   * La fiche du client que l'ancien retrouvait PAR SON NOM dans la société
   * (`adresseClientDuDocument`) : le code postal et la ville n'étant pas figés
   * sur la pièce, c'est elle qui les donne. Absente : la rue seule.
   */
  ficheClient?: FicheClientImprimable | null;
}

/** Ce que le bloc « Client » lit de la fiche. */
export interface FicheClientImprimable {
  adresse?: string | null;
  codePostal?: string | null;
  ville?: string | null;
}

/* ── Formats de l'ancien (app.js l. 625, 800, 834) ─────────────────────── */

const euros = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });

/** `money(n)` : une valeur SAISIE (prix unitaire), formatée telle que l'ancien la formatait. */
function money(n: number | string | null | undefined): string {
  return euros.format(Number(n) || 0);
}

/** Un montant CALCULÉ, arrondi au bord (D-006). */
const argent = (m: Montant) => formatEuros(m);

type Sens = 1 | -1;

/**
 * Les montants d'une pièce, dans son sens. Un zéro ne prend jamais de signe :
 * « -0,00 € » sur un avoir ne dirait rien de plus qu'un zéro.
 */
function formateur(hidePrices: boolean, sens: Sens): (m: Montant | number | string | null | undefined) => string {
  if (hidePrices) return () => "•••";
  return (m) => {
    if (m instanceof Big) return argent(sens < 0 && !arrondiCentimes(m).eq(0) ? m.neg() : m);
    const n = Number(m) || 0;
    return money(sens < 0 && n !== 0 ? -n : n);
  };
}

/** La quantité d'une ligne à la française : « 2,5 », pas « 2.5 » (DEF-REP-04). */
export function quantiteImprimee(q: number | string | null | undefined): string {
  const n = typeof q === "number" ? q : q === null || q === undefined || String(q).trim() === "" ? NaN : Number(String(q).replace(",", "."));
  return Number.isFinite(n) ? String(n).replace(".", ",") : String(q);
}

/** La TVA d'une ligne comme celle des totaux : « 5,5 % », pas « 5.5% » (DEF-REP-04). */
export function tvaImprimee(t: number | string | null | undefined): string {
  const n = typeof t === "number" ? t : t === null || t === undefined || String(t).trim() === "" ? NaN : Number(String(t).replace(",", "."));
  return Number.isFinite(n) ? formaterTaux(n) : "";
}

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

export function printableLignesRows(lignes: readonly LigneImprimable[] | null | undefined, hidePrices?: boolean, sens: Sens = 1): string {
  const fmt: Formateur = formateur(!!hidePrices, sens);
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
      html += `<tr class="${(cls + sansPrix).trim()}"><td>${badge}${esc(l.designation)}</td><td class="num">${esc(quantiteImprimee(l.qte))}</td><td class="unite">${esc(l.unite || "u")}</td><td class="num">${fmt(l.prixUnitaire)}</td><td class="num">${fmt(montantLigneHt(versMontant(l)))}</td><td class="num">${tvaImprimee(l.tva)}</td></tr>`;
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
  /* Un brouillon sortait avec un champ « Numéro » VIDE sous un titre qui annonce
     une facture — un document qui a l'air d'une pièce comptable et n'en est pas
     (correctif 4f129c7 de l'ancien : vaut aussi pour les devis et les bons). */
  const numero = String(doc.numero || "").trim();
  const l: [string, string][] = [
    [numero ? "Numéro" : "État", numero ? esc(numero) : "Brouillon — non émis"],
    ["Date d'émission", fmtDate(doc.date)],
  ];
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

function blocTotauxHTML(doc: DocImprimable, lignes: readonly LigneImprimable[], fmt: Formateur, sens: Sens): string {
  const t = totauxDocument(lignes.map(versMontant), doc.remisePourcentage ?? 0);
  // Remise, acompte, retenue viennent EN DÉDUCTION : « -12,00 € » sur une facture ; sur un avoir,
  // dont le total est négatif, la même déduction le ramène vers zéro et s'écrit sans signe.
  const deduction = (m: Montant) => (sens < 0 ? fmt(m.neg()) : "-" + fmt(m));
  // La base d'un taux s'affiche même sans les prix, comme dans l'ancien : seul son signe suit la pièce.
  const baseTva = formateur(false, sens);
  const v = t.ventilation;
  const kv = (l: string, x: string, c?: string) => `<div class="p-kv${c || ""}"><span>${l}</span><em>${x}</em></div>`;
  const solde = soldeAPayer(t.ttc, doc.acomptesDeduits, doc.retenueGarantiePourcentage);
  const unique = v.length === 1 ? v[0] : undefined;
  return (
    (v.length > 1
      ? `<div class="p-tva-detail"><b>Détail TVA</b>${v.map((pa) => kv(`TVA ${formaterTaux(pa.taux)} sur ${baseTva(pa.base)}`, fmt(pa.montant))).join("")}${kv("Total TVA", fmt(t.tva), " somme")}</div>`
      : "") +
    kv("Total HT", fmt(t.htAvant)) +
    (t.remisePct.gt(0) ? kv(`Remise (${Number(t.remisePct.toString())} %)`, deduction(t.remiseMontantHT)) : "") +
    kv(unique ? `Total TVA ${formaterTaux(unique.taux)}` : "Total TVA", fmt(t.tva)) +
    kv("Total TTC", fmt(t.ttc), " p-ttc") +
    (solde.acomptes.gt(0) ? kv("Acompte déjà versé", deduction(solde.acomptes)) : "") +
    (solde.retenueMontant.gt(0) ? kv(`Retenue de garantie (${formaterTaux(solde.retenuePourcentage)})`, deduction(solde.retenueMontant)) : "") +
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

/**
 * `adresseClientDuDocument` (app.js, 2c21745) : l'adresse ENTIÈRE du client.
 * L'adresse de facturation du document l'emporte dès qu'un de ses champs est
 * renseigné — elle dit où envoyer la pièce ; sinon la rue figée sur la pièce
 * (ou celle de la fiche), et le code postal et la ville de la fiche, faute
 * d'être figés : sans eux, toutes les pièces déjà établies sortaient sans commune.
 */
export function adresseClientDuDocument(doc: DocImprimable, fiche: FicheClientImprimable | null | undefined): { rue: string; cpVille: string } {
  const f = [doc.facturationAdresse, doc.facturationCodePostal, doc.facturationVille].filter(Boolean);
  if (f.length) {
    return {
      rue: doc.facturationAdresse || "",
      cpVille: [doc.facturationCodePostal, doc.facturationVille].filter(Boolean).join(" "),
    };
  }
  const c = fiche ?? {};
  return {
    rue: doc.adresse || c.adresse || "",
    cpVille: [c.codePostal, c.ville].filter(Boolean).join(" "),
  };
}

/* ── La pièce (app.js l. 4032-4118) ────────────────────────────────────── */

export function renderPrintDoc(c: ContexteImpression): string {
  const { type, doc, s } = c;
  const hidePrices = !!c.masquerPrix;
  const lignes = c.lignesRemplacees || doc.lignes || [];
  const sens: Sens = c.sens ?? 1;
  const fmt: Formateur = formateur(hidePrices, sens);
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
  const adrClient = adresseClientDuDocument(doc, c.ficheClient);
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
        <div class="p-line"><b>${esc(doc.client)}</b>${[adrClient.rue, adrClient.cpVille].filter(Boolean).map((v) => "<br>" + esc(v)).join("")}${doc.clientSiret ? "<br>SIRET " + esc(doc.clientSiret) : ""}${doc.clientTvaIntracom ? "<br>TVA " + esc(doc.clientTvaIntracom) : ""}${doc.interlocuteur ? "<br>À l'attention de " + esc(doc.interlocuteur) : ""}</div>
      </div>
    </div>
    <table class="p-lignes">
      <tr><th style="width:44%;">Désignation</th><th class="num">Qté</th><th class="unite">Unité</th><th class="num">PU HT</th><th class="num">Montant HT</th><th class="num">% TVA</th></tr>
      ${printableLignesRows(lignes, hidePrices, sens)}
    </table>
    <div class="p-bloc-bas">
      ${blocReglementHTML(type, doc, s, em, hidePrices)}
      <div class="p-totaux">${blocTotauxHTML(doc, lignes, fmt, sens)}</div>
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
