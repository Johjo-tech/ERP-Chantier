/**
 * Les trois extractions qu'on met face à face.
 *
 * Gemini est appelé **tel quel** — même endpoint, même cascade de modèles, même
 * `response_schema` que la fonction déployée — pour que la comparaison porte
 * sur les pipelines et non sur des réglages qui auraient dérivé en chemin.
 *
 * Mistral procède en deux temps : l'OCR rend du Markdown, puis un modèle de
 * chat le structure. Les deux modèles éprouvés partagent le même appel OCR :
 * il n'est fait qu'une fois par document, et son coût compte une seule fois.
 */

import { PROMPT_SYSTEME, SCHEMA_GEMINI, SCHEMA_JSON } from "./contrat.ts";

/** Ce qu'une tentative coûte et rapporte, quel que soit le fournisseur. */
export interface Mesure {
  ms: number;
  tokensEntree: number;
  tokensSortie: number;
  pages?: number;
  tentatives: number;
  modele: string;
}

export interface Resultat {
  bon: Record<string, unknown> | null;
  mesures: Mesure[];
  erreur: string | null;
}

const PAUSES_MS = [1_000, 3_000];

/**
 * Un appel, réessayé sur 429 et 5xx.
 *
 * Deux reprises, pas plus : au-delà, ce n'est plus un incident passager mais un
 * quota épuisé, et insister ne fait que retarder le constat.
 */
async function appeler(
  url: string,
  init: RequestInit,
  quoi: string,
): Promise<{ reponse: Response; tentatives: number }> {
  let derniere: Response | null = null;

  for (let essai = 0; essai <= PAUSES_MS.length; essai++) {
    if (essai > 0) {
      const pause = PAUSES_MS[essai - 1];
      console.error(`  ↻ ${quoi} : ${derniere?.status}, nouvelle tentative dans ${pause / 1000} s`);
      await new Promise((r) => setTimeout(r, pause));
    }
    derniere = await fetch(url, init);
    if (derniere.status !== 429 && derniere.status < 500) {
      return { reponse: derniere, tentatives: essai + 1 };
    }
  }
  return { reponse: derniere!, tentatives: PAUSES_MS.length + 1 };
}

function lireJson(texte: string): Record<string, unknown> | null {
  try {
    return JSON.parse(texte);
  } catch {
    // Certains modèles encadrent le JSON d'une clôture Markdown.
    const m = texte.match(/\{[\s\S]*\}/);
    if (!m) return null;
    try { return JSON.parse(m[0]); } catch { return null; }
  }
}

// ---------------------------------------------------------------- Gemini ----

const MODELES_GEMINI = ["gemini-3.7-flash", "gemini-3.8-flash", "gemini-3.6-flash"];

export async function parGemini(pdfBase64: string, cle: string): Promise<Resultat> {
  const corps = JSON.stringify({
    contents: [{
      parts: [
        { inline_data: { mime_type: "application/pdf", data: pdfBase64 } },
        { text: PROMPT_SYSTEME },
      ],
    }],
    generationConfig: {
      temperature: 0,
      response_mime_type: "application/json",
      response_schema: SCHEMA_GEMINI,
    },
  });

  const mesures: Mesure[] = [];
  for (const modele of MODELES_GEMINI) {
    const t0 = Date.now();
    const { reponse, tentatives } = await appeler(
      `https://generativelanguage.googleapis.com/v1beta/models/${modele}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": cle },
        body: corps,
        signal: AbortSignal.timeout(120_000),
      },
      `Gemini ${modele}`,
    );

    if (!reponse.ok) {
      mesures.push({ ms: Date.now() - t0, tokensEntree: 0, tokensSortie: 0, tentatives, modele });
      if (reponse.status === 404 || reponse.status === 503 || reponse.status === 429) continue;
      return { bon: null, mesures, erreur: `Gemini ${reponse.status} : ${(await reponse.text()).slice(0, 200)}` };
    }

    const json = await reponse.json();
    const u = json.usageMetadata ?? {};
    mesures.push({
      ms: Date.now() - t0,
      tokensEntree: u.promptTokenCount ?? 0,
      tokensSortie: u.candidatesTokenCount ?? 0,
      tentatives,
      modele,
    });

    const texte = json.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!texte) return { bon: null, mesures, erreur: "Gemini : réponse sans contenu" };
    const bon = lireJson(texte);
    return { bon, mesures, erreur: bon ? null : "Gemini : JSON illisible" };
  }
  return { bon: null, mesures, erreur: "Gemini : aucun modèle n'a répondu" };
}

// --------------------------------------------------------------- Mistral ----

export interface Ocr {
  markdown: string;
  mesure: Mesure;
  erreur: string | null;
}

/** L'OCR : le PDF devient du Markdown, pages séparées par un trait. */
export async function ocrMistral(pdfBase64: string, cle: string): Promise<Ocr> {
  const t0 = Date.now();
  const { reponse, tentatives } = await appeler(
    "https://api.mistral.ai/v1/ocr",
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${cle}` },
      body: JSON.stringify({
        model: "mistral-ocr-latest",
        document: { type: "document_url", document_url: `data:application/pdf;base64,${pdfBase64}` },
        table_format: "html",
        // Ni images encodées ni boîtes englobantes : on ne paie que le texte.
        include_image_base64: false,
      }),
      signal: AbortSignal.timeout(120_000),
    },
    "Mistral OCR",
  );

  const mesure: Mesure = { ms: Date.now() - t0, tokensEntree: 0, tokensSortie: 0, tentatives, modele: "mistral-ocr-latest" };
  if (!reponse.ok) {
    return { markdown: "", mesure, erreur: `OCR ${reponse.status} : ${(await reponse.text()).slice(0, 200)}` };
  }

  const json = await reponse.json();
  const pages: { markdown?: string }[] = json.pages ?? [];
  mesure.pages = pages.length;
  mesure.tokensEntree = json.usage_info?.pages_processed ?? pages.length;
  return { markdown: pages.map((p) => p.markdown ?? "").join("\n\n---\n\n"), mesure, erreur: null };
}

/** L'extraction : le Markdown devient le contrat, sous schéma strict. */
export async function extraireMistral(
  markdown: string,
  modele: string,
  cle: string,
): Promise<Resultat> {
  const t0 = Date.now();
  const { reponse, tentatives } = await appeler(
    "https://api.mistral.ai/v1/chat/completions",
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${cle}` },
      body: JSON.stringify({
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
      signal: AbortSignal.timeout(120_000),
    },
    `Mistral ${modele}`,
  );

  const mesure: Mesure = { ms: Date.now() - t0, tokensEntree: 0, tokensSortie: 0, tentatives, modele };
  if (!reponse.ok) {
    return { bon: null, mesures: [mesure], erreur: `${modele} ${reponse.status} : ${(await reponse.text()).slice(0, 200)}` };
  }

  const json = await reponse.json();
  mesure.tokensEntree = json.usage?.prompt_tokens ?? 0;
  mesure.tokensSortie = json.usage?.completion_tokens ?? 0;

  const texte = json.choices?.[0]?.message?.content;
  if (!texte) return { bon: null, mesures: [mesure], erreur: `${modele} : réponse sans contenu` };
  const bon = lireJson(texte);
  return { bon, mesures: [mesure], erreur: bon ? null : `${modele} : JSON illisible` };
}
