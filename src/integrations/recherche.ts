/**
 * Recherche et filtrage des documents.
 *
 * Quatre implémentations divergentes du même besoin coexistaient dans le
 * monolithe — une par écran, une par recherche globale — si bien que chercher
 * « impayée » fonctionnait depuis le tableau de bord mais pas depuis l'écran
 * Factures. Elles sont remplacées par une définition unique.
 *
 * Le module est volontairement indifférent au type de document : il lit les
 * champs qu'il connaît et ignore les absents. Un devis, une facture et un bon
 * de commande passent donc par le même chemin, et un champ ajouté à l'un
 * profite aux autres sans qu'on y pense.
 *
 * Tout y est pur — aucun accès au DOM, à `state`, ni à la base. C'est ce qui le
 * rend testable, là où la logique enfermée dans le HTML ne l'était pas.
 */

/** Champs textuels parcourus, tous types de documents confondus. */
const CHAMPS_CHERCHES = [
  "client",
  "numero",
  "numeroBC",
  "numeroLogement",
  "adresse",
  "adresseLocataire",
  "codePostal",
  "ville",
  "occupant",
  "interlocuteur",
  "ancienLocataire",
  "precisionCommune",
  "etage",
  "statut",
  "conducteur",
  "natureTravaux",
  "referenceChantier",
  "notes",
  "problemeDescription",
  "typePanne",
  "metier",
  "date",
  "echeance",
  "dateReception",
] as const;

type Document = Record<string, unknown>;

