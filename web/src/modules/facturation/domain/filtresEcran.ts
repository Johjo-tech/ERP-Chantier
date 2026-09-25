import { correspond } from "@/lib/recherche";

/**
 * La barre de filtres de Facturation (`FILTRES_FACTURES`, `critereFactures`,
 * `filtrerDocuments`, `dansLaPeriode` — app.js l. 5477 et
 * src/integrations/recherche.ts). Les quatre vues partagent le même état ; le
 * descripteur dit quels filtres chacune AFFICHE, et un filtre que la vue
 * n'affiche pas ne s'applique jamais — sinon un statut de règlement posé sur la
 * liste viderait la vue Validation sans que rien ne l'explique.
 */
/** « AAAA-MM-JJ » : une date de document se compare sans son heure. */
const LONGUEUR_DATE_ISO = 10;

export type VueFacturation = "liste" | "avoirs" | "validation" | "afacturer";
export type CleFiltre = "recherche" | "client" | "interlocuteur" | "conducteur" | "logement" | "metier" | "reglement" | "periode";
export type Periode = "tout" | "mois" | "annee" | "plage";

export const FILTRES_PAR_VUE: Record<VueFacturation, readonly CleFiltre[]> = {
  liste: ["recherche", "client", "interlocuteur", "conducteur", "logement", "reglement", "periode"],
  avoirs: ["recherche", "client", "conducteur", "periode"],
  validation: ["recherche", "client", "interlocuteur", "conducteur", "metier", "periode"],
  afacturer: ["recherche", "client", "interlocuteur", "conducteur", "metier", "periode"],
};

export interface EtatFiltres {
  recherche: string;
  client: string;
  interlocuteur: string;
  conducteur: string;
  logement: string;
  metier: string;
  reglement: string;
  periode: Periode;
  du: string;
  au: string;
}

export const FILTRES_VIDES: EtatFiltres = { recherche: "", client: "", interlocuteur: "", conducteur: "", logement: "", metier: "", reglement: "", periode: "tout", du: "", au: "" };

/** Les critères qui s'appliquent à cette vue : les autres valent vide. */
export function criteresDeLaVue(etat: EtatFiltres, vue: VueFacturation): EtatFiltres {
  const affiches = FILTRES_PAR_VUE[vue];
  const garder = (c: CleFiltre) => affiches.includes(c);
  return {
    recherche: garder("recherche") ? etat.recherche : "",
    client: garder("client") ? etat.client : "",
    interlocuteur: garder("interlocuteur") ? etat.interlocuteur : "",
    conducteur: garder("conducteur") ? etat.conducteur : "",
    logement: garder("logement") ? etat.logement : "",
    metier: garder("metier") ? etat.metier : "",
    reglement: garder("reglement") ? etat.reglement : "",
    periode: garder("periode") ? etat.periode : "tout",
    du: etat.du,
    au: etat.au,
  };
}

export function filtrageActif(c: EtatFiltres): boolean {
  return !!(c.recherche || c.client || c.interlocuteur || c.conducteur || c.logement || c.metier || c.reglement || (c.periode && c.periode !== "tout"));
}

/** Ce que la barre cherche vraiment, dit dans l'ordre où on le tape (`placeholderRechercheFactures`). */
export function placeholderRecherche(vue: VueFacturation): string {
  return vue === "validation" || vue === "afacturer"
    ? "Rechercher : n° de BC, client, locataire, adresse du bien, n° de facture…"
    : "Rechercher : n° de facture, n° de BC, client, locataire, adresse du bien…";
}
export function aideRecherche(vue: VueFacturation): string {
  return `${placeholderRecherche(vue).replace("…", "")}, nature des travaux, référence chantier, montant, prestation.`;
}

/** `dansLaPeriode` : bornes incluses, mois et année de l'horloge locale. */
export function dansLaPeriode(dateIso: string, periode: Periode, du: string, au: string, maintenant: Date = new Date()): boolean {
  if (periode === "tout") return true;
  if (!dateIso) return false;
  const annee = String(maintenant.getFullYear());
  const mois = `${annee}-${String(maintenant.getMonth() + 1).padStart(2, "0")}`;
  if (periode === "annee") return dateIso.startsWith(annee);
  if (periode === "mois") return dateIso.startsWith(mois);
  if (du && dateIso < du) return false;
  if (au && dateIso > au) return false;
  return true;
}

export interface DocumentFiltrable {
  client: string;
  interlocuteur: string | null;
  conducteur: string | null;
  logement: string | null;
  date: string;
  /** Tout ce qui se cherche : champs propres, puis apports (montants, ce que disent les pièces liées). */
  cherchable: readonly (string | null | undefined)[];
  metiers?: readonly string[];
  reglements?: readonly string[];
}

/** `filtrerDocuments` : recherche et filtres en une passe ; un critère vide ne filtre pas. */
export function retenu(doc: DocumentFiltrable, c: EtatFiltres): boolean {
  if (!correspond(c.recherche, ...doc.cherchable)) return false;
  if (c.client && doc.client !== c.client) return false;
  if (c.interlocuteur && (doc.interlocuteur ?? "") !== c.interlocuteur) return false;
  if (c.conducteur && doc.conducteur !== c.conducteur) return false;
  if (c.logement && doc.logement !== c.logement) return false;
  if (c.metier && !(doc.metiers ?? []).includes(c.metier)) return false;
  if (c.reglement && !(doc.reglements ?? []).includes(c.reglement)) return false;
  return dansLaPeriode(doc.date.slice(0, LONGUEUR_DATE_ISO), c.periode, c.du, c.au);
}

/** `grouperParClient` : par client, dans l'ordre alphabétique ; un document sans client va sous « — Sans client — ». */
export const SANS_CLIENT = "— Sans client —";
export function grouperParClient<T extends { client: string }>(liste: readonly T[]): { client: string; documents: T[] }[] {
  const par = new Map<string, T[]>();
  for (const d of liste) {
    const cle = d.client || SANS_CLIENT;
    par.set(cle, [...(par.get(cle) ?? []), d]);
  }
  return [...par.entries()].map(([client, documents]) => ({ client, documents })).sort((a, b) => a.client.localeCompare(b.client));
}
