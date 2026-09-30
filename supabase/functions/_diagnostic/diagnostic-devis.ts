/**
 * Éprouver le prompt du DEVIS sur de vrais documents, sans rien déployer.
 *
 * L'OCR est celui du diagnostic des bons — il ne dépend d'aucun contrat. Seule
 * la structuration change : prompt et schéma viennent de `contrat-devis.ts`,
 * c'est-à-dire exactement ce que la fonction edge enverra.
 *
 *   docker run --rm \
 *     -v "$PWD:/w" -v "$HOME/Downloads:/pdf:ro" -w /w \
 *     --env-file supabase/functions/.env \
 *     denoland/deno:alpine-2.1.4 run --allow-net --allow-read --allow-env \
 *     supabase/functions/_diagnostic/diagnostic-devis.ts /pdf/DEV000208.pdf
 *
 * Ce qu'on regarde, dans cet ordre :
 *   1. le CLIENT — est-ce le destinataire, ou notre propre raison sociale ?
 *      C'est le piège n°1 du devis, et l'inverse de celui du bon ;
 *   2. le NUMÉRO, rendu à l'identique ;
 *   3. le nombre de lignes, contre ce que le PDF montre ;
 *   4. le total imprimé, contre la somme recalculée.
 */

/* L'OCR est réécrit ici plutôt qu'emprunté à `fournisseurs.ts` : celui-ci pose
   `table_format: "html"`, qui fait justement perdre les tableaux. Le diagnostic
   doit éprouver ce qui sera déployé, pas autre chose. */
