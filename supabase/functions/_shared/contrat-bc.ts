/**
 * Le contrat d'extraction d'un bon de commande, et le prompt qui le remplit.
 *
 * Repris de `~/Downloads/ocr_bon_travail.py` — schéma Pydantic et prompt
 * système — pour que la lecture déployée soit exactement celle qui a été
 * éprouvée à la main, et non une variante réécrite en chemin.
 *
 * Il vit dans `_shared` parce que deux appelants en dépendent : la fonction
 * `extraire-bc`, qui lit les bons pour de vrai, et le diagnostic, qui mesure.
 * Un contrat dupliqué finirait par diverger, et c'est le formulaire qui en
 * paierait le prix.
 *
 * Trois champs s'ajoutent à ce que l'ancien pipeline Gemini demandait :
 * `referenceChantier`, `natureTravaux` et `dateFinTravaux`. Ils existaient déjà
 * dans le formulaire et dans `saveBonCommande` ; seule la lecture automatique
 * ne les remplissait pas.
 *
 * `adresseIntervention` disparaît : `adresse` / `codePostal` / `ville`
 * désignent désormais le lieu d'intervention, ce qui correspond au libellé du
 * formulaire — et le champ que `saveBonCommande` enregistre réellement.
 *
 * `telephoneLocataire`, enfin : la colonne et le champ du formulaire existaient,
 * le contrat devis le lisait, celui du bon non. Deux bailleurs sur sept ont
 * signalé un numéro de locataire écrit sur le bon et resté vide à l'écran.
 */

import type { ContratLecture } from "./ocr-mistral.ts";
import { consignesDe, corrigerLecture, profilDe } from "./profils-bc.ts";

export const CHAMPS_TEXTE = [
  "client",
  "numeroBC",
  "dateBC",
  "referenceChantier",
  "natureTravaux",
  "dateFinTravaux",
  "interlocuteur",
  "adresse",
  "codePostal",
  "ville",
  "facturationAdresse",
  "facturationCodePostal",
  "facturationVille",
  "numeroLogement",
  "logementStatut",
  "occupant",
  "telephoneLocataire",
  "etage",
  "notes",
] as const;

export type ChampTexte = typeof CHAMPS_TEXTE[number];

export interface Ligne {
  type: "ligne" | "chapitre" | "commentaire";
  designation: string;
  qte?: number | null;
  unite?: string | null;
  prixUnitaire?: number | null;
  tva?: number | null;
}

export interface BonCommande {
  client?: string | null;
  numeroBC?: string | null;
  dateBC?: string | null;
  referenceChantier?: string | null;
  natureTravaux?: string | null;
  dateFinTravaux?: string | null;
  interlocuteur?: string | null;
  adresse?: string | null;
  codePostal?: string | null;
  ville?: string | null;
  facturationAdresse?: string | null;
  facturationCodePostal?: string | null;
  facturationVille?: string | null;
  numeroLogement?: string | null;
  logementStatut?: "occupé" | "vacant" | "commune" | null;
  occupant?: string | null;
  telephoneLocataire?: string | null;
  etage?: string | null;
  notes?: string | null;
  montantTotalHT?: number | null;
  lignes: Ligne[];
  avertissements: string[];
}

/**
 * Le prompt système, repris du script de référence, moins trois endroits.
 *
 * L'adresse : le bon porte presque toujours le siège de l'émetteur en en-tête,
 * et c'est lui qui remontait à la place du chantier. Écarter « l'entreprise
 * destinataire » ne suffisait pas — le piège, c'est l'adresse du client.
 * Ce champ devient `factures.adresse_locataire`, seule source du bloc
 * « Lieu d'intervention » de la facture : s'il se trompe, le document ne dit
 * plus où le travail a eu lieu.
 *
 * Les lignes : beaucoup de bons ne portent aucun tableau chiffré, seulement un
 * descriptif. Le modèle rendait alors une liste vide, et la facture s'inventait
 * sa ligne — « Travaux — BC n°… » au montant global. Il doit résumer ce qu'il y
 * a à faire même sans prix ; le chiffrage viendra plus tard.
 *
 * L'adresse de facturation, enfin, qui n'était pas demandée du tout. Elle n'est
 * ni le chantier ni l'en-tête : un bailleur fait adresser ses factures à un
 * service comptable, parfois propre au marché. `bc_generer_facture` la porte
 * jusqu'à `factures.facturation_*`, que la facture électronique lit avant
 * l'adresse du client.
 *
 * Les retours des utilisateurs du 30/09, bailleur par bailleur, ont fait
 * préciser le reste : où prendre le téléphone de l'interlocuteur, les formats
 * de date des bailleurs (« 29.09.2026 »), le sens de « logement sur passe », et
 * qu'un tableau de prestations peut courir sur plusieurs pages. Ce qui ne vaut
 * que pour un bailleur vit dans `profils-bc.ts`.
 */
