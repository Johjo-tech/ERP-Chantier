import { formatDateFr } from "@/lib/dates";
import { formatEuros, formatTaux, montant, type Montant } from "@/lib/money";
import { piedDePage, type IdentiteEmettrice, type ReglagesImpression } from "./identite";
import type { LigneBase } from "./lignes";
import { STATUTS_LOGEMENT, type StatutLogement } from "./logement";
import { montantLigneHt, soldeAPayer, sousTotauxChapitres, totauxDocument } from "./totaux";

/**
 * Le CONTENU d'une pièce imprimée (devis, facture, avoir), sans mise en page :
 * port de `renderPrintDoc` (app.js l. 4040-4133). Tout ce que dit le document
 * se décide ici, en pur — le rendu PDF ne fait que poser ces textes sur la page.
 */
export interface PieceImprimable {
  type: "devis" | "facture";
  /** « DEVIS », « FACTURE », « AVOIR », « FACTURE D'ACOMPTE ». */
  titre: string;
  numero: string | null;
  date: string;
  /** Méta propres à la pièce, après numéro et date (validité, échéance, marché…). */
  meta: [string, string][];
  client: { nom: string; adresse: string | null; siret?: string | null; tva?: string | null; interlocuteur: string | null };
  lieu: {
    adresse_locataire: string | null;
    code_postal: string | null;
    ville: string | null;
    logement_statut: StatutLogement | null;
    occupant: string | null;
    etage: string | null;
    numero_logement: string | null;
    precision_commune: string | null;
    ancien_locataire: string | null;
    telephone_locataire?: string | null;
    ref_bon_commande_client?: string | null;
    date_fin_execution?: string | null;
  };
  lignes: readonly Pick<LigneBase, "type" | "designation" | "quantite" | "prix_unitaire" | "unite" | "tva" | "commentaire">[];
  remise: number;
  signe: 1 | -1;
  deductions?: { acomptes: unknown; retenuePct: unknown } | undefined;
  /** Facture seulement : de quoi payer. */
  reglement?: { echeance: string | null; conditions: string | null; mode: string | null } | undefined;
  /** Identité FIGÉE à l'émission ; elle l'emporte sur celle du jour. */
  emetteurFige?: { nom: string | null; adresse: string | null; code_postal: string | null; ville: string | null; siret: string | null; tva_intracom: string | null; iban: string | null } | null;
}

export type LigneModele =
  | { nature: "chapitre"; designation: string; sousTotal: string }
  | { nature: "commentaire"; designation: string }
  | { nature: "ligne"; designation: string; commentaire: string; quantite: string; unite: string; prixUnitaire: string; montant: string; tva: string; sansPrix: boolean };

export interface ModeleDocument {
  titre: string;
  nomFichier: string;
  brouillon: boolean;
  emetteur: { nom: string; coordonnees: string[]; fiscal: string[]; logo: string | null };
  meta: [string, string][];
  chantier: { lignes: string[]; refs: [string, string][] } | null;
  client: { nom: string; lignes: string[] };
  lignes: LigneModele[];
  /** Libellé, valeur, et la ligne à mettre en valeur (TTC, net à payer). */
  totaux: { libelle: string; valeur: string; fort: boolean }[];
  reglement: string[] | null;
  signature: string | null;
  mentions: string | null;
  pied: string;
}

const LIBELLES_MODE: Record<string, string> = {
  virement: "virement", cheque: "chèque", especes: "espèces", carte: "carte bancaire",
  prelevement: "prélèvement", traite: "traite", autre: "tout moyen convenu",
};

/** « Règlement par virement » : le mode inconnu retombe sur le virement, comme l'ancien. */
export function libelleModePaiement(mode: string | null | undefined): string {
  return LIBELLES_MODE[mode ?? ""] ?? "virement";
}

const avecVille = (adresse: string | null | undefined, cp: string | null | undefined, ville: string | null | undefined) =>
  [adresse, [cp, ville].filter(Boolean).join(" ")].filter(Boolean).join(", ");