async function ocrMistral(base64: string, cle: string) {
  const t0 = Date.now();
  const rep = await fetch("https://api.mistral.ai/v1/ocr", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${cle}` },
    body: JSON.stringify({
      model: "mistral-ocr-latest",
      document: { type: "document_url", document_url: `data:application/pdf;base64,${base64}` },
      include_image_base64: false,
    }),
    signal: AbortSignal.timeout(120_000),
  });
  if (!rep.ok) {
    return { markdown: "", mesure: { ms: Date.now() - t0, pages: 0 }, erreur: `OCR ${rep.status} : ${(await rep.text()).slice(0, 200)}` };
  }
  const json = await rep.json();
  const pages: { markdown?: string }[] = json.pages ?? [];
  return {
    markdown: pages.map((p) => p.markdown ?? "").join("\n\n---\n\n"),
    mesure: { ms: Date.now() - t0, pages: pages.length },
    erreur: null as string | null,
  };
}
import { CONTRAT_DEVIS, ecartsDeForme } from "../_shared/contrat-devis.ts";

const cle = Deno.env.get("MISTRAL_API_KEY");
if (!cle) {
  console.error("MISTRAL_API_KEY absente — la passer par --env-file.");
  Deno.exit(1);
}

const chemins = Deno.args;
if (!chemins.length) {
  console.error("Usage : diagnostic-devis.ts <fichier.pdf> [autre.pdf …]");
  Deno.exit(1);
}

function euros(n: unknown): string {
  return typeof n === "number" ? n.toFixed(2).replace(".", ",") + " €" : "—";
}

for (const chemin of chemins) {
  const nom = chemin.split("/").pop();
  console.log(`\n${"═".repeat(72)}\n  ${nom}\n${"═".repeat(72)}`);

  const octets = await Deno.readFile(chemin);
  let binaire = "";
  for (const o of octets) binaire += String.fromCharCode(o);
  const base64 = btoa(binaire);

  const ocr = await ocrMistral(base64, cle);
  if (ocr.erreur) {
    console.error(`  OCR en échec : ${ocr.erreur}`);
    continue;
  }
  console.log(
    `  OCR : ${ocr.mesure.pages ?? "?"} page(s), ${ocr.markdown.length} caractères, ${ocr.mesure.ms} ms`,
  );

  const t0 = Date.now();
  const rep = await fetch("https://api.mistral.ai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${cle}` },
    body: JSON.stringify({
      model: "mistral-medium-latest",
      temperature: 0,
      messages: [
        { role: "system", content: CONTRAT_DEVIS.promptSysteme },
        { role: "user", content: `${CONTRAT_DEVIS.intitule}\n\n${ocr.markdown}` },
      ],
      response_format: {
        type: "json_schema",
        json_schema: { name: "devis", strict: true, schema: CONTRAT_DEVIS.schemaJson },
      },
    }),
    signal: AbortSignal.timeout(120_000),
  });

  if (!rep.ok) {
    console.error(`  Extraction ${rep.status} : ${(await rep.text()).slice(0, 300)}`);
    continue;
  }

  const json = await rep.json();
  const d = JSON.parse(json.choices?.[0]?.message?.content ?? "{}");
  console.log(
    `  Extraction : ${Date.now() - t0} ms, ${json.usage?.prompt_tokens ?? 0} jetons entrée, ` +
      `${json.usage?.completion_tokens ?? 0} sortie`,
  );

  console.log(`\n  ── En-tête ──`);
  console.log(`    numéro          ${d.numeroDevis ?? "— NON LU —"}`);
  console.log(`    date            ${d.dateDevis ?? "—"}`);
  console.log(`    CLIENT          ${d.client ?? "— NON LU —"}`);
  console.log(`    interlocuteur   ${d.interlocuteur ?? "—"}`);
  console.log(`    chantier        ${[d.adresseChantier, d.codePostal, d.ville].filter(Boolean).join(", ") || "—"}`);
  console.log(`    logement        ${d.logementStatut ?? "—"}${d.occupant ? " · " + d.occupant : ""}`);

  const lignes: Record<string, unknown>[] = Array.isArray(d.lignes) ? d.lignes : [];
  const chiffrees = lignes.filter((l) => l.type === "ligne");
  const somme = chiffrees.reduce(
    (s, l) => s + (Number(l.qte) || 0) * (Number(l.prixUnitaire) || 0),
    0,
  );
  const options = lignes.filter((l) => l.optionnelle === true || l.tranche === "conditionnelle");

  console.log(`\n  ── Lignes ──`);
  console.log(
    `    ${lignes.length} au total : ${chiffrees.length} chiffrée(s), ` +
      `${lignes.filter((l) => l.type === "chapitre").length} chapitre(s), ` +
      `${lignes.filter((l) => l.type === "commentaire").length} commentaire(s)` +
      (options.length ? `, dont ${options.length} hors total (option/tranche)` : ""),
  );
  for (const l of lignes.slice(0, 6)) {
    const marque = l.type === "chapitre" ? "▸" : l.type === "commentaire" ? "·" : " ";
    const chiffre = l.type === "ligne"
      ? `  ${l.qte ?? "?"} ${l.unite ?? ""} × ${euros(l.prixUnitaire)}  TVA ${l.tva ?? "— NON LUE —"}`
      : "";
    console.log(`    ${marque} ${String(l.designation ?? "").slice(0, 58)}${chiffre}`);
  }
  if (lignes.length > 6) console.log(`      … ${lignes.length - 6} de plus`);

  console.log(`\n  ── Totaux ──`);
  console.log(`    imprimé sur le devis   HT ${euros(d.totalHT)} · TVA ${euros(d.totalTVA)} · TTC ${euros(d.totalTTC)}`);
  console.log(`    somme des lignes lues  HT ${euros(somme)}`);
  if (typeof d.totalHT === "number") {
    const ecart = somme - d.totalHT;
    console.log(`    écart                  ${euros(ecart)}${Math.abs(ecart) < 0.02 ? "  ✓" : "  ← à regarder"}`);
  }
  console.log(`    remise                 ${d.remisePourcentage ?? "—"} %${d.remiseMontantHT != null ? ` / ${euros(d.remiseMontantHT)}` : ""}`);

  const av: string[] = Array.isArray(d.avertissements) ? d.avertissements : [];
  console.log(`\n  ── Avertissements du modèle (${av.length}) ──`);
  for (const a of av) console.log(`    ! ${a}`);
  const ecarts = ecartsDeForme(d);
  if (ecarts.length) {
    console.log(`\n  ── Écarts au contrat (${ecarts.length}) ──`);
    for (const e of ecarts) console.log(`    ✗ ${e}`);
  }
}
