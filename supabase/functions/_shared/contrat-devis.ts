/**
 * Ce qu'on lit sur un devis, et ce qu'on refuse d'en lire.
 *
 * Sert à relire dans l'ERP un devis qui n'existe que dans l'ancien logiciel,
 * depuis son PDF. Le devis y garde son NUMÉRO d'origine : c'est la référence
 * que le client a sous les yeux, et la relecture n'aurait guère de sens si elle
 * la perdait.
 *
 * ── POURQUOI CE PROMPT N'EST PAS CELUI DU BON DE COMMANDE ───────────────────
 * Le contrat du bon répond à des pièges de bon. Celui du devis en a d'autres,
 * et le premier est exactement INVERSE : un bon est émis par le client et nous
 * est adressé ; un devis est émis par NOUS et lui est adressé. Sur un bon,
 * l'en-tête porte le client — c'est ce que le prompt du bon exploite. Sur un
 * devis, l'en-tête porte notre propre raison sociale, et la prendre pour le
 * client est l'erreur la plus facile à commettre.
 *
 * Les autres écarts : sur un bon, les prix sont souvent absents et le prompt
 * insiste pour qu'une ligne sorte quand même ; un devis EST un chiffrage, ses
 * quantités et ses prix unitaires sont le cœur du document. Un bon ne connaît
 * ni lot, ni option, ni tranche conditionnelle ; un devis de BTP vit avec.
 *
 * ── LES CHAMPS SONT CEUX QUE `devis` SAIT STOCKER ───────────────────────────
 * Rien de plus : un champ sans colonne serait écarté en silence par
 * `versDb`, et on aurait extrait pour rien. Ce que le devis dit sans avoir de
 * colonne — durée de validité, délai d'exécution, acompte — part en ligne de
 * commentaire, qui ne compte dans aucun total.
 *
 * Module `_shared` : il ne peut rien importer de `src/`, la fonction edge
 * étant une unité de déploiement séparée. Son miroir côté navigateur est
 * recopié à la main dans `src/integrations/ocr.ts`.
 */

import type { ContratLecture } from "./ocr-mistral.ts";

/** Les champs de tête, tous textuels et tous facultatifs. */
export const CHAMPS_TEXTE = [
  "numeroDevis",
  "dateDevis",
  "client",
  "interlocuteur",
  "adresseChantier",
  "codePostal",
  "ville",
  "logementStatut",
  "occupant",
  "ancienLocataire",
  "precisionCommune",
  "etage",
  "numeroLogement",
  "telephoneLocataire",
  "dureeValidite",
  "delaiExecution",
  "conditionsPaiement",
  "acompte",
] as const;

export interface LigneDevis {
  type: "ligne" | "chapitre" | "commentaire";
  designation: string;
  qte?: number | null;
  unite?: string | null;
  prixUnitaire?: number | null;
  tva?: number | null;
  /** Hors du total : option, variante, plus-value. */
  optionnelle?: boolean | null;
  tranche?: "ferme" | "conditionnelle" | null;
}

export interface Devis {
  numeroDevis: string | null;
  dateDevis: string | null;
  client: string | null;
  interlocuteur: string | null;
  adresseChantier: string | null;
  codePostal: string | null;
  ville: string | null;
  logementStatut: "occupé" | "vacant" | "commune" | null;
  occupant: string | null;
  ancienLocataire: string | null;
  precisionCommune: string | null;
  etage: string | null;
  numeroLogement: string | null;
  telephoneLocataire: string | null;
  dureeValidite: string | null;
  delaiExecution: string | null;
  conditionsPaiement: string | null;
  acompte: string | null;
  remisePourcentage: number | null;
  remiseMontantHT: number | null;
  /** Les totaux IMPRIMÉS sur le devis. Servent de contrôle, jamais de calcul. */
  totalHT: number | null;
  totalTVA: number | null;
  totalTTC: number | null;
  lignes: LigneDevis[];
  avertissements: string[];
}