/** L'émetteur : l'identité figée ENTIÈRE si la pièce en porte une, sinon celle du jour (tél., e-mail, site : toujours du jour). */
function emetteurDe(p: PieceImprimable, s: IdentiteEmettrice, r: ReglagesImpression) {
  const f = p.emetteurFige?.nom ? p.emetteurFige : null;
  const em = {
    nom: f?.nom ?? s.nom,
    adresse: f ? f.adresse : s.adresse,
    codePostal: f ? f.code_postal : s.codePostal,
    ville: f ? f.ville : s.ville,
    siret: f ? f.siret : s.siret,
    tvaIntracom: f ? f.tva_intracom : s.tvaIntracom,
    iban: (f ? f.iban : null) ?? s.iban,
  };
  const coordonnees = [em.adresse, [em.codePostal, em.ville].filter(Boolean).join(" "), [s.telephone, s.email].filter(Boolean).join(" · "), r.siteWeb.trim()].filter((x): x is string => !!x);
  const fiscal = [[em.siret && `Siret ${em.siret}`, s.codeNaf && `APE ${s.codeNaf}`].filter(Boolean).join(" · "), em.tvaIntracom ? `TVA intracommunautaire ${em.tvaIntracom}` : ""].filter(Boolean);
  return { em, bloc: { nom: em.nom, coordonnees, fiscal, logo: s.logo } };
}

/** La carte « Adresse du chantier » (`carteChantierHTML`, app.js l. 3995). */
function carteChantier(p: PieceImprimable): ModeleDocument["chantier"] {
  const l = p.lieu;
  const statut = STATUTS_LOGEMENT.find((x) => x.code === l.logement_statut)?.libelle ?? "";
  const lignes = [
    l.numero_logement ? `Logement n° ${l.numero_logement}` : "",
    l.occupant ?? "",
    l.telephone_locataire ? `Tél. ${l.telephone_locataire}` : "",
    l.ancien_locataire ? `Ancien locataire : ${l.ancien_locataire}` : "",
    avecVille(l.adresse_locataire, l.code_postal, l.ville),
    [statut, l.etage ? `Étage ${l.etage}` : ""].filter(Boolean).join(" — "),
    l.precision_commune ?? "",
  ].filter(Boolean);
  const refs: [string, string][] = [];
  if (l.ref_bon_commande_client) refs.push(["Votre bon de commande", l.ref_bon_commande_client]);
  // La date d'achèvement ne se répète pas quand elle égale celle de la pièce.
  if (l.date_fin_execution && l.date_fin_execution !== p.date) refs.push(["Travaux achevés le", formatDateFr(l.date_fin_execution)]);
  return lignes.length || refs.length ? { lignes, refs } : null;
}

function lignesDuModele(p: PieceImprimable): LigneModele[] {
  const sousTotaux = sousTotauxChapitres(p.lignes);
  let chapitre = 0;
  const signe = (m: Montant) => (p.signe === -1 ? m.neg() : m);
  return p.lignes.map((l): LigneModele => {
    if (l.type === "chapitre") return { nature: "chapitre", designation: l.designation, sousTotal: formatEuros(signe(sousTotaux[chapitre++] ?? montant(0))) };
    if (l.type === "commentaire") return { nature: "commentaire", designation: l.designation };
    return {
      nature: "ligne",
      designation: l.designation,
      commentaire: l.commentaire ?? "",
      quantite: String(l.quantite).replace(".", ","),
      unite: l.unite || "u",
      prixUnitaire: formatEuros(montant(l.prix_unitaire)),
      montant: formatEuros(montantLigneHt(l)),
      tva: formatTaux(montant(l.tva)),
      sansPrix: !(l.prix_unitaire > 0),
    };
  });
}

/**
 * La colonne des totaux (`blocTotauxHTML`, app.js l. 4176) : détail de TVA
 * à plusieurs taux seulement, remise, TTC, acompte, retenue — et le net à
 * payer, TOUJOURS, qui ferme le bloc.
 */
