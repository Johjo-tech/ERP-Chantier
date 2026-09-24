#!/usr/bin/env node
// Garde-fou PreToolUse : refuse toute commande qui viserait la production ou
// effacerait en masse. Les règles `deny` de settings.json filtrent par préfixe ;
// ceci attrape les mêmes intentions où qu'elles apparaissent dans la commande
// (après un `cd … &&`, dans un `bash -c`, par un chemin absolu…).
import { readFileSync } from "node:fs";

const entree = JSON.parse(readFileSync(0, "utf8") || "{}");
const commande = String(entree?.tool_input?.command ?? "");

const INTERDITS = [
  [/\bdb\s+push\b/, "`supabase db push` ne fonctionne pas sur ce projet et viserait la production."],
  [/--linked\b/, "Toute commande Supabase `--linked` vise le projet distant (production)."],
  [/\bsupabase\s+link\b/, "Lier le CLI au projet distant est réservé à un humain."],
  [/\bfunctions\s+deploy\b|\bsecrets\s+set\b/, "Déployer une Edge Function ou un secret est réservé à un humain."],
  [/[a-z0-9-]+\.supabase\.co\b/i, "Aucune connexion à une base Supabase distante depuis la réécriture."],
  [/deployer\.sh/, "Le déploiement de production est réservé à un humain."],
  [/vercel\b.*--prod/, "Le déploiement de production est réservé à un humain."],
  [/git\s+push\b.*(--force|-f\b|\bmain\b)/, "Pas de push forcé ni de push sur main."],
  [/rm\s+-[a-z]*r[a-z]*f?\s+(\/|~|\.\.|\.\/?\s*$|\*)/i, "Suppression massive refusée."],
  [/\bdrop\s+(table|schema|database)\b/i, "DROP refusé : passer par une migration relue."],
  [/\btruncate\b/i, "TRUNCATE refusé."],
];

for (const [motif, raison] of INTERDITS) {
  if (motif.test(commande)) {
    process.stderr.write(`Bloqué par .claude/hooks/garde-prod.mjs : ${raison}\n`);
    process.exit(2);
  }
}
process.exit(0);