export const PROMPT_SYSTEME = `Tu extrais les données d'un DEVIS français du BTP, fourni en Markdown issu d'un OCR.

QUI EST QUI — le piège n°1, et il est INVERSE de celui d'un bon de commande.
Un devis est émis par NOUS, l'entreprise de travaux, et adressé à un CLIENT. L'en-tête porte donc presque toujours NOTRE raison sociale, notre logo, notre SIRET, notre assurance décennale : ce n'est JAMAIS le client. Le client est le DESTINATAIRE — bloc « Devis pour », « Client », « À l'attention de », « Maître d'ouvrage », « Adressé à », le plus souvent à droite ou sous l'en-tête. Si tu hésites entre deux raisons sociales, celle qui porte le SIRET, le RCS, le n° de TVA, le capital social ou l'assurance décennale en pied de page est l'ÉMETTEUR : écarte-la.

QUATRE ÉLÉMENTS COMPTENT PLUS QUE LES AUTRES, parce que tout l'aval en dépend : le NUMÉRO du devis, sa DATE, le CLIENT, et des LIGNES CHIFFRÉES. Cherche-les jusqu'au bout du document avant de rendre null, et si l'un manque vraiment, dis-le dans avertissements.

Règles :

- numeroDevis : le numéro tel qu'il est ÉCRIT — « Devis n° », « N° », « Réf. », « Proposition n° », « Offre n° », en en-tête ou en pied. Rends-le À L'IDENTIQUE : préfixe, tirets, barres obliques, zéros de tête et espaces internes compris (« D-2023-0147 », « DEV 23/0147 », « 2023-147 »). Ne le reformate pas, ne le complète pas, n'invente aucun préfixe. Ne le confonds ni avec un numéro de page, ni avec le SIRET, le n° de TVA, le n° de marché, le n° de lot, le code client, ni avec le numéro de la commande ou de l'appel d'offres auquel le devis répond.

- dateDevis : la date d'établissement du devis, au format YYYY-MM-DD. Si le document porte plusieurs dates (édition, visite, validité), prends celle d'établissement. dureeValidite : le texte tel quel (« valable 1 mois », « offre valable 90 jours »).

- client : le DESTINATAIRE (voir ci-dessus). interlocuteur : la personne nommée côté client — « à l'attention de », gestionnaire, gardien, chargé d'opération, architecte — avec son téléphone s'il est indiqué.

- adresseChantier / codePostal / ville : le LIEU DES TRAVAUX. Cherche « Adresse des travaux », « Chantier », « Lieu d'intervention », « Objet », « Site ». Ce n'est ni notre en-tête, ni le siège du client.
  Beaucoup de devis n'ont PAS de bloc dédié : l'adresse est alors écrite dans le tableau, en titre de section ou dans les premières lignes de description. Cherche-la là aussi. Mais beaucoup de devis n'en portent AUCUNE — ni en tête, ni dans le tableau : c'est fréquent quand le client est un bailleur qui suit ses affaires par une référence. Dans ce cas, null et un avertissement ; ne prends pas une référence de dossier, un code résidence entre parenthèses ni un numéro d'affaire pour une adresse. Les TROIS champs se partagent l'adresse, ils ne la répètent pas : adresseChantier porte la voie, la résidence, le bâtiment et l'appartement ; codePostal porte les cinq chiffres et rien d'autre ; ville porte la commune et rien d'autre. N'écris JAMAIS la commune ou le code postal dans adresseChantier : recopiés des deux côtés, ils ressortent en double sur le document imprimé. Si le devis ne donne que l'adresse du client, laisse les trois à null et dis-le dans avertissements.

- numeroLogement, etage : depuis le bloc du lieu des travaux.

- logementStatut ne se DÉDUIT pas, il se LIT : 'occupé' seulement si le document dit que le logement l'est ou nomme son locataire comme tel, 'vacant' seulement s'il est dit vide, libéré ou en remise en état, 'commune' pour des parties communes explicitement désignées (hall, cage d'escalier, local vélos, toiture, parking, cave). Un nom de personne sur le document ne suffit PAS à conclure que le logement est occupé. Dans le doute, null.

- occupant est le LOCATAIRE, et lui seul. Un gardien, un concierge, un chargé de secteur, un gestionnaire, un responsable de site ou un référent technique ne sont PAS des occupants : ce sont des interlocuteurs, et leur nom va dans interlocuteur — jamais dans les deux à la fois. Un nom accompagné de la mention « gardien », « concierge », « gestionnaire », « chargé de », « contact » ou d'un numéro de portable professionnel est un interlocuteur. ancienLocataire : le nom de celui qui est parti, sur un logement vacant. precisionCommune : quelle partie commune. telephoneLocataire : le téléphone du LOCATAIRE, pas celui du gardien.

- lignes : le cœur du devis. Une entrée par ligne du tableau de prix, DANS L'ORDRE du document.
  * type 'chapitre' pour un titre de LOT ou de SOUS-LOT — « LOT 2 — PLOMBERIE », « 3.1 Revêtements de sol », « DÉMOLITION ». Rends les deux niveaux, chacun comme un chapitre, dans l'ordre. Un chapitre ne porte NI quantité NI prix : si un sous-total figure en face d'un titre de lot, ce n'est pas une prestation — ne le rends pas.
  * type 'ligne' pour une prestation chiffrée. designation = le numéro de poste s'il existe, puis l'intitulé, puis TOUTE la description qui le suit, en UNE seule chaîne, jamais scindée.
  * type 'commentaire' pour un texte libre du tableau qui ne se chiffre pas.
  * qte et prixUnitaire comptent VRAIMENT ici, contrairement à un bon de commande : un devis EST un chiffrage. Rends les deux dès qu'ils figurent, même à 0. Nombres avec point décimal, sans séparateur de milliers ni symbole : « 1 250,50 € » donne 1250.50 ; « 12,5 m² » donne qte 12.5 et unite « m² ». prixUnitaire est le prix UNITAIRE HT, jamais le total de la ligne : quand les deux colonnes figurent, prends celle du prix unitaire.
  * unite : telle qu'écrite, normalisée en minuscules sur les formes usuelles — u, ens, ml, m, m², m³, kg, l, h, j, forfait. « ML » donne « ml » ; « M2 » ou « m2 » donne « m² » ; « U », « Unité », « pce », « pièce » donnent « u » ; « Ft », « Fft », « Forfait » donnent « forfait » ; « Ens. » donne « ens ». N'invente aucune unité : si la colonne est vide, null.
  * tva : le TAUX de la ligne en pourcentage (5.5, 10, 20), jamais le montant de TVA. En rénovation de logement de plus de deux ans, 10 % est courant et 5,5 % s'applique aux travaux d'amélioration énergétique ; 20 % au neuf et aux locaux non résidentiels. Si le devis porte un taux par ligne, rends-le ligne par ligne. S'il n'en porte qu'un seul pour tout le document, rends CE taux sur CHAQUE ligne. S'il n'en porte aucun, rends null — JAMAIS 0 : 0 signifie exonéré ou autoliquidé, ce que « non indiqué » ne veut pas dire.
  * optionnelle : true si la ligne est présentée en option, en variante, en « plus-value », « en option », « si besoin », ou dans un bloc « OPTIONS » — c'est-à-dire si elle n'entre PAS dans le total du devis. Sinon false.
  * tranche : 'ferme' ou 'conditionnelle' quand le devis distingue des tranches ; null s'il n'en parle pas.
  Ne rends jamais une liste de lignes vide, ni faite uniquement de chapitres et de commentaires.

- remisePourcentage / remiseMontantHT : la remise GLOBALE accordée en bas de tableau — « remise commerciale », « geste commercial », « remise exceptionnelle ». Rends le pourcentage s'il est écrit, le montant HT sinon, et null pour l'autre. Une remise déjà répercutée dans les prix unitaires n'est pas une remise globale : ne la compte pas deux fois.

- totalHT, totalTVA, totalTTC : les totaux tels qu'ils sont IMPRIMÉS sur le devis, après remise. Ils servent de contrôle, pas de calcul : ne les recalcule pas, et s'ils ne figurent pas, null.

- acompte, delaiExecution, conditionsPaiement : le texte tel quel, sans reformulation (« 30 % à la commande », « 3 semaines à compter de l'accord », « paiement à 30 jours fin de mois »).

CE QU'IL NE FAUT PAS EXTRAIRE — rien de tout ceci n'a de champ, et l'y forcer abîme un champ voisin :
- notre identité d'émetteur : raison sociale, adresse, SIRET, RCS, n° de TVA intracommunautaire, capital social, IBAN, code APE, assurance décennale et n° de police, qualifications (Qualibat, RGE), logo ;
- les mentions légales et les conditions générales de vente : réserve de propriété, pénalités de retard, indemnité de recouvrement, médiation de la consommation, droit de rétractation, « devis gratuit », protection des données ;
- les blocs de signature — « Bon pour accord », « Lu et approuvé », date et lieu à remplir, cachet — même remplis. Le statut du devis ne s'extrait pas : si le devis est signé, dis-le dans avertissements ;
- les en-têtes et pieds de page répétés, les numéros de page, les sous-totaux de lot, les reports de page (« report », « à reporter », « total page ») : ce ne sont pas des lignes ;
- tout montant déjà agrégé : le total d'un lot n'est pas une prestation.

Ne devine jamais : valeur absente ou illisible = null, et une phrase courte dans avertissements (5 maximum). Signale en particulier : numéro de devis non trouvé, adresse de chantier absente, total imprimé qui ne correspond pas à la somme des lignes, devis signé, lignes en option ou en tranche conditionnelle.`;

