/**
 * Extraction structurée d'un bon de commande (PDF ou image) via Gemini.
 *
 * La clé API vit dans les secrets Supabase (`GEMINI_API_KEY`), lue avec
 * Deno.env et passée en en-tête `x-goog-api-key` — jamais dans l'URL, pour
 * qu'elle n'apparaisse pas dans les logs. La fonction est déployée avec
 * verify_jwt : seul un utilisateur connecté de l'application peut l'appeler.
 *
 * Entrée  : { fichierBase64, mimeType }
 * Sortie  : { extraction: ExtractionBC } — champs alignés sur BonCommandeSaisi
 *           côté front, plus une liste d'avertissements de lecture.
 */ const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};
const MIMES_ACCEPTES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp"
]);
/** ~14 Mo une fois décodé : au-delà, demander un PDF allégé. */ const BASE64_MAX = 20_000_000;
/** Schéma de réponse imposé à Gemini (sous-ensemble OpenAPI supporté). */ const SCHEMA_EXTRACTION = {
  type: "OBJECT",
  properties: {
    client: {
      type: "STRING",
      description: "Nom du donneur d'ordre / client qui émet le bon de commande",
      nullable: true
    },
    numeroBC: {
      type: "STRING",
      description: "Numéro du bon de commande attribué par le client",
      nullable: true
    },
    dateBC: {
      type: "STRING",
      description: "Date du bon au format YYYY-MM-DD",
      nullable: true
    },
    interlocuteur: {
      type: "STRING",
      description: "Personne de contact chez le client (gestionnaire, chargé d'affaires…)",
      nullable: true
    },
    adresse: {
      type: "STRING",
      description: "Adresse du client (rue)",
      nullable: true
    },
    codePostal: {
      type: "STRING",
      nullable: true
    },
    ville: {
      type: "STRING",
      nullable: true
    },
    adresseIntervention: {
      type: "STRING",
      description: "Lieu d'intervention / de chantier s'il diffère de l'adresse du client, sinon null",
      nullable: true
    },
    numeroLogement: {
      type: "STRING",
      description: "Numéro de logement ou d'appartement",
      nullable: true
    },
    logementStatut: {
      type: "STRING",
      description: "occupé, vacant ou commune (partie commune) ; null si non précisé",
      enum: [
        "occupé",
        "vacant",
        "commune"
      ],
      nullable: true
    },
    occupant: {
      type: "STRING",
      description: "Nom du locataire / occupant",
      nullable: true
    },
    etage: {
      type: "STRING",
      nullable: true
    },
    notes: {
      type: "STRING",
      description: "Consignes ou remarques utiles figurant sur le bon (accès, horaires…)",
      nullable: true
    },
    montantTotalHT: {
      type: "NUMBER",
      description: "Montant total HT du bon",
      nullable: true
    },
    lignes: {
      type: "ARRAY",
      description: "Détail des travaux dans l'ordre du document. Les titres de sections deviennent des lignes de type chapitre.",
      items: {
        type: "OBJECT",
        properties: {
          type: {
            type: "STRING",
            enum: [
              "ligne",
              "chapitre",
              "commentaire"
            ]
          },
          designation: {
            type: "STRING"
          },
          qte: {
            type: "NUMBER",
            nullable: true
          },
          unite: {
            type: "STRING",
            description: "u, m², ml, h, forfait…",
            nullable: true
          },
          prixUnitaire: {
            type: "NUMBER",
            description: "Prix unitaire HT",
            nullable: true
          },
          tva: {
            type: "NUMBER",
            description: "Taux de TVA en % si indiqué",
            nullable: true
          }
        },
        required: [
          "type",
          "designation"
        ]
      }
    },
    avertissements: {
      type: "ARRAY",
      description: "Ce qui n'a pas pu être lu avec certitude : champ illisible, montant incohérent, page manquante…",
      items: {
        type: "STRING"
      }
    }
  },
  required: [
    "lignes",
    "avertissements"
  ]
};
const PROMPT = `Tu lis un bon de commande de travaux du bâtiment envoyé par un donneur d'ordre
(bailleur social, syndic, entreprise…) à une entreprise du BTP.

Extrais fidèlement les informations demandées par le schéma JSON. Règles :
- Ne devine jamais : un champ absent ou illisible vaut null, et tu le signales
  dans "avertissements".
- "client" est l'ÉMETTEUR du bon (le donneur d'ordre), pas l'entreprise de
  travaux destinataire.
- Recopie les désignations de travaux telles quelles, sans reformuler.
- Les montants sont en euros HT ; convertis "1 234,56" en 1234.56.
- Les dates sont au format YYYY-MM-DD.
- Si le total affiché sur le document ne correspond pas à la somme des lignes,
  signale-le dans "avertissements".`;
