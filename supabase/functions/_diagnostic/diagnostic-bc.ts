/**
 * Éprouver la lecture d'un BON DE COMMANDE, et mesurer ce que `table_format`
 * fait perdre.
 *
 * Chaque document est lu DEUX FOIS : une fois avec le réglage qui tourne en
 * production (`table_format: "html"`), une fois sans. Le second est celui qu'on
 * veut déployer ; le premier sert de témoin. Sur un bon dont les prestations
 * sont dans un tableau, l'écart se voit au nombre de lignes extraites.
 *
 *   docker run --rm -v "$PWD:/w" -v "$HOME/.claude/uploads/<session>:/pdf:ro" -w /w \
 *     --env-file supabase/functions/.env \
 *     denoland/deno:alpine-2.1.4 run --allow-net --allow-read --allow-env \
 *     supabase/functions/_diagnostic/diagnostic-bc.ts /pdf/xxx.pdf
 */

import { ecartsDeForme, PROMPT_SYSTEME, SCHEMA_JSON } from "../_shared/contrat-bc.ts";

const cle = Deno.env.get("MISTRAL_API_KEY");
if (!cle) {
  console.error("MISTRAL_API_KEY absente — la passer par --env-file.");
  Deno.exit(1);
}

async function ocr(base64: string, tableFormat: string | null) {
  const corps: Record<string, unknown> = {
    model: "mistral-ocr-latest",
    document: { type: "document_url", document_url: `data:application/pdf;base64,${base64}` },
    include_image_base64: false,
  };
  if (tableFormat) corps.table_format = tableFormat;

  const rep = await fetch("https://api.mistral.ai/v1/ocr", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${cle}` },
    body: JSON.stringify(corps),
    signal: AbortSignal.timeout(120_000),
  });
  if (!rep.ok) return { markdown: "", pages: 0, erreur: `OCR ${rep.status}` };
  const json = await rep.json();
  const pages: { markdown?: string }[] = json.pages ?? [];
  return {
    markdown: pages.map((p) => p.markdown ?? "").join("\n\n---\n\n"),
    pages: pages.length,
    erreur: null as string | null,
  };
}

async function extraire(markdown: string) {
  const rep = await fetch("https://api.mistral.ai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${cle}` },
    body: JSON.stringify({
      model: "mistral-medium-latest",
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
  });
  if (!rep.ok) return { bon: null as Record<string, unknown> | null, erreur: `${rep.status} : ${(await rep.text()).slice(0, 200)}` };
  const json = await rep.json();
  try {
    return { bon: JSON.parse(json.choices?.[0]?.message?.content ?? "{}"), erreur: null };
  } catch {
    return { bon: null, erreur: "JSON illisible" };
  }
}

for (const chemin of Deno.args) {
  console.log(`\n${"═".repeat(74)}\n  ${chemin.split("/").pop()}\n${"═".repeat(74)}`);

  const octets = await Deno.readFile(chemin);
  let b = "";
  for (const o of octets) b += String.fromCharCode(o);
  const base64 = btoa(b);

  const configs = Deno.env.get("COMPARER") === "1"
    ? ([["AVANT (production)", "html"], ["APRÈS (corrigé)", null]] as const)
    : ([["APRÈS (corrigé)", null]] as const);
  for (const [etiquette, format] of configs) {
    const lu = await ocr(base64, format);
    if (lu.erreur) { console.log(`\n  ${etiquette} : ${lu.erreur}`); continue; }
    const refs = (lu.markdown.match(/\[tbl-\d+\.\w+\]/g) || []).length;
    const { bon, erreur } = await extraire(lu.markdown);
    if (erreur || !bon) { console.log(`\n  ${etiquette} : extraction ${erreur}`); continue; }

    const lignes: Record<string, unknown>[] = Array.isArray(bon.lignes) ? bon.lignes : [];
    const chiffrees = lignes.filter((l) => l.type === "ligne");
    console.log(
      `\n  ${etiquette}\n` +
        `    OCR        ${lu.pages} page(s), ${lu.markdown.length} caractères` +
        (refs ? `, ${refs} TABLEAU(X) NON TRANSCRIT(S)` : "") + "\n" +
        `    n° du bon  ${bon.numeroBC ?? "— NON LU —"}\n` +
        `    client     ${bon.client ?? "— NON LU —"}\n` +
        `    chantier   ${[bon.adresse, bon.codePostal, bon.ville].filter(Boolean).join(", ") || "— NON LU —"}\n` +
        `    facturation ${[bon.facturationAdresse, bon.facturationCodePostal, bon.facturationVille].filter(Boolean).join(", ") || "—"}\n` +
        `    lignes     ${lignes.length} dont ${chiffrees.length} chiffrée(s)\n` +
        `    montant    ${bon.montantTotalHT ?? "—"}\n` +
        `    occupant   ${bon.occupant ?? "—"} (${bon.logementStatut ?? "statut non lu"})\n` +
        `    notes      ${String(bon.notes ?? "—").slice(0, 200)}`,
    );
    for (const l of chiffrees.slice(0, 4)) {
      console.log(`      · ${String(l.designation ?? "").slice(0, 52)}  ${l.qte ?? "?"} ${l.unite ?? ""} × ${l.prixUnitaire ?? "—"}`);
    }
    const av: string[] = Array.isArray(bon.avertissements) ? bon.avertissements : [];
    for (const a of av) console.log(`    ! ${a}`);
    const ec = ecartsDeForme(bon);
    for (const e of ec) console.log(`    ✗ ${e}`);
  }
}