const TEXTE_OU_NUL = { type: ["string", "null"] };
const NOMBRE_OU_NUL = { type: ["number", "null"] };

export const SCHEMA_JSON = {
  type: "object",
  additionalProperties: false,
  properties: {
    ...Object.fromEntries(CHAMPS_TEXTE.map((c) => [c, { ...TEXTE_OU_NUL }])),
    logementStatut: { type: ["string", "null"], enum: ["occupé", "vacant", "commune", null] },
    remisePourcentage: { ...NOMBRE_OU_NUL },
    remiseMontantHT: { ...NOMBRE_OU_NUL },
    totalHT: { ...NOMBRE_OU_NUL },
    totalTVA: { ...NOMBRE_OU_NUL },
    totalTTC: { ...NOMBRE_OU_NUL },
    lignes: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          type: { type: "string", enum: ["ligne", "chapitre", "commentaire"] },
          designation: { type: "string" },
          qte: { ...NOMBRE_OU_NUL },
          unite: { ...TEXTE_OU_NUL },
          prixUnitaire: { ...NOMBRE_OU_NUL },
          tva: { ...NOMBRE_OU_NUL },
          optionnelle: { type: ["boolean", "null"] },
          tranche: { type: ["string", "null"], enum: ["ferme", "conditionnelle", null] },
        },
        required: [
          "type", "designation", "qte", "unite", "prixUnitaire", "tva", "optionnelle", "tranche",
        ],
      },
    },
    avertissements: { type: "array", items: { type: "string" } },
  },
  /* `strict: true` chez Mistral exige que TOUTES les propriétés soient
     requises, y compris celles qui admettent null. */
  required: [
    ...CHAMPS_TEXTE,
    "remisePourcentage", "remiseMontantHT",
    "totalHT", "totalTVA", "totalTTC",
    "lignes", "avertissements",
  ],
};