function reponse(statut, corps) {
  return new Response(JSON.stringify(corps), {
    status: statut,
    headers: {
      ...CORS,
      "Content-Type": "application/json"
    }
  });
}
Deno.serve(async (req)=>{
  if (req.method === "OPTIONS") return new Response("ok", {
    headers: CORS
  });
  if (req.method !== "POST") return reponse(405, {
    erreur: "Méthode non autorisée"
  });
  const cle = Deno.env.get("GEMINI_API_KEY");
  if (!cle) return reponse(500, {
    erreur: "GEMINI_API_KEY absente des secrets Supabase"
  });
  let corps;
  try {
    corps = await req.json();
  } catch  {
    return reponse(400, {
      erreur: "Corps JSON invalide"
    });
  }
  const { fichierBase64, mimeType } = corps;
  if (!fichierBase64 || !mimeType) {
    return reponse(400, {
      erreur: "fichierBase64 et mimeType sont requis"
    });
  }
  if (!MIMES_ACCEPTES.has(mimeType)) {
    return reponse(400, {
      erreur: `Type de fichier non pris en charge : ${mimeType}`
    });
  }
  if (fichierBase64.length > BASE64_MAX) {
    return reponse(413, {
      erreur: "Fichier trop volumineux (limite ~14 Mo)"
    });
  }
  const modeles = Deno.env.get("GEMINI_MODEL") ? [
    Deno.env.get("GEMINI_MODEL")
  ] : [
    "gemini-3.7-flash",
    "gemini-3.8-flash",
    "gemini-3.6-flash"
  ];
  const geminiBody = JSON.stringify({
    contents: [
      {
        parts: [
          {
            inline_data: {
              mime_type: mimeType,
              data: fichierBase64
            }
          },
          {
            text: PROMPT
          }
        ]
      }
    ],
    generationConfig: {
      temperature: 0,
      response_mime_type: "application/json",
      response_schema: SCHEMA_EXTRACTION
    }
  });
  let rep = null;
  let modeleUtilise = modeles[0];
  for (const modele of modeles){
    modeleUtilise = modele;
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modele}:generateContent`;
    const MAX_TENTATIVES = 2;
    for(let tentative = 0; tentative < MAX_TENTATIVES; tentative++){
      rep = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": cle
        },
        body: geminiBody
      });
      if (rep.status !== 503 && rep.status !== 429) break;
      console.error(`Gemini ${rep.status} (${modele}) — tentative ${tentative + 1}/${MAX_TENTATIVES}`);
      if (tentative < MAX_TENTATIVES - 1) {
        await new Promise((r)=>setTimeout(r, 2000));
      }
    }
    if (rep.ok) break;
    if (rep.status === 503 || rep.status === 429 || rep.status === 404) {
      console.error(`${modele} indisponible (${rep.status}), essai du modèle suivant…`);
      continue;
    }
    break;
  }
  if (!rep.ok) {
    const detail = await rep.text();
    console.error(`Gemini ${rep.status} (modèle ${modeleUtilise}) : ${detail.slice(0, 500)}`);
    if (rep.status === 403) {
      return reponse(502, {
        erreur: "Accès Gemini refusé (PERMISSION_DENIED) : vérifier la clé, ou ajouter le rôle " + "roles/serviceusage.serviceUsageConsumer au compte de service dans IAM."
      });
    }
    if (rep.status === 503 || rep.status === 429) {
      return reponse(503, {
        erreur: "Tous les modèles Gemini sont temporairement surchargés, réessayez dans quelques secondes."
      });
    }
    return reponse(502, {
      erreur: `Erreur Gemini (${rep.status})`
    });
  }
  const json = await rep.json();
  const texte = json.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!texte) {
    console.error("Réponse Gemini sans contenu :", JSON.stringify(json).slice(0, 500));
    return reponse(502, {
      erreur: "Réponse Gemini vide ou bloquée"
    });
  }
  try {
    return reponse(200, {
      extraction: JSON.parse(texte)
    });
  } catch  {
    console.error("JSON Gemini invalide :", texte.slice(0, 500));
    return reponse(502, {
      erreur: "Extraction illisible, réessayer"
    });
  }
});
