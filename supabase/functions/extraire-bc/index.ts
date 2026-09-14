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

/* --- Le budget de temps ---------------------------------------------------
 *
 * La plateforme tue l'isolat à 150 s de temps mural. Le 14/09/2026, un appel
 * Gemini resté sans réponse a consommé ce budget en entier : la fonction est
 * morte sans émettre la moindre réponse HTTP (`reason: WallClockTime`,
 * `cpu_time_used: 26 ms`), et le navigateur, dont la promesse ne s'est jamais
 * résolue, affichait encore « Lecture en cours » indéfiniment.
 *
 * Ces trois constantes garantissent qu'on rend toujours la main, et à temps
 * pour le dire. */

/** Au-delà, on tient pour acquis que ce modèle ne répondra pas. */ const DELAI_GEMINI_MS = 45_000;
/** Ce qu'on s'autorise en tout : 40 s de marge sur la limite de la plateforme. */ const BUDGET_TOTAL_MS = 110_000;
/** Entre deux passes, et seulement si tous les modèles ont saturé. */ const PAUSE_REESSAI_MS = 2_000;
/** Deux passes : la première bascule de modèle, la seconde patiente. */ const PASSES = 2;

/** Trois pools de capacité distincts : le repli quand l'un sature. */ const MODELES_PAR_DEFAUT = [
  "gemini-3.7-flash",
  "gemini-3.8-flash",
  "gemini-3.6-flash"
];

/** `GEMINI_MODEL` est un levier d'urgence : il prive du repli, donc il ne sert
 *  qu'à forcer un modèle précis le temps d'un incident. */ function modelesDisponibles() {
  const force = Deno.env.get("GEMINI_MODEL");
  return force ? [
    force
  ] : MODELES_PAR_DEFAUT;
}
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
/**
 * Interroge Gemini jusqu'à une réponse, ou jusqu'à épuisement du budget.
 *
 * Un 503 dit « ce pool est saturé **maintenant** ». Réinterroger le même modèle
 * deux secondes plus tard, comme on le faisait, dépense le budget à réentendre
 * le même refus — c'est exactement ce qui a coûté les 150 s du 14/09. On passe
 * donc immédiatement au modèle suivant, dont la capacité est distincte, et la
 * seconde passe n'a lieu que si les trois ont saturé.
 *
 * Rend toujours de quoi répondre : la réponse obtenue, ou `null` avec la raison.
 */ async function appelerGemini(cle, corpsGemini, tracer, debut) {
  const modeles = modelesDisponibles();
  let derniere = null;
  let modeleUtilise = modeles[0];
  for(let passe = 0; passe < PASSES; passe++){
    if (passe > 0) {
      // Ne pas dormir sur un budget déjà vide : ces deux secondes ne serviraient
      // qu'à retarder la réponse d'échec.
      if (BUDGET_TOTAL_MS - (Date.now() - debut) <= PAUSE_REESSAI_MS) {
        tracer("budget épuisé, pas de seconde passe");
        return {
          rep: derniere,
          modeleUtilise,
          modeles,
          budgetEpuise: true
        };
      }
      tracer("tous les modèles saturés, une pause puis nouvelle passe");
      await new Promise((r)=>setTimeout(r, PAUSE_REESSAI_MS));
    }
    for (const modele of modeles){
      const restant = BUDGET_TOTAL_MS - (Date.now() - debut);
      if (restant <= 0) {
        tracer("budget épuisé");
        return {
          rep: derniere,
          modeleUtilise,
          modeles,
          budgetEpuise: true
        };
      }
      modeleUtilise = modele;
      tracer(`appel ${modele} (passe ${passe + 1}/${PASSES})`);
      let rep;
      try {
        rep = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modele}:generateContent`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": cle
          },
          body: corpsGemini,
          signal: AbortSignal.timeout(Math.min(DELAI_GEMINI_MS, restant))
        });
      } catch (err) {
        /* Sans ce `catch`, un `fetch` qui lève fait rejeter le handler
           `Deno.serve` : le runtime répond alors 500 **sans les en-têtes CORS**,
           et le navigateur annonce une erreur CORS au lieu du délai dépassé. */ const cause = err?.name === "TimeoutError" || err?.name === "AbortError" ? `pas de réponse en ${Math.round(Math.min(DELAI_GEMINI_MS, restant) / 1000)} s` : String(err?.message ?? err);
        tracer(`${modele} injoignable : ${cause}`);
        console.error(`Gemini injoignable (${modele}) : ${cause}`);
        continue;
      }
      derniere = rep;
      if (rep.ok) {
        tracer(`${modele} a répondu`);
        return {
          rep,
          modeleUtilise,
          modeles,
          budgetEpuise: false
        };
      }
      if (rep.status === 503 || rep.status === 429) {
        tracer(`${modele} saturé (${rep.status}), modèle suivant`);
        console.error(`Gemini ${rep.status} (${modele}), bascule sur le modèle suivant`);
        continue;
      }
      if (rep.status === 404) {
        tracer(`${modele} inconnu (404), modèle suivant`);
        console.error(`Modèle ${modele} inconnu (404), essai du suivant`);
        continue;
      }
      // 400, 403… : changer de modèle n'y changerait rien.
      return {
        rep,
        modeleUtilise,
        modeles,
        budgetEpuise: false
      };
    }
  }
  return {
    rep: derniere,
    modeleUtilise,
    modeles,
    budgetEpuise: false
  };
}
Deno.serve(async (req)=>{
  const debut = Date.now();
  /* La fonction n'avait que des `console.error` : en marche normale elle était
     muette, et on ne pouvait pas dire où partait le temps. */ const tracer = (etape)=>console.log(`[${Date.now() - debut} ms] ${etape}`);
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
  tracer(`document reçu (${Math.round(fichierBase64.length / 1000)} k caractères, ${mimeType})`);
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
  const { rep, modeleUtilise, modeles, budgetEpuise } = await appelerGemini(cle, geminiBody, tracer, debut);
  const attendu = Math.round((Date.now() - debut) / 1000);
  /* Les deux cas qui, jusqu'ici, ne produisaient aucune réponse du tout. */ if (budgetEpuise || !rep) {
    const pourquoi = budgetEpuise ? `budget de ${Math.round(BUDGET_TOTAL_MS / 1000)} s épuisé` : "aucun modèle joignable";
    console.error(`Extraction abandonnée après ${attendu} s — ${pourquoi} (essayés : ${modeles.join(", ")})`);
    return reponse(504, {
      erreur: `Gemini n'a pas répondu en ${attendu} s. Modèles essayés : ${modeles.join(", ")}. Réessayez dans quelques instants.`
    });
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
        erreur: `Les ${modeles.length} modèles Gemini sont saturés (essayé pendant ${attendu} s). Réessayez dans quelques instants.`
      });
    }
    return reponse(502, {
      erreur: `Erreur Gemini (${rep.status})`
    });
  }
  tracer("lecture du résultat");
  const json = await rep.json();
  const texte = json.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!texte) {
    console.error("Réponse Gemini sans contenu :", JSON.stringify(json).slice(0, 500));
    return reponse(502, {
      erreur: "Réponse Gemini vide ou bloquée"
    });
  }
  try {
    const extraction = JSON.parse(texte);
    tracer(`terminé (${extraction?.lignes?.length ?? 0} lignes, modèle ${modeleUtilise})`);
    return reponse(200, {
      extraction
    });
  } catch  {
    console.error("JSON Gemini invalide :", texte.slice(0, 500));
    return reponse(502, {
      erreur: "Extraction illisible, réessayer"
    });
  }
});
