/**
 * Le contrat d'extraction d'un bon de commande, et le prompt qui le remplit.
 *
 * Repris de `~/Downloads/ocr_bon_travail.py` — schéma Pydantic et prompt
 * système — pour que le diagnostic éprouve exactement ce qui a été validé à la
 * main, et non une variante réécrite en chemin.
 *
 * Trois champs s'ajoutent à ce que la fonction Gemini demande aujourd'hui :
 * `referenceChantier`, `natureTravaux` et `dateFinTravaux`. Ils existent déjà
 * dans le formulaire et dans `saveBonCommande` ; seule la lecture automatique
 * ne les remplissait pas.
 *
 * `adresseIntervention` disparaît : `adresse` / `codePostal` / `ville`
 * désignent désormais le lieu d'intervention, ce qui correspond au libellé du
 * formulaire.
 */

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
  "numeroLogement",
  "logementStatut",
  "occupant",
  "etage",
  "notes",
] as const;

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
  numeroLogement?: string | null;
  logementStatut?: "occupé" | "vacant" | "commune" | null;
  occupant?: string | null;
  etage?: string | null;
  notes?: string | null;
  montantTotalHT?: number | null;
  lignes: Ligne[];
  avertissements: string[];
}

/** Le prompt système, mot pour mot celui du script de référence. */
export const PROMPT_SYSTEME =
  `Tu extrais les données d'un bon de commande / bon de travail français du BTP, fourni en Markdown issu d'un OCR.
Règles :
- client : l'organisme qui ÉMET le bon (bailleur, mairie, syndic…), jamais l'entreprise destinataire.
- numeroBC : le numéro du bon. dateBC : date d'édition du bon. referenceChantier : n° d'affaire ou de dossier.
- dateFinTravaux : date limite d'exécution. Dates au format YYYY-MM-DD.
- adresse / codePostal / ville : le LIEU D'INTERVENTION (chantier), résidence et appartement inclus dans adresse. Jamais l'adresse de l'entreprise destinataire.
- numeroLogement, etage : depuis le bloc lieu d'intervention.
- logementStatut : 'occupé' si un locataire est présent, 'vacant' si logement vide, 'commune' pour parties communes.
- occupant : nom du locataire présent. interlocuteur : gardien, gestionnaire ou chargé d'affaires côté client, avec téléphone si indiqué.
- notes : observations et consignes d'accès.
- lignes : une entrée par prestation, type 'ligne', designation = code article + intitulé + TOUTE la description qui suit (une seule ligne, jamais scindée). type 'chapitre' uniquement pour un titre de section (corps de métier) situé dans la liste des prestations ; s'il n'y en a pas, aucun chapitre. Nombres avec point décimal.
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
    numeroLogement: texteNullable,
    logementStatut: { type: ["string", "null"], enum: ["occupé", "vacant", "commune", null] },
    occupant: texteNullable,
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

/** Même schéma, dans le sous-ensemble OpenAPI que Gemini accepte. */
export const SCHEMA_GEMINI = {
  type: "OBJECT",
  properties: Object.fromEntries([
    ...CHAMPS_TEXTE.map((c) => [
      c,
      c === "logementStatut"
        ? { type: "STRING", enum: ["occupé", "vacant", "commune"], nullable: true }
        : { type: "STRING", nullable: true },
    ]),
    ["montantTotalHT", { type: "NUMBER", nullable: true }],
    [
      "lignes",
      {
        type: "ARRAY",
        items: {
          type: "OBJECT",
          properties: {
            type: { type: "STRING", enum: ["ligne", "chapitre", "commentaire"] },
            designation: { type: "STRING" },
            qte: { type: "NUMBER", nullable: true },
            unite: { type: "STRING", nullable: true },
            prixUnitaire: { type: "NUMBER", nullable: true },
            tva: { type: "NUMBER", nullable: true },
          },
          required: ["type", "designation"],
        },
      },
    ],
    ["avertissements", { type: "ARRAY", items: { type: "STRING" } }],
  ]),
  required: ["lignes", "avertissements"],
};

/**
 * Validation minimale, sans dépendance.
 *
 * Zod vit dans le bundle de l'application ; la fonction edge est une unité de
 * déploiement séparée qui ne peut rien importer de `src/`. Pour un diagnostic,
 * une vérification de forme suffit — l'intégration, elle, portera un vrai
 * schéma partagé.
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
