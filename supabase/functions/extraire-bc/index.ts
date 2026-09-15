/**
 * Extraction structurée d'un bon de commande (PDF ou image) via Mistral.
 *
 * La lecture se fait en deux temps, et c'est délibéré :
 *
 *   1. `mistral-ocr-latest` transcrit le document en Markdown — tableaux
 *      compris, ce qui est tout l'enjeu sur un bon de travaux.
 *   2. `mistral-medium-latest` structure ce Markdown sous `json_schema` strict.
 *
 * Le pipeline précédent envoyait le PDF à un modèle de vision d'un seul tenant.
 * Il a été remplacé le 2026-09-15 après mesure (`_diagnostic`) : la lecture en
 * deux temps remplissait 16 champs sur 16 en moins de 4 s là où la précédente
 * ne répondait plus du tout.
 *
 * La clé API vit dans les secrets Supabase (`MISTRAL_API_KEY`), lue avec
 * Deno.env et passée en en-tête `Authorization` — jamais dans l'URL, pour
 * qu'elle n'apparaisse pas dans les logs. La fonction est déployée avec
 * verify_jwt : seul un utilisateur connecté de l'application peut l'appeler.
 *
 * Entrée  : { fichierBase64, mimeType }
 * Sortie  : { extraction: BonCommande } — champs alignés sur BonCommandeSaisi
 *           côté front, plus une liste d'avertissements de lecture.
 */

import { ecartsDeForme, PROMPT_SYSTEME, SCHEMA_JSON } from "../_shared/contrat-bc.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MIMES_ACCEPTES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

/** ~14 Mo une fois décodé : au-delà, demander un PDF allégé. */
const BASE64_MAX = 20_000_000;

/* --- Le budget de temps ---------------------------------------------------
 *
 * La plateforme tue l'isolat à 150 s de temps mural. Le 14/09/2026, un appel
 * resté sans réponse a consommé ce budget en entier : la fonction est morte
 * sans émettre la moindre réponse HTTP (`reason: WallClockTime`,
 * `cpu_time_used: 26 ms`), et le navigateur, dont la promesse ne s'est jamais
 * résolue, affichait encore « Lecture en cours » indéfiniment.
 *
 * La leçon survit au changement de fournisseur : on rend toujours la main, et
 * assez tôt pour dire pourquoi. Le budget se partage maintenant entre deux
 * appels au lieu d'un — d'où deux délais distincts, dont la somme tient dans
 * le total avec de la marge pour le reste. */

/** Au-delà, on tient pour acquis que l'OCR ne répondra pas. */
const DELAI_OCR_MS = 50_000;
/** Structurer quelques pages de Markdown est court : ce délai est déjà large. */
const DELAI_EXTRACTION_MS = 45_000;
/** Ce qu'on s'autorise en tout : 40 s de marge sur la limite de la plateforme. */
const BUDGET_TOTAL_MS = 110_000;
/** Une seule reprise, et seulement sur un refus passager (429, 5xx). */
const PAUSE_REESSAI_MS = 2_000;

const MODELE_OCR = "mistral-ocr-latest";

/** En deçà, il n'y a pas de quoi remplir un bon : c'est un scan raté. */
const MINIMUM_LISIBLE = 20;

/**
 * Ce qui reste du Markdown une fois ôté ce qui n'est pas du texte.
 *
 * Ne sert qu'à décider si la page dit quelque chose — le modèle, lui, reçoit le
 * Markdown intact. Les références de figures et de tableaux que l'OCR n'a pas
 * su transcrire, les traits de séparation entre pages et les espaces ne
 * comptent pas comme du texte lu.
 */
function texteUtile(markdown: string): string {
  return markdown
    .replace(/!?\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/^[-_*\s]*$/gm, "")
    .trim();
}

/** `MISTRAL_MODEL` est un levier d'urgence : il ne sert qu'à forcer un autre
 *  modèle d'extraction le temps d'un incident, sans redéployer. */
function modeleExtraction() {
  return Deno.env.get("MISTRAL_MODEL") || "mistral-medium-latest";
}

