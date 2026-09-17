/**
 * Le dossier documentaire d'un salarié : ce qu'on y attend, et ce qui manque.
 *
 * Module feuille — il n'importe que des types. C'est ce qui permet à l'écran RH
 * (les pastilles rouges du tableau de conformité) et au calcul des alertes de
 * partager la même définition : un dossier déclaré incomplet ici ne peut pas
 * paraître complet là.
 *
 * Les dates arrivent en ISO `AAAA-MM-JJ` et repartent comparées comme telles.
 * Aucun `new Date()` implicite : `toISOString()` bascule en UTC et, avant 1 h à
 * Paris, fait expirer la veille un document valable jusqu'à ce soir.
 */

export interface TypeDocumentRh {
  code: string;
  libelle: string;
  icone: string;
  /** Le document porte une date de fin de validité qu'il faut surveiller. */
  perissable: boolean;
  /**
   * Attendu dans tout dossier : son absence est un manque, pas un choix.
   *
   * Le socle du BTP : déclaration préalable à l'embauche (C. trav. L.1221-10),
   * carte BTP (L.8291-1), et de quoi prouver l'identité et payer. L'avenant,
   * le titre de séjour ou le CACES ne concernent qu'une partie des salariés :
   * les réclamer à tous ferait un écran rouge en permanence, donc un écran
   * qu'on n'écoute plus.
   *
   * Le **suivi médical** n'est pas dans cette liste alors qu'il est tout aussi
   * obligatoire (R.4624-10) : il a son propre registre, qui porte le type de
   * visite, l'avis d'aptitude et les réserves — voir `regles-visite-medicale`.
   * L'y laisser aussi ferait deux sources, deux seuils et deux alertes pour le
   * même manquement.
   */
  obligatoire: boolean;
  /** Plusieurs exemplaires ont un sens — un avenant par changement. */
  multiple: boolean;
}

export const TYPES_DOCUMENT_RH: readonly TypeDocumentRh[] = [
  { code: "contrat",        libelle: "Contrat de travail",     icone: "📄", perissable: false, obligatoire: true,  multiple: false },
  { code: "avenant",        libelle: "Avenant au contrat",     icone: "📝", perissable: false, obligatoire: false, multiple: true  },
  { code: "dpae",           libelle: "DPAE",                   icone: "🏛️", perissable: false, obligatoire: true,  multiple: false },
  { code: "pieceIdentite",  libelle: "Pièce d'identité",       icone: "🪪", perissable: true,  obligatoire: true,  multiple: false },
  { code: "titreSejour",    libelle: "Titre de séjour",        icone: "🛂", perissable: true,  obligatoire: false, multiple: false },
  { code: "carteBtp",       libelle: "Carte BTP",              icone: "🦺", perissable: true,  obligatoire: true,  multiple: false },
  { code: "habilitation",   libelle: "Habilitation / CACES",   icone: "⚡", perissable: true,  obligatoire: false, multiple: true  },
  { code: "diplome",        libelle: "Diplôme / certification",icone: "🎓", perissable: false, obligatoire: false, multiple: true  },
  { code: "rib",            libelle: "RIB",                    icone: "🏦", perissable: false, obligatoire: true,  multiple: false },
  { code: "mutuelle",       libelle: "Mutuelle",               icone: "💊", perissable: false, obligatoire: false, multiple: false },
  { code: "arretTravail",   libelle: "Arrêt de travail",       icone: "🏥", perissable: false, obligatoire: false, multiple: true  },
  { code: "attestation",    libelle: "Attestation",            icone: "📃", perissable: false, obligatoire: false, multiple: true  },
  { code: "autre",          libelle: "Autre document",         icone: "📎", perissable: false, obligatoire: false, multiple: true  },
] as const;

const TYPE_PAR_DEFAUT: TypeDocumentRh = {
  code: "autre",
  libelle: "Autre document",
  icone: "📎",
  perissable: false,
  obligatoire: false,
  multiple: true,
};

