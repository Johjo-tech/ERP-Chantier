/**
 * Le dossier documentaire d'un salarié : ce qu'on y attend, et ce qui manque
 * (RH-04, RH-09). Port de `src/api/regles-documents-rh.ts` (parité :
 * tests/parite/rh.essai.ts).
 *
 * Les dates circulent en ISO `AAAA-MM-JJ` et se comparent comme telles. Aucun
 * `toISOString()` : il bascule en UTC et, avant 1 h à Paris, ferait expirer la
 * veille un document valable jusqu'à ce soir.
 */

export interface TypeDocumentRh {
  code: string;
  libelle: string;
  icone: string;
  /** Le document porte une date de fin de validité qu'il faut surveiller. */
  perissable: boolean;
  /**
   * Attendu dans tout dossier : DPAE (L.1221-10), carte BTP (L.8291-1), de
   * quoi prouver l'identité et payer. L'avenant ou le CACES ne concernent
   * qu'une partie des salariés : les réclamer à tous ferait un écran rouge en
   * permanence. Le suivi médical a son propre registre (`visites.ts`).
   */
  obligatoire: boolean;
  /** Plusieurs exemplaires ont un sens — un avenant par changement. */
  multiple: boolean;
}

export const TYPES_DOCUMENT_RH: readonly TypeDocumentRh[] = [
  { code: "contrat", libelle: "Contrat de travail", icone: "📄", perissable: false, obligatoire: true, multiple: false },
  { code: "avenant", libelle: "Avenant au contrat", icone: "📝", perissable: false, obligatoire: false, multiple: true },
  { code: "dpae", libelle: "DPAE", icone: "🏛️", perissable: false, obligatoire: true, multiple: false },
  { code: "pieceIdentite", libelle: "Pièce d'identité", icone: "🪪", perissable: true, obligatoire: true, multiple: false },
  { code: "titreSejour", libelle: "Titre de séjour", icone: "🛂", perissable: true, obligatoire: false, multiple: false },
  { code: "carteBtp", libelle: "Carte BTP", icone: "🦺", perissable: true, obligatoire: true, multiple: false },
  { code: "habilitation", libelle: "Habilitation / CACES", icone: "⚡", perissable: true, obligatoire: false, multiple: true },
  { code: "diplome", libelle: "Diplôme / certification", icone: "🎓", perissable: false, obligatoire: false, multiple: true },
  { code: "rib", libelle: "RIB", icone: "🏦", perissable: false, obligatoire: true, multiple: false },
  { code: "mutuelle", libelle: "Mutuelle", icone: "💊", perissable: false, obligatoire: false, multiple: false },
  { code: "arretTravail", libelle: "Arrêt de travail", icone: "🏥", perissable: false, obligatoire: false, multiple: true },
  { code: "attestation", libelle: "Attestation", icone: "📃", perissable: false, obligatoire: false, multiple: true },
  { code: "autre", libelle: "Autre document", icone: "📎", perissable: false, obligatoire: false, multiple: true },
];

/** Le type des habilitations : elles vivent au dossier, pas dans `salarie_habilitations` (D-RH-03). */
export const TYPE_HABILITATION = "habilitation";

const TYPE_PAR_DEFAUT: TypeDocumentRh = { code: "autre", libelle: "Autre document", icone: "📎", perissable: false, obligatoire: false, multiple: true };

/**
 * Le type décrit, même pour un code qu'on ne connaît plus : un document rangé
 * sous un code retiré doit rester visible et supprimable, pas disparaître de
 * l'écran en laissant son fichier dans le bucket.
 */
export function typeDocumentRh(code?: string | null): TypeDocumentRh {
  const cherche = (code ?? "").trim();
  return TYPES_DOCUMENT_RH.find((t) => t.code === cherche) ?? TYPE_PAR_DEFAUT;
}

/** Le document tel que l'écran le manipule. */
export interface DocumentRh {
  id: string;
  salarieId: string;
  type: string;
  nom?: string | null;
  organisme?: string | null;
  numeroDocument?: string | null;
  dateDocument?: string | null;
  dateExpiration?: string | null;
  notes?: string | null;
  fichierChemin?: string | null;
  fichierNom?: string | null;
}

export type EtatDocumentRh = "permanent" | "valide" | "bientot" | "expire";

const JOUR_MS = 86_400_000;

/**
 * Jours entre deux dates ISO ; négatif si la cible est passée. Deux minuits UTC
 * sont séparés d'un nombre entier de jours : la division est exacte.
 */