function totauxDuModele(p: PieceImprimable): ModeleDocument["totaux"] {
  const t = totauxDocument(p.lignes, p.remise);
  const s = (m: Montant) => (p.signe === -1 ? m.neg() : m);
  const out: ModeleDocument["totaux"] = [];
  const kv = (libelle: string, v: Montant, fort = false) => out.push({ libelle, valeur: formatEuros(v), fort });
  if (t.ventilation.length > 1) {
    for (const v of t.ventilation) kv(`TVA ${formatTaux(v.taux)} sur ${formatEuros(s(v.base))}`, s(v.montant));
  }
  kv("Total HT", s(t.htAvant));
  if (t.remisePct.gt(0)) kv(`Remise (${formatTaux(t.remisePct)})`, s(t.remiseMontantHT).neg());
  const unique = t.ventilation.length === 1 ? t.ventilation[0] : undefined;
  kv(unique ? `Total TVA ${formatTaux(unique.taux)}` : "Total TVA", s(t.tva));
  kv("Total TTC", s(t.ttc), true);
  const solde = soldeAPayer(s(t.ttc), p.deductions?.acomptes ?? 0, p.deductions?.retenuePct ?? null);
  if (solde.acomptes.gt(0)) kv("Acompte déjà versé", solde.acomptes.neg());
  if (solde.retenueMontant.gt(0)) kv(`Retenue de garantie (${formatTaux(solde.retenuePourcentage)})`, solde.retenueMontant.neg());
  // Un avoir : son net est négatif ; soldeAPayer le borne à 0, on garde le TTC signé.
  kv("Net à payer", p.signe === -1 ? s(t.ttc) : solde.netAPayer, true);
  return out;
}

/** « Pour votre règlement » (`blocReglementHTML`, app.js l. 4221) : IBAN/BIC selon le réglage, échéance, conditions. */
function blocReglement(p: PieceImprimable, iban: string | null, s: IdentiteEmettrice, r: ReglagesImpression): string[] | null {
  const avecIban = r.afficherIban && (!!iban || !!s.bic);
  const conditions = (p.type === "devis" ? r.conditionsDevis : p.reglement?.conditions ?? "").trim();
  const echeance = p.type === "facture" && p.reglement?.echeance ? `Échéance : ${formatDateFr(p.reglement.echeance)}` : "";
  if (!avecIban && !conditions && !echeance) return null;
  return [
    avecIban && iban ? `IBAN : ${iban}` : "",
    avecIban && s.bic ? `BIC : ${s.bic}` : "",
    echeance,
    conditions || `Règlement par ${libelleModePaiement(p.type === "devis" ? null : p.reglement?.mode)}`,
  ].filter(Boolean);
}

export function construireModele(p: PieceImprimable, identite: IdentiteEmettrice, reglages: ReglagesImpression, mentionsFacture: readonly string[]): ModeleDocument {
  const { em, bloc } = emetteurDe(p, identite, reglages);
  const mentions = [...mentionsFacture, reglages.mentionsComplementaires.trim()].filter(Boolean).join(" ");
  const client = p.client;
  return {
    titre: p.titre,
    nomFichier: p.numero || (p.type === "devis" ? "devis" : "facture"),
    brouillon: p.type === "facture" && !p.numero,
    emetteur: bloc,
    meta: [["Numéro", p.numero ?? "—"], ["Date d'émission", formatDateFr(p.date)], ...p.meta],
    chantier: carteChantier(p),
    client: {
      nom: client.nom,
      lignes: [client.adresse, client.siret && `SIRET ${client.siret}`, client.tva && `TVA ${client.tva}`, client.interlocuteur && `À l'attention de ${client.interlocuteur}`].filter((x): x is string => !!x),
    },
    lignes: lignesDuModele(p),
    totaux: totauxDuModele(p),
    reglement: blocReglement(p, em.iban, identite, reglages),
    // Une facture constate une créance, elle ne se signe pas ; le devis recueille l'accord du client seul.
    signature: p.type === "devis" ? "Bon pour accord, date et signature du client :" : null,
    // Les mentions du code de commerce : sur la facture seulement.
    mentions: p.type === "facture" && mentions ? mentions : null,
    pied: piedDePage({ nom: em.nom, siret: em.siret, tvaIntracom: em.tvaIntracom, adresse: em.adresse }, identite, reglages),
  };
}