const STATUTS = ["occupé", "vacant", "commune"];
const TRANCHES = ["ferme", "conditionnelle"];
const NOMBRES = ["remisePourcentage", "remiseMontantHT", "totalHT", "totalTVA", "totalTTC"];

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
  const d = o as Record<string, unknown>;

  for (const champ of CHAMPS_TEXTE) {
    const v = d[champ];
    if (v !== null && v !== undefined && typeof v !== "string") {
      e.push(`${champ} : ${typeof v} au lieu de texte`);
    }
  }
  for (const champ of NOMBRES) {
    if (d[champ] != null && typeof d[champ] !== "number") e.push(`${champ} : pas un nombre`);
  }
  if (d.logementStatut != null && !STATUTS.includes(String(d.logementStatut))) {
    e.push(`logementStatut : « ${d.logementStatut} » hors des trois valeurs admises`);
  }
  /* La remise sort du [0,100] de la colonne : le signaler ici évite un rejet
     de l'insertion ENTIÈRE par la contrainte CHECK, plus loin et sans contexte. */
  if (typeof d.remisePourcentage === "number" && (d.remisePourcentage < 0 || d.remisePourcentage > 100)) {
    e.push(`remisePourcentage : ${d.remisePourcentage} hors de [0, 100]`);
  }
  if (!Array.isArray(d.lignes)) e.push("lignes : absent ou pas un tableau");
  else {
    d.lignes.forEach((l: Record<string, unknown>, i: number) => {
      if (!l || typeof l !== "object") { e.push(`lignes[${i}] : pas un objet`); return; }
      if (!["ligne", "chapitre", "commentaire"].includes(String(l.type))) {
        e.push(`lignes[${i}].type : « ${l.type} » inconnu`);
      }
      if (typeof l.designation !== "string") e.push(`lignes[${i}].designation : absente`);
      if (l.tranche != null && !TRANCHES.includes(String(l.tranche))) {
        e.push(`lignes[${i}].tranche : « ${l.tranche} » inconnue`);
      }
    });
  }
  if (!Array.isArray(d.avertissements)) e.push("avertissements : absent ou pas un tableau");
  return e;
}

export const CONTRAT_DEVIS: ContratLecture = {
  nom: "devis",
  intitule: "Voici le devis en Markdown :",
  leDocument: "ce devis",
  promptSysteme: PROMPT_SYSTEME,
  schemaJson: SCHEMA_JSON,
  ecartsDeForme,
  /* Un devis de BTP fait 3 à 10 pages là où un bon en fait 1 ou 2 : le Markdown
     rendu au modèle est bien plus gros, et 45 s deviennent serrées. La marge
     sur le mur de la plateforme (150 s) reste de 25 s. */
  budget: {
    delaiOcrMs: 60_000,
    delaiExtractionMs: 60_000,
    budgetTotalMs: 125_000,
    markdownMax: 220_000,
  },
};