export function joursEntre(depuis: string, jusqua?: string | null): number | null {
  const cible = Date.parse(`${(jusqua ?? "").trim()}T00:00:00Z`);
  const origine = Date.parse(`${depuis}T00:00:00Z`);
  if (Number.isNaN(cible) || Number.isNaN(origine)) return null;
  return (cible - origine) / JOUR_MS;
}

/**
 * Où en est ce document. `permanent` veut dire « rien à surveiller » : une
 * carte BTP sans date saisie aussi, mais elle manque d'une information, ce que
 * dit `sansEcheance`.
 */
export function etatDocumentRh(doc: DocumentRh, aujourdHui: string, seuilJours: number): { etat: EtatDocumentRh; jours: number | null; sansEcheance: boolean } {
  const jours = joursEntre(aujourdHui, doc.dateExpiration);
  if (jours === null) return { etat: "permanent", jours: null, sansEcheance: typeDocumentRh(doc.type).perissable };
  if (jours < 0) return { etat: "expire", jours, sansEcheance: false };
  if (jours <= seuilJours) return { etat: "bientot", jours, sansEcheance: false };
  return { etat: "valide", jours, sansEcheance: false };
}

export interface DossierSalarie {
  /** Types obligatoires dont aucun document n'a été déposé. */
  manquants: TypeDocumentRh[];
  expires: DocumentRh[];
  bientot: DocumentRh[];
  /** Périssables déposés sans date de fin : on ne saura pas qu'ils expirent. */
  sansEcheance: DocumentRh[];
  complet: boolean;
}

/**
 * L'état du dossier, en une passe. Un type obligatoire présent mais expiré
 * n'est pas « manquant » : l'un se demande, l'autre se renouvelle, et les
 * confondre compterait le même défaut deux fois.
 */
export function dossierSalarie(documents: readonly DocumentRh[], aujourdHui: string, seuilJours: number): DossierSalarie {
  const deposes = new Set(documents.map((d) => (d.type ?? "").trim()));
  const manquants = TYPES_DOCUMENT_RH.filter((t) => t.obligatoire && !deposes.has(t.code));
  const expires: DocumentRh[] = [];
  const bientot: DocumentRh[] = [];
  const sansEcheance: DocumentRh[] = [];
  for (const doc of documents) {
    const { etat, sansEcheance: sans } = etatDocumentRh(doc, aujourdHui, seuilJours);
    if (etat === "expire") expires.push(doc);
    else if (etat === "bientot") bientot.push(doc);
    if (sans) sansEcheance.push(doc);
  }
  return { manquants, expires, bientot, sansEcheance, complet: manquants.length === 0 && expires.length === 0 };
}

/** Le nom affiché : le libellé saisi, sinon le fichier, sinon le type — jamais une ligne vide. */
export function libelleDocumentRh(doc: DocumentRh): string {
  const propre = (doc.nom ?? "").trim();
  if (propre) return propre;
  const fichier = (doc.fichierNom ?? "").trim();
  if (fichier) return fichier;
  return typeDocumentRh(doc.type).libelle;
}

/** Les plus urgents d'abord : par échéance, les sans-échéance ensuite, puis par nom. */
export function trierDocumentsRh(documents: readonly DocumentRh[]): DocumentRh[] {
  return [...documents].sort((a, b) => {
    const ea = (a.dateExpiration ?? "").trim();
    const eb = (b.dateExpiration ?? "").trim();
    if (ea && eb && ea !== eb) return ea.localeCompare(eb);
    if (ea !== "" && eb === "") return -1;
    if (ea === "" && eb !== "") return 1;
    return libelleDocumentRh(a).localeCompare(libelleDocumentRh(b), "fr");
  });
}

export type Pastille = "manquant" | "expire" | "bientot" | "sansDate" | "ok";

/**
 * La pastille d'une colonne du tableau de conformité : l'état le PIRE des
 * documents de ce type (`pastilleDocumentRh`).
 */
export function pastilleDocument(docs: readonly DocumentRh[], code: string, aujourdHui: string, seuil: number): Pastille {
  const dedans = docs.filter((d) => d.type === code);
  if (!dedans.length) return "manquant";
  const etats = dedans.map((d) => etatDocumentRh(d, aujourdHui, seuil));
  if (etats.some((e) => e.etat === "expire")) return "expire";
  if (etats.some((e) => e.etat === "bientot")) return "bientot";
  if (etats.some((e) => e.sansEcheance)) return "sansDate";
  return "ok";
}

/** Le libellé proposé pour une habilitation : le nom du fichier sans extension (`libelleDepuisNomFichier`). */
export function libelleDepuisNomFichier(nom: string | null | undefined): string {
  return String(nom ?? "")
    .replace(/\.[^.]+$/, "")
    .replace(/[_-]+/g, " ")
    .trim();
}
