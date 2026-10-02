/**
 * La mécanique d'une lecture de document par Mistral, sans le document.
 *
 * Ce qu'un bon de commande et un devis ont en commun, c'est tout sauf le sens :
 * la lecture se fait en deux temps — `mistral-ocr-latest` transcrit en Markdown,
 * tableaux compris, puis un modèle de chat structure ce Markdown sous
 * `json_schema` strict. Le pipeline précédent envoyait le PDF à un modèle de
 * vision d'un seul tenant ; il a été remplacé le 2026-09-15 après mesure
 * (`_diagnostic`) : la lecture en deux temps remplissait 16 champs sur 16 en
 * moins de 4 s là où la précédente ne répondait plus du tout.
 *
 * Ce qui change d'un document à l'autre tient dans un `ContratLecture` : le
 * prompt, le schéma, le contrôle de forme, et le budget de temps. Le reste —
 * le budget, la reprise, la cartographie des erreurs, les en-têtes CORS — est
 * du savoir durement acquis qu'on ne veut pas voir diverger en deux copies.
 *
 * La clé API vit dans les secrets Supabase (`MISTRAL_API_KEY`), lue avec
 * `Deno.env` et passée en en-tête `Authorization` — jamais dans l'URL, pour
 * qu'elle n'apparaisse pas dans les logs. Chaque fonction qui s'appuie sur ce
 * module doit être déclarée `verify_jwt = true` dans `supabase/config.toml` :
 * c'est là, et NULLE PART dans le code, que ça se décide. `extraire-bc` a
 * tourné ouverte des mois durant avec un en-tête qui affirmait le contraire —
 * n'importe qui connaissant l'URL consommait le quota du projet.
 *
 * Entrée  : { fichierBase64, mimeType }
 * Sortie  : { extraction: <ce que le contrat décrit> }
 */