export const PROMPT_SYSTEME =
  `Tu extrais les données d'un bon de commande / bon de travail français du BTP, fourni en Markdown issu d'un OCR.
Trois éléments comptent plus que les autres, parce que tout l'aval en dépend : le NUMÉRO DU BON, l'ADRESSE DU CHANTIER, et AU MOINS UNE LIGNE DE TRAVAUX. Cherche-les jusqu'au bout du document avant de rendre null, et si l'un manque vraiment, dis-le dans avertissements.

Règles :
- client : l'organisme qui ÉMET le bon (bailleur, mairie, syndic…), jamais l'entreprise destinataire.
- numeroBC : le numéro du bon, à chercher activement — « N° de commande », « Bon n° », « Commande n° », « BC », souvent en en-tête ou en pied. C'est la référence sous laquelle le client connaît l'affaire. Ne le confonds ni avec le n° d'affaire/dossier (referenceChantier) ni avec un n° de marché. referenceChantier : n° d'affaire ou de dossier.
- dateBC : date d'émission du bon — « du JJ/MM/AAAA » sous le numéro, « Édité le », « Date », ou la date de saisie ou de validation. dateFinTravaux : date limite d'exécution — « Fin d'exécution », « Date fin intervention », « à réaliser avant / pour le », la seconde date de « travaux à faire du … au … ». Rends les dates au format YYYY-MM-DD ; sur le bon elles s'écrivent JJ/MM/AAAA, JJ.MM.AAAA ou JJ/MM/AA (année 20AA).
- adresse / codePostal / ville : le LIEU D'INTERVENTION (chantier), résidence et appartement inclus dans adresse. Ni l'adresse de l'entreprise destinataire, ni celle du client qui émet le bon — son siège figure presque toujours en en-tête, c'est le piège à éviter. Cherche le bloc « lieu d'intervention », « adresse des travaux », « adresse d'exécution », « site » ou le logement désigné ; ce n'est jamais l'en-tête.
- facturationAdresse / facturationCodePostal / facturationVille : l'adresse OÙ ENVOYER LA FACTURE, quand le bon la désigne — bloc « adresse de facturation », « facture à adresser à », « service facturier », « comptabilité fournisseurs ». C'est une TROISIÈME adresse, distincte du chantier et de l'en-tête. Si le bon n'en désigne aucune, null : ne recopie pas l'en-tête à sa place.
- numeroLogement, etage : depuis le bloc lieu d'intervention.
- logementStatut : 'occupé' si un locataire est présent, 'vacant' si logement vide, 'commune' pour parties communes. « Logement sur passe », « logt sur pass » : le bailleur a remis la clé passe, le logement est vide → 'vacant'.
- occupant : nom du locataire présent. telephoneLocataire : le ou les numéros du LOCATAIRE (domicile, portable), souvent sur la ligne qui suit son nom ; jamais celui de l'interlocuteur.
- interlocuteur : gardien, gestionnaire ou chargé d'affaires côté client, avec SON téléphone si indiqué — celui écrit à côté de son nom, jamais le standard de l'en-tête ou du pied de page, ni celui de l'entreprise destinataire.
- notes : observations et consignes d'accès.
- lignes : une entrée par prestation, type 'ligne', designation = code article + intitulé + TOUTE la description qui suit (une seule ligne, jamais scindée). Le texte qui suit une prestation lui appartient ; mais une rangée qui porte son propre code article, sa propre quantité ou son propre prix est une NOUVELLE ligne : n'en fusionne jamais deux. type 'chapitre' uniquement pour un titre de section (corps de métier) situé dans la liste des prestations ; s'il n'y en a pas, aucun chapitre. Nombres avec point décimal.
- Le document est découpé par des marqueurs « --- Page n/N --- ». Un tableau de prestations peut se poursuivre sur plusieurs pages, son en-tête de colonnes répété : rends chaque rangée de CHAQUE page, dans l'ordre. Une annexe (attestation de TVA, conditions générales, plan de prévention) n'est pas le bon : n'en tire ni adresse, ni ligne, ni date.
- AU MOINS UNE ligne de type 'ligne' est obligatoire : elle dit ce qu'il y a à faire. Beaucoup de bons ne portent aucun tableau chiffré, seulement un descriptif ; dans ce cas, et dans ce cas SEULEMENT, résume les travaux demandés en une ligne (ou une par nature de travaux), qte/prixUnitaire à null. Un prix absent n'est pas une raison de ne pas rendre la ligne. Ne rends jamais une liste de lignes vide, ni faite uniquement de chapitres ou de commentaires.
- montantTotalHT : seulement s'il est écrit sur le bon.
- Ne devine jamais : valeur absente ou illisible = null, et une phrase courte dans avertissements (5 maximum).
`;