/**
 * Le type décrit, même pour un code qu'on ne connaît plus.
 *
 * La colonne `type` est du texte libre : un document rangé sous un code retiré
 * du catalogue doit rester visible et supprimable, pas disparaître de l'écran
 * en laissant son fichier dans le bucket.
 */
export function typeDocumentRh(code?: string | null): TypeDocumentRh {
  const cherche = (code ?? "").trim();
  return TYPES_DOCUMENT_RH.find((t) => t.code === cherche) ?? TYPE_PAR_DEFAUT;
}

/** Le document tel que l'écran le manipule (colonnes converties en camelCase). */
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

/** Jours entre deux dates ISO ; négatif si la cible est passée. */
export function joursEntre(depuis: string, jusqua?: string | null): number | null {
  const cible = Date.parse(`${(jusqua ?? "").trim()}T00:00:00Z`);
  const origine = Date.parse(`${depuis}T00:00:00Z`);
  if (Number.isNaN(cible) || Number.isNaN(origine)) return null;
  return Math.round((cible - origine) / 86_400_000);
}

/**
 * Où en est ce document — et dans combien de temps.
 *
 * `permanent` n'est pas « bon pour toujours » : c'est « rien à surveiller ».
 * Un contrat de travail n'a pas d'échéance, une carte BTP sans date saisie non
 * plus — mais la seconde manque d'une information, ce que dit `sansEcheance`.
 */
export function etatDocumentRh(
  doc: DocumentRh,
  aujourdHui: string,
  seuilJours: number
): { etat: EtatDocumentRh; jours: number | null; sansEcheance: boolean } {
  const jours = joursEntre(aujourdHui, doc.dateExpiration);
  if (jours === null) {
    return {
      etat: "permanent",
      jours: null,
      sansEcheance: typeDocumentRh(doc.type).perissable,
    };
  }
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
 * L'état du dossier d'un salarié, en une passe.
 *
 * Un type obligatoire présent mais expiré n'est pas « manquant » : le document
 * existe, il est périmé. Les deux se réparent autrement — l'un se demande, l'autre
 * se renouvelle — et les confondre ferait compter le même défaut deux fois.
 */
export function dossierSalarie(
  documents: DocumentRh[],
  aujourdHui: string,
  seuilJours: number
): DossierSalarie {
  const deposes = new Set(documents.map((d) => (d.type ?? "").trim()));
  const manquants = TYPES_DOCUMENT_RH.filter(
    (t) => t.obligatoire && !deposes.has(t.code)
  );

  const expires: DocumentRh[] = [];
  const bientot: DocumentRh[] = [];
  const sansEcheance: DocumentRh[] = [];

  for (const doc of documents) {
    const { etat, sansEcheance: sans } = etatDocumentRh(doc, aujourdHui, seuilJours);
    if (etat === "expire") expires.push(doc);
    else if (etat === "bientot") bientot.push(doc);
    if (sans) sansEcheance.push(doc);
  }

  return {
    manquants,
    expires,
    bientot,
    sansEcheance,
    complet: manquants.length === 0 && expires.length === 0,
  };
}

/**
 * Comment nommer un document qu'on n'a pas nommé.
 *
 * Le champ `nom` est facultatif à la saisie ; sans repli, la liste afficherait
 * des lignes vides qu'on ne peut pas distinguer les unes des autres.
 */
export function libelleDocumentRh(doc: DocumentRh): string {
  const propre = (doc.nom ?? "").trim();
  if (propre) return propre;
  const fichier = (doc.fichierNom ?? "").trim();
  if (fichier) return fichier;
  return typeDocumentRh(doc.type).libelle;
}

/** Les plus urgents d'abord : expirés, puis par échéance, puis par nom. */
export function trierDocumentsRh(documents: DocumentRh[]): DocumentRh[] {
  return [...documents].sort((a, b) => {
    const ea = (a.dateExpiration ?? "").trim();
    const eb = (b.dateExpiration ?? "").trim();
    if (ea && eb && ea !== eb) return ea.localeCompare(eb);
    if (ea !== "" && eb === "") return -1;
    if (ea === "" && eb !== "") return 1;
    return libelleDocumentRh(a).localeCompare(libelleDocumentRh(b), "fr");
  });
}