export function sansAccents(s: string): string {
  return (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/**
 * Tous les mots de la requête doivent être présents, dans n'importe quel ordre
 * et n'importe quels champs. Chercher « peinture grenoble » retrouve donc un
 * document dont la prestation est à Grenoble, sans que ces deux mots se
 * touchent nulle part.
 */
export function multiWordMatch(haystack: string, query: string): boolean {
  const mots = sansAccents((query ?? "").trim().toLowerCase())
    .split(/\s+/)
    .filter(Boolean);
  if (!mots.length) return true;

  const texte = sansAccents(haystack);
  return mots.every((m) => texte.includes(m));
}

/**
 * Désignations et commentaires des lignes de prestation.
 *
 * C'est ce qui permet de retrouver un document par ce qu'il facture, et non
 * seulement par son en-tête : « étanchéité » doit ramener les documents qui
 * contiennent cette prestation même si le mot n'apparaît nulle part ailleurs.
 */
export function lignesHaystack(lignes: unknown): string {
  if (!Array.isArray(lignes)) return "";
  return lignes
    .map((l) => {
      const ligne = (l ?? {}) as Document;
      return [ligne.designation, ligne.commentaire].filter(Boolean).join(" ");
    })
    .filter(Boolean)
    .join(" ");
}

/**
 * Aplatit un document en une chaîne cherchable, minuscules comprises.
 *
 * `extras` reçoit ce que le module ne sait pas calculer seul — les montants
 * formatés, qui dépendent des totaux et de la remise. Les faire passer en
 * paramètre évite de dupliquer ici un calcul qui vit déjà ailleurs.
 */
export function texteDocument(doc: Document, extras: unknown[] = []): string {
  if (!doc) return "";

  const morceaux: unknown[] = CHAMPS_CHERCHES.map((c) => doc[c]);

  if (Array.isArray(doc.metiers)) morceaux.push(doc.metiers.join(" "));

  const rapport = doc.rapport as Document | undefined;
  if (rapport) morceaux.push(rapport.constatations, rapport.preconisations);

  morceaux.push(lignesHaystack(doc.lignes));
  morceaux.push(...extras);

  return morceaux.filter(Boolean).join(" ").toLowerCase();
}

export function correspond(
  doc: Document,
  requete: string,
  extras: unknown[] = []
): boolean {
  if (!requete || !requete.trim()) return true;
  return multiWordMatch(texteDocument(doc, extras), requete);
}

// ============ PÉRIODE ============

export type Periode = "tout" | "mois" | "annee" | "plage";

/**
 * Date de référence d'un document, en cascade.
 *
 * Aucun champ n'est fiable seul : sur les données réelles, l'échéance d'une
 * facture n'est jamais renseignée et la date de réception d'un bon ne l'est que
 * six fois sur dix. On retient donc la première disponible, dans l'ordre où
 * elle a du sens pour l'utilisateur.
 */
export function dateDocument(doc: Document): string {
  if (!doc) return "";
  const candidats = [doc.dateReception, doc.date, doc.datePlanifiee];
  for (const d of candidats) {
    if (typeof d === "string" && d) return d.slice(0, 10);
  }
  const cree = doc.createdAt;
  return typeof cree === "string" ? cree.slice(0, 10) : "";
}

/**
 * Compare des chaînes `AAAA-MM-JJ` plutôt que des objets `Date`.
 *
 * Elles se trient lexicographiquement, et le fuseau horaire disparaît du
 * problème — `toISOString()` renvoie la veille avant 1 h à Paris, piège déjà
 * rencontré dans ce dépôt.
 */
export function dansLaPeriode(
  dateISO: string,
  periode: Periode,
  du?: string,
  au?: string
): boolean {
  if (periode === "tout") return true;
  if (!dateISO) return false;

  const maintenant = new Date();
  const annee = String(maintenant.getFullYear());
  const mois = `${annee}-${String(maintenant.getMonth() + 1).padStart(2, "0")}`;

  switch (periode) {
    case "annee":
      return dateISO.startsWith(annee);
    case "mois":
      return dateISO.startsWith(mois);
    case "plage":
      // Bornes incluses : « du 1er au 31 » comprend ces deux jours
      if (du && dateISO < du) return false;
      if (au && dateISO > au) return false;
      return true;
    default:
      return true;
  }
}

// ============ FILTRAGE ============

export interface CriteresRecherche {
  recherche?: string;
  client?: string;
  interlocuteur?: string;
  conducteur?: string;
  metier?: string;
  logement?: string;
  /** Libellé calculé par l'appelant : le calcul dépend des règlements. */
  reglement?: string;
  periode?: Periode;
  du?: string;
  au?: string;
}

/** Ce que l'appelant doit fournir pour un document donné. */
export interface ContexteDocument {
  extras?: unknown[];
  /**
   * Étiquettes de règlement applicables. Un tableau et non une valeur : une
   * facture peut être impayée **et** en retard, et n'en retenir qu'une la
   * ferait disparaître de l'autre filtre.
   */
  reglements?: string[];
  metiers?: string[];
}

/**
 * Applique recherche et filtres en une passe.
 *
 * Un critère vide ne filtre pas : c'est ce qui permet à la même fonction de
 * servir des écrans qui n'affichent pas les mêmes filtres.
 */
export function filtrerDocuments<T extends Document>(
  liste: T[],
  criteres: CriteresRecherche,
  contexte: (doc: T) => ContexteDocument = () => ({})
): T[] {
  const c = criteres ?? {};

  return (liste ?? []).filter((doc) => {
    const ctx = contexte(doc);

    if (!correspond(doc, c.recherche ?? "", ctx.extras)) return false;
    if (c.client && doc.client !== c.client) return false;
    if (c.interlocuteur && (doc.interlocuteur ?? "") !== c.interlocuteur) {
      return false;
    }
    if (c.conducteur && doc.conducteur !== c.conducteur) return false;
    if (c.logement && doc.logementStatut !== c.logement) return false;

    if (c.metier) {
      const metiers = ctx.metiers ?? [];
      if (!metiers.includes(c.metier)) return false;
    }

    if (c.reglement && !(ctx.reglements ?? []).includes(c.reglement)) return false;

    if (c.periode && c.periode !== "tout") {
      if (!dansLaPeriode(dateDocument(doc), c.periode, c.du, c.au)) return false;
    }

    return true;
  });
}

/**
 * Regroupe par client, en conservant l'ordre alphabétique.
 *
 * Les vues Validation et À facturer rangent les bons dans des dossiers ; le
 * regroupement est donc de la logique d'affichage, mais pure, et c'est le seul
 * endroit où l'on décide comment nommer un document sans client.
 */
export const SANS_CLIENT = "— Sans client —";

export function grouperParClient<T extends Document>(
  liste: T[]
): { client: string; documents: T[] }[] {
  const parClient = new Map<string, T[]>();

  for (const doc of liste ?? []) {
    const cle = (doc.client as string) || SANS_CLIENT;
    const groupe = parClient.get(cle);
    if (groupe) groupe.push(doc);
    else parClient.set(cle, [doc]);
  }

  return [...parClient.entries()]
    .map(([client, documents]) => ({ client, documents }))
    .sort((a, b) => a.client.localeCompare(b.client));
}