const texteNullable = { type: ["string", "null"] };
const nombreNullable = { type: ["number", "null"] };

/** Schéma JSON strict, pour le `response_format` de Mistral. */
export const SCHEMA_JSON = {
  type: "object",
  additionalProperties: false,
  properties: {
    client: texteNullable,
    numeroBC: texteNullable,
    dateBC: texteNullable,
    referenceChantier: texteNullable,
    natureTravaux: texteNullable,
    dateFinTravaux: texteNullable,
    interlocuteur: texteNullable,
    adresse: texteNullable,
    codePostal: texteNullable,
    ville: texteNullable,
    facturationAdresse: texteNullable,
    facturationCodePostal: texteNullable,
    facturationVille: texteNullable,
    numeroLogement: texteNullable,
    logementStatut: { type: ["string", "null"], enum: ["occupé", "vacant", "commune", null] },
    occupant: texteNullable,
    telephoneLocataire: texteNullable,
    etage: texteNullable,
    notes: texteNullable,
    montantTotalHT: nombreNullable,
    lignes: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          type: { type: "string", enum: ["ligne", "chapitre", "commentaire"] },
          designation: { type: "string" },
          qte: nombreNullable,
          unite: texteNullable,
          prixUnitaire: nombreNullable,
          tva: nombreNullable,
        },
        required: ["type", "designation", "qte", "unite", "prixUnitaire", "tva"],
      },
    },
    avertissements: { type: "array", items: { type: "string" } },
  },
  required: [
    ...CHAMPS_TEXTE,
    "montantTotalHT",
    "lignes",
    "avertissements",
  ],
};

/**
 * Validation minimale, sans dépendance.
 *
 * Zod vit dans le bundle de l'application ; la fonction edge est une unité de
 * déploiement séparée qui ne peut rien importer de `src/`. Le schéma strict de
 * Mistral fait déjà l'essentiel du travail ; ce filet attrape ce qu'un modèle
 * rend malgré lui — un champ au mauvais type, un `type` de ligne inventé — et
 * le dit en clair plutôt que de le laisser filer jusqu'au formulaire.
 */
export function ecartsDeForme(o: unknown): string[] {
  const e: string[] = [];
  if (!o || typeof o !== "object") return ["la réponse n'est pas un objet"];
  const b = o as Record<string, unknown>;

  for (const champ of CHAMPS_TEXTE) {
    const v = b[champ];
    if (v !== null && v !== undefined && typeof v !== "string") {
      e.push(`${champ} : ${typeof v} au lieu de texte`);
    }
  }
  if (b.montantTotalHT != null && typeof b.montantTotalHT !== "number") {
    e.push("montantTotalHT : pas un nombre");
  }
  if (b.logementStatut != null && !["occupé", "vacant", "commune"].includes(String(b.logementStatut))) {
    e.push(`logementStatut : « ${b.logementStatut} » hors des trois valeurs admises`);
  }
  if (!Array.isArray(b.lignes)) e.push("lignes : absent ou pas un tableau");
  else {
    b.lignes.forEach((l: Record<string, unknown>, i: number) => {
      if (!l || typeof l !== "object") { e.push(`lignes[${i}] : pas un objet`); return; }
      if (!["ligne", "chapitre", "commentaire"].includes(String(l.type))) {
        e.push(`lignes[${i}].type : « ${l.type} » inconnu`);
      }
      if (typeof l.designation !== "string") e.push(`lignes[${i}].designation : absente`);
    });
  }
  if (!Array.isArray(b.avertissements)) e.push("avertissements : absent ou pas un tableau");
  return e;
}

export const CONTRAT_BC: ContratLecture = {
  nom: "bon_commande",
  intitule: "Voici le bon en Markdown :",
  leDocument: "ce bon",
  promptSysteme: PROMPT_SYSTEME,
  schemaJson: SCHEMA_JSON,
  ecartsDeForme,
  consignesDuDocument(markdown) {
    const profil = profilDe(markdown);
    return profil ? { nom: profil.nom, texte: consignesDe(profil) } : null;
  },
  apresLecture: corrigerLecture,
};
