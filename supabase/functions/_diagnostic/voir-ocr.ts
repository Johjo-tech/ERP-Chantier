/** Le Markdown brut, avec le MÊME appel OCR que celui qui sera déployé —
 *  c'est-à-dire SANS `table_format`, faute de quoi les tableaux se perdent. */
const cle = Deno.env.get("MISTRAL_API_KEY")!;
for (const chemin of Deno.args) {
  const octets = await Deno.readFile(chemin);
  let b = ""; for (const o of octets) b += String.fromCharCode(o);
  const rep = await fetch("https://api.mistral.ai/v1/ocr", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${cle}` },
    body: JSON.stringify({
      model: "mistral-ocr-latest",
      document: { type: "document_url", document_url: `data:application/pdf;base64,${btoa(b)}` },
      include_image_base64: false,
    }),
    signal: AbortSignal.timeout(120_000),
  });
  if (!rep.ok) { console.log(`OCR ${rep.status} : ${(await rep.text()).slice(0, 200)}`); continue; }
  const json = await rep.json();
  const pages: { markdown?: string }[] = json.pages ?? [];
  const md = pages.map((p) => p.markdown ?? "").join("\n\n---\n\n");
  console.log(`\n═══ ${chemin.split("/").pop()} — ${pages.length} page(s), ${md.length} car.`);
  console.log(md);
}
