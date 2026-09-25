import { existsSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { DOSSIER_RAPPORT, lireJson, type Mesure } from "./outils";

/**
 * Le rapport HTML : pour chaque écran et chaque taille, les trois images
 * (ancien, nouveau, différence), l'écart de pixels, les lignes de texte
 * manquantes et ajoutées. Écrit après la passe, à partir des mesures JSON —
 * une passe filtrée garde donc les mesures des écrans qu'elle n'a pas rejoués.
 */
export default function ecrireRapport(): void {
  if (!existsSync(DOSSIER_RAPPORT)) return;
  const mesures = readdirSync(DOSSIER_RAPPORT)
    .filter((f) => f.endsWith(".json"))
    .map((f) => lireJson<Mesure>(join(DOSSIER_RAPPORT, f)))
    .sort((a, b) => Number(!!a.aFaire) - Number(!!b.aFaire) || a.id.localeCompare(b.id) || a.taille.localeCompare(b.taille));
  writeFileSync(join(DOSSIER_RAPPORT, "index.html"), page(mesures));
  console.warn(`[visuel] rapport : ${join(DOSSIER_RAPPORT, "index.html")}`);
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] ?? c);
const pct = (r: number) => `${(r * 100).toFixed(2)} %`;

function page(mesures: readonly Mesure[]): string {
  const lignes = mesures
    .map((m) => `<tr class="${m.reussi ? "ok" : "ko"}"><td><a href="#${m.id}--${m.taille}">${esc(m.titre)}</a>${m.aFaire ? " <small>(à faire)</small>" : ""}</td><td>${m.taille}</td><td>${pct(m.pixels.ratio)} / ${pct(m.seuils.pixels)}</td><td>${m.texte.manquants.length + m.texte.ajoutes.length} / ${m.seuils.texte}</td><td>${m.reussi ? "✓" : "✗"}</td></tr>`)
    .join("");
  const details = mesures.map(detail).join("");
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Comparaison visuelle — ancien ↔ nouveau</title>
<style>
body{font-family:system-ui,sans-serif;margin:24px;color:#182233;background:#F3F5F8}
table{border-collapse:collapse;background:#fff}td,th{border:1px solid #E2E6ED;padding:6px 10px;text-align:left;font-size:13px}
tr.ko td:last-child{color:#D9363E;font-weight:700}tr.ok td:last-child{color:#12875A;font-weight:700}
section{background:#fff;border:1px solid #E2E6ED;border-radius:12px;padding:16px;margin:24px 0}
.images{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.images figure{margin:0}.images img{width:100%;border:1px solid #E2E6ED}
figcaption{font-size:12px;color:#6B7686;margin-bottom:4px}.textes{display:grid;grid-template-columns:1fr 1fr;gap:16px;font-size:12.5px}
.textes li{font-family:ui-monospace,monospace}.m{color:#D9363E}.a{color:#2461C7}
</style></head><body>
<h1>Comparaison visuelle — ancien ↔ nouveau</h1>
<p>${mesures.length} capture(s). Écart de pixels : part des pixels qui diffèrent (seuil pixelmatch 0,1). Écart de texte : lignes visibles manquantes + ajoutées.</p>
<table><thead><tr><th>Écran</th><th>Taille</th><th>Pixels (mesuré / seuil)</th><th>Texte (mesuré / seuil)</th><th></th></tr></thead><tbody>${lignes}</tbody></table>
${details}
</body></html>`;
}

function detail(m: Mesure): string {
  const img = (app: string) => `images/${m.id}--${m.taille}--${app}.png`;
  const liste = (l: readonly string[], c: string) => (l.length ? `<ul>${l.map((x) => `<li class="${c}">${esc(x)}</li>`).join("")}</ul>` : "<p>—</p>");
  return `<section id="${m.id}--${m.taille}"><h2>${esc(m.titre)} — ${m.taille} ${m.reussi ? "✓" : "✗"}</h2>
<p>Route nouvelle : <code>${esc(m.route)}</code> · pixels ${pct(m.pixels.ratio)} (${m.pixels.differents} px) · texte ${m.texte.manquants.length} manquant(s), ${m.texte.ajoutes.length} ajouté(s)${m.aFaire ? ` · <b>${esc(m.aFaire)}</b>` : ""}</p>
<div class="images"><figure><figcaption>Ancien</figcaption><img src="${img("ancien")}" loading="lazy"></figure><figure><figcaption>Nouveau</figcaption><img src="${img("nouveau")}" loading="lazy"></figure><figure><figcaption>Différence</figcaption><img src="${img("diff")}" loading="lazy"></figure></div>
<div class="textes"><div><h3>Manquant dans le nouveau</h3>${liste(m.texte.manquants, "m")}</div><div><h3>Ajouté par le nouveau</h3>${liste(m.texte.ajoutes, "a")}</div></div></section>`;
}
