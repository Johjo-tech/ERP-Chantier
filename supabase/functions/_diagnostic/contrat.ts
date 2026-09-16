/**
 * Ce que le diagnostic ajoute au contrat partagé.
 *
 * Le contrat lui-même — prompt, schéma strict, validation de forme — vit
 * désormais dans `_shared/contrat-bc.ts`, où la fonction déployée le lit aussi.
 * Ne reste ici que la traduction du schéma pour Gemini, qui n'a plus d'appelant
 * en production depuis la bascule sur Mistral mais garde sa colonne dans la
 * comparaison : un diagnostic qui perdrait le terme de référence ne mesurerait
 * plus rien.
 */

export * from "../_shared/contrat-bc.ts";

import { CHAMPS_TEXTE } from "../_shared/contrat-bc.ts";

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