function reponse(statut: number, corps: unknown) {
  return new Response(JSON.stringify(corps), {
    status: statut,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

/** Ce qu'un appel rend, qu'il ait abouti ou non : jamais une exception. */
interface Tentative {
  rep: Response | null;
  /** Renseigné quand aucune réponse n'a pu être obtenue. */
  echec: string | null;
}

/**
 * Un appel à Mistral, réessayé une fois sur un refus passager.
 *
 * Sans le `catch`, un `fetch` qui lève fait rejeter le handler `Deno.serve` :
 * le runtime répond alors 500 **sans les en-têtes CORS**, et le navigateur
 * annonce une erreur CORS au lieu du délai dépassé.
 */
async function appeler(
  url: string,
  cle: string,
  corps: string,
  delaiMs: number,
  quoi: string,
  tracer: (etape: string) => void,
  debut: number,
): Promise<Tentative> {
  let derniere: Response | null = null;

  for (let essai = 0; essai < 2; essai++) {
    const restant = BUDGET_TOTAL_MS - (Date.now() - debut);
    if (restant <= 0) {
      tracer(`${quoi} : budget épuisé`);
      return { rep: derniere, echec: derniere ? null : "budget épuisé" };
    }

    if (essai > 0) {
      // Ne pas dormir sur un budget déjà vide : ces deux secondes ne
      // serviraient qu'à retarder la réponse d'échec.
      if (restant <= PAUSE_REESSAI_MS) {
        tracer(`${quoi} : budget épuisé, pas de reprise`);
        return { rep: derniere, echec: null };
      }
      tracer(`${quoi} : refus passager, une pause puis reprise`);
      await new Promise((r) => setTimeout(r, PAUSE_REESSAI_MS));
    }

    tracer(`${quoi} : appel (tentative ${essai + 1}/2)`);
    try {
      derniere = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${cle}` },
        body: corps,
        signal: AbortSignal.timeout(Math.min(delaiMs, restant)),
      });
    } catch (err) {
      const cause =
        (err as Error)?.name === "TimeoutError" || (err as Error)?.name === "AbortError"
          ? `pas de réponse en ${Math.round(Math.min(delaiMs, restant) / 1000)} s`
          : String((err as Error)?.message ?? err);
      tracer(`${quoi} injoignable : ${cause}`);
      console.error(`Mistral injoignable (${quoi}) : ${cause}`);
      return { rep: null, echec: cause };
    }

    if (derniere.status !== 429 && derniere.status < 500) return { rep: derniere, echec: null };
    tracer(`${quoi} : ${derniere.status}`);
    console.error(`Mistral ${derniere.status} sur ${quoi}`);
  }

  return { rep: derniere, echec: null };
}

/** Le message que l'écran affichera, à partir du statut rendu par Mistral. */
function motif(statut: number, quoi: string): { code: number; erreur: string } {
  if (statut === 401 || statut === 403) {
    return {
      code: 502,
      erreur: "Clé Mistral refusée : vérifier MISTRAL_API_KEY dans les secrets Supabase.",
    };
  }
  if (statut === 429) {
    return {
      code: 503,
      erreur: "Mistral est saturé ou le quota est atteint. Réessayez dans quelques instants.",
    };
  }
  if (statut === 413 || statut === 422) {
    return { code: 502, erreur: `Document refusé par ${quoi} : format ou taille non supportés.` };
  }
  return { code: 502, erreur: `Erreur ${quoi} (${statut})` };
}

Deno.serve(async (req) => {
  const debut = Date.now();
  /* La fonction n'avait que des `console.error` : en marche normale elle était
     muette, et on ne pouvait pas dire où partait le temps. */
  const tracer = (etape: string) => console.log(`[${Date.now() - debut} ms] ${etape}`);

  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return reponse(405, { erreur: "Méthode non autorisée" });

  const cle = Deno.env.get("MISTRAL_API_KEY");
  if (!cle) return reponse(500, { erreur: "MISTRAL_API_KEY absente des secrets Supabase" });

  let corps: { fichierBase64?: string; mimeType?: string };
  try {
    corps = await req.json();
  } catch {
    return reponse(400, { erreur: "Corps JSON invalide" });
  }

  const { fichierBase64, mimeType } = corps;
  if (!fichierBase64 || !mimeType) {
    return reponse(400, { erreur: "fichierBase64 et mimeType sont requis" });
  }
  if (!MIMES_ACCEPTES.has(mimeType)) {
    return reponse(400, { erreur: `Type de fichier non pris en charge : ${mimeType}` });
  }
  if (fichierBase64.length > BASE64_MAX) {
    return reponse(413, { erreur: "Fichier trop volumineux (limite ~14 Mo)" });
  }

  tracer(`document reçu (${Math.round(fichierBase64.length / 1000)} k caractères, ${mimeType})`);

  // ---- 1. Le document devient du Markdown -----------------------------------

  /* L'API distingue les deux : un PDF est paginé, une image ne l'est pas. */
  const document = mimeType === "application/pdf"
    ? { type: "document_url", document_url: `data:${mimeType};base64,${fichierBase64}` }
    : { type: "image_url", image_url: `data:${mimeType};base64,${fichierBase64}` };

  const ocr = await appeler(
    "https://api.mistral.ai/v1/ocr",
    cle,
    JSON.stringify({
      model: MODELE_OCR,
      document,
      table_format: "html",
      // Ni images encodées ni boîtes englobantes : on ne paie que le texte.
      include_image_base64: false,
    }),
    DELAI_OCR_MS,
    "l'OCR",
    tracer,
    debut,
  );

  if (!ocr.rep) {
    const attendu = Math.round((Date.now() - debut) / 1000);
    console.error(`OCR abandonné après ${attendu} s — ${ocr.echec}`);
    return reponse(504, {
      erreur: `L'OCR n'a pas répondu en ${attendu} s. Réessayez dans quelques instants.`,
    });
  }
  if (!ocr.rep.ok) {
    const detail = await ocr.rep.text();
    console.error(`OCR ${ocr.rep.status} : ${detail.slice(0, 500)}`);
    const m = motif(ocr.rep.status, "l'OCR");
    return reponse(m.code, { erreur: m.erreur });
  }

  const resultatOcr = await ocr.rep.json();
  const pages: { markdown?: string }[] = resultatOcr.pages ?? [];
  const markdown = pages.map((p) => p.markdown ?? "").join("\n\n---\n\n").trim();

  /* Un document illisible rend des pages vides. Envoyer ce vide au modèle de
     structuration ne coûterait pas moins cher et rendrait un bon entièrement
     nul, sans dire pourquoi : autant le nommer ici.

     Mais « vide » ne veut pas dire « chaîne vide ». Sur une photo floue, l'OCR
     rend `[tbl-0.html](tbl-0.html)` — une référence à un tableau qu'il n'a pas
     su transcrire. Vingt-quatre caractères, aucun texte : le premier garde-fou
     écrit ici la laissait passer, et l'utilisateur récupérait un formulaire
     entièrement vide sans un mot d'explication. */
  if (texteUtile(markdown).length < MINIMUM_LISIBLE) {
    console.error(`OCR sans texte exploitable (${pages.length} page(s)) : ${markdown.slice(0, 200)}`);
    return reponse(502, {
      erreur: "Aucun texte n'a pu être lu sur ce document. Vérifiez la netteté du scan.",
    });
  }
  tracer(`OCR terminé (${pages.length} page(s), ${markdown.length} caractères)`);

  // ---- 2. Le Markdown devient le contrat ------------------------------------

  const modele = modeleExtraction();
  const extraction = await appeler(
    "https://api.mistral.ai/v1/chat/completions",
    cle,
    JSON.stringify({
      model: modele,
      temperature: 0,
      messages: [
        { role: "system", content: PROMPT_SYSTEME },
        { role: "user", content: `Voici le bon en Markdown :\n\n${markdown}` },
      ],
      response_format: {
        type: "json_schema",
        json_schema: { name: "bon_commande", strict: true, schema: SCHEMA_JSON },
      },
    }),
    DELAI_EXTRACTION_MS,
    `${modele}`,
    tracer,
    debut,
  );

  const attendu = Math.round((Date.now() - debut) / 1000);

  if (!extraction.rep) {
    console.error(`Extraction abandonnée après ${attendu} s — ${extraction.echec}`);
    return reponse(504, {
      erreur: `Le document a été lu, mais ${modele} n'a pas répondu en ${attendu} s. Réessayez dans quelques instants.`,
    });
  }
  if (!extraction.rep.ok) {
    const detail = await extraction.rep.text();
    console.error(`${modele} ${extraction.rep.status} : ${detail.slice(0, 500)}`);
    const m = motif(extraction.rep.status, modele);
    return reponse(m.code, { erreur: m.erreur });
  }

  const json = await extraction.rep.json();
  const texte = json.choices?.[0]?.message?.content;
  if (!texte) {
    console.error("Réponse sans contenu :", JSON.stringify(json).slice(0, 500));
    return reponse(502, { erreur: "Réponse du modèle vide ou bloquée" });
  }

  let bon: Record<string, unknown>;
  try {
    bon = JSON.parse(texte);
  } catch {
    console.error("JSON invalide :", texte.slice(0, 500));
    return reponse(502, { erreur: "Extraction illisible, réessayer" });
  }

  /* Le schéma strict fait l'essentiel, mais il n'est pas une garantie : ce qui
     passe malgré lui doit être signalé à l'utilisateur plutôt que d'atterrir
     tel quel dans le formulaire. */
  const ecarts = ecartsDeForme(bon);
  if (ecarts.length) {
    console.error(`Écarts au contrat (${modele}) : ${ecarts.join(" ; ")}`);
    const avertissements = Array.isArray(bon.avertissements) ? bon.avertissements : [];
    bon.avertissements = [...avertissements, "Lecture partiellement incertaine, relisez les champs."];
  }

  tracer(
    `terminé en ${attendu} s (${(bon.lignes as unknown[])?.length ?? 0} lignes, ${pages.length} page(s), modèle ${modele})`,
  );
  return reponse(200, { extraction: bon });
});