export const CORS = {
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

/** Une seule reprise, et seulement sur un refus passager (429, 5xx). */
const PAUSE_REESSAI_MS = 2_000;

const MODELE_OCR = "mistral-ocr-latest";

/** En deçà, il n'y a pas de quoi remplir un formulaire : c'est un scan raté. */
const MINIMUM_LISIBLE = 20;

/* --- Le budget de temps ---------------------------------------------------
 *
 * La plateforme tue l'isolat à 150 s de temps mural. Le 14/09/2026, un appel
 * resté sans réponse a consommé ce budget en entier : la fonction est morte
 * sans émettre la moindre réponse HTTP (`reason: WallClockTime`,
 * `cpu_time_used: 26 ms`), et le navigateur, dont la promesse ne s'est jamais
 * résolue, affichait encore « Lecture en cours » indéfiniment.
 *
 * La leçon survit au changement de fournisseur : on rend toujours la main, et
 * assez tôt pour dire pourquoi. Le budget se partage entre deux appels — d'où
 * deux délais distincts, dont la somme tient dans le total avec de la marge.
 *
 * Les valeurs ci-dessous sont celles du bon de commande, une à deux pages. Un
 * document plus long les relève par son contrat. */
export interface Budget {
  /** Au-delà, on tient pour acquis que l'OCR ne répondra pas. */
  delaiOcrMs: number;
  /** Structurer quelques pages de Markdown est court : ce délai est déjà large. */
  delaiExtractionMs: number;
  /** Ce qu'on s'autorise en tout, marge comprise sur la limite de la plateforme. */
  budgetTotalMs: number;
  /**
   * Au-delà de tant de caractères de Markdown, on refuse plutôt que d'essayer.
   *
   * Sans ce garde, un document de quarante pages rend un délai dépassé au bout
   * d'une minute — l'utilisateur attend pour rien, puis ne sait pas quoi faire.
   * Une phrase tout de suite vaut mieux.
   */
  markdownMax: number;
}

const BUDGET_DEFAUT: Budget = {
  delaiOcrMs: 50_000,
  delaiExtractionMs: 45_000,
  budgetTotalMs: 110_000,
  markdownMax: 120_000,
};

/** Des règles propres à l'émetteur d'un document, reconnues dans son texte. */
export interface Consignes {
  /** Pour les traces : « émetteur reconnu : SEM4V ». */
  nom: string;
  texte: string;
}

/** Ce qui distingue une lecture d'une autre. */
export interface ContratLecture {
  /** Nom du `json_schema` côté Mistral, et clé des traces. */
  nom: string;
  /** Comment le Markdown est présenté au modèle : « Voici le devis en Markdown ». */
  intitule: string;
  /** Le document, en toutes lettres, pour les messages d'erreur : « ce devis ». */
  leDocument: string;
  promptSysteme: string;
  schemaJson: Record<string, unknown>;
  /** Ce que le schéma strict laisse encore passer, et qu'il faut signaler. */
  ecartsDeForme: (o: unknown) => string[];
  budget?: Partial<Budget>;
  /**
   * Chaque bailleur range ses informations à sa façon. Un prompt unique ne peut
   * pas dire « chez SEM4V, l'interlocuteur est l'agent de l'EDL » sans le dire à
   * tous les autres : ces règles ne s'ajoutent donc qu'au document qui les
   * concerne.
   */
  consignesDuDocument?: (markdown: string) => Consignes | null;
  /** Ce qui se décide sur le texte sans demander l'avis du modèle. */
  apresLecture?: (lu: Record<string, unknown>, markdown: string) => void;
}

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

/**
 * Les pages mises bout à bout, chacune annoncée par son numéro.
 *
 * Un simple `---` entre deux pages ne permettait pas au modèle de savoir où il
 * en était. Or les consignes parlent de pages : chez SEM4V l'agent de l'EDL est
 * en bas de page, et au Département les prestations occupent les pages 2 à 6.
 */
export function markdownDesPages(pages: string[]): string {
  return pages
    .map((md, i) => `--- Page ${i + 1}/${pages.length} ---\n\n${md}`)
    .join("\n\n")
    .trim();
}

/**
 * Ce que l'OCR a rendu d'une page, en nombres seulement.
 *
 * Le 30/09, trois bons sont arrivés à moitié vides, et les traces ne donnaient
 * qu'un total de caractères. Il a fallu recouper les heures de déploiement pour
 * comprendre que leurs tableaux s'étaient perdus à l'OCR, et non chez le modèle.
 * Avec ces comptes, la trace le dit d'elle-même : une page sans rangée, avec un
 * `[tbl-0.html]` ou un `![img-0]`, a perdu son contenu avant la structuration.
 * Aucun contenu n'est tracé : un bon porte le nom et le téléphone d'un
 * locataire.
 */
export function mesurerPage(markdown: string) {
  return {
    caracteres: texteUtile(markdown).length,
    // Les rangées de séparation `| --- |` ne sont pas des données.
    rangees: (markdown.match(/^\s*\|(?!\s*:?-{3,})/gm) ?? []).length,
    images: (markdown.match(/!\[[^\]]*\]\([^)]*\)/g) ?? []).length,
    tableauxExternes: (markdown.match(/(?<!!)\[tbl-[^\]]*\]\([^)]*\)/g) ?? []).length,
  };
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
  budgetTotalMs: number,
): Promise<Tentative> {
  let derniere: Response | null = null;

  for (let essai = 0; essai < 2; essai++) {
    const restant = budgetTotalMs - (Date.now() - debut);
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

/** Le handler complet d'une lecture, prêt pour `Deno.serve`. */
export function servirLecture(contrat: ContratLecture) {
  const budget: Budget = { ...BUDGET_DEFAUT, ...contrat.budget };

  return async (req: Request): Promise<Response> => {
    const debut = Date.now();
    /* Sans trace, la fonction est muette en marche normale et on ne peut pas
       dire où part le temps. */
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

    // ---- 1. Le document devient du Markdown ---------------------------------

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
        /* PAS de `table_format`, et c'est tout l'enjeu sur un document chiffré.
           Avec « html » comme avec « markdown », Mistral EXTERNALISE les
           tableaux : le Markdown rendu ne porte qu'une référence,
           `[tbl-0.html](tbl-0.html)`, vers un fichier qu'on ne reçoit jamais.
           Les lignes, les quantités, les prix unitaires et les taux de TVA
           partent avec — et le modèle d'extraction, qui ne voit que la
           référence, conclut honnêtement que le document n'est pas chiffré.
           Mesuré le 29/09/2026 sur un devis de deux pages : 878 caractères et
           zéro ligne avec « html », 2 618 caractères et le tableau entier sans
           l'option. */
        // Ni images encodées ni boîtes englobantes : on ne paie que le texte.
        include_image_base64: false,
      }),
      budget.delaiOcrMs,
      "l'OCR",
      tracer,
      debut,
      budget.budgetTotalMs,
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
    const pages: string[] = (resultatOcr.pages ?? []).map(
      (p: { markdown?: string }) => p.markdown ?? "",
    );
    const markdown = markdownDesPages(pages);

    /* Un document illisible rend des pages vides. Envoyer ce vide au modèle de
       structuration ne coûterait pas moins cher et rendrait un formulaire
       entièrement nul, sans dire pourquoi : autant le nommer ici.

       Mais « vide » ne veut pas dire « chaîne vide ». Sur une photo floue, l'OCR
       rend `[tbl-0.html](tbl-0.html)` — une référence à un tableau qu'il n'a pas
       su transcrire. Vingt-quatre caractères, aucun texte : le premier garde-fou
       écrit ici la laissait passer, et l'utilisateur récupérait un formulaire
       entièrement vide sans un mot d'explication.

       Le compte se fait sur les pages seules : les marqueurs « --- Page 1/2 --- »
       ajoutés par `markdownDesPages` suffiraient à franchir le seuil. */
    if (texteUtile(pages.join("\n\n")).length < MINIMUM_LISIBLE) {
      console.error(`OCR sans texte exploitable (${pages.length} page(s)) : ${markdown.slice(0, 200)}`);
      return reponse(502, {
        erreur: "Aucun texte n'a pu être lu sur ce document. Vérifiez la netteté du scan.",
      });
    }

    /* Trop long pour être structuré dans le temps qui reste. Le dire vaut mieux
       qu'un délai dépassé d'une minute, qui ne se distingue pas d'une panne. */
    if (markdown.length > budget.markdownMax) {
      console.error(`Markdown trop long : ${markdown.length} caractères, ${pages.length} page(s)`);
      return reponse(413, {
        erreur:
          `Ce document fait ${pages.length} pages : c'est trop long pour une lecture ` +
          `automatique. Découpez-le, ou saisissez ${contrat.leDocument} à la main.`,
      });
    }
    tracer(`OCR terminé (${pages.length} page(s), ${markdown.length} caractères)`);
    pages.forEach((md, i) => {
      const m = mesurerPage(md);
      tracer(
        `page ${i + 1}/${pages.length} : ${m.caracteres} car., ${m.rangees} rangées, ` +
          `${m.images} image(s), ${m.tableauxExternes} tableau(x) externalisé(s)`,
      );
    });

    // ---- 2. Le Markdown devient le contrat ----------------------------------

    const consignes = contrat.consignesDuDocument?.(markdown) ?? null;
    if (consignes) tracer(`émetteur reconnu : ${consignes.nom}`);
    const promptSysteme = consignes
      ? `${contrat.promptSysteme}\n${consignes.texte}`
      : contrat.promptSysteme;

    const modele = modeleExtraction();
    const extraction = await appeler(
      "https://api.mistral.ai/v1/chat/completions",
      cle,
      JSON.stringify({
        model: modele,
        temperature: 0,
        messages: [
          { role: "system", content: promptSysteme },
          { role: "user", content: `${contrat.intitule}\n\n${markdown}` },
        ],
        response_format: {
          type: "json_schema",
          json_schema: { name: contrat.nom, strict: true, schema: contrat.schemaJson },
        },
      }),
      budget.delaiExtractionMs,
      `${modele}`,
      tracer,
      debut,
      budget.budgetTotalMs,
    );

    const attendu = Math.round((Date.now() - debut) / 1000);

    if (!extraction.rep) {
      console.error(`Extraction abandonnée après ${attendu} s — ${extraction.echec}`);
      return reponse(504, {
        erreur:
          `Le document a été lu, mais ${modele} n'a pas répondu en ${attendu} s. ` +
          `Réessayez dans quelques instants.`,
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

    let lu: Record<string, unknown>;
    try {
      lu = JSON.parse(texte);
    } catch {
      console.error("JSON invalide :", texte.slice(0, 500));
      return reponse(502, { erreur: "Extraction illisible, réessayer" });
    }

    /* Le schéma strict fait l'essentiel, mais il n'est pas une garantie : ce qui
       passe malgré lui doit être signalé à l'utilisateur plutôt que d'atterrir
       tel quel dans le formulaire. */
    const ecarts = contrat.ecartsDeForme(lu);
    if (ecarts.length) {
      console.error(`Écarts au contrat ${contrat.nom} (${modele}) : ${ecarts.join(" ; ")}`);
      const avertissements = Array.isArray(lu.avertissements) ? lu.avertissements : [];
      lu.avertissements = [...avertissements, "Lecture partiellement incertaine, relisez les champs."];
    }

    contrat.apresLecture?.(lu, markdown);

    tracer(
      `terminé en ${attendu} s (${(lu.lignes as unknown[])?.length ?? 0} lignes, ` +
        `${pages.length} page(s), modèle ${modele})`,
    );
    return reponse(200, { extraction: lu });
  };
}
