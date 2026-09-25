import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { verifierCibleLocale } from "../cible";
import { gestionnaireBord } from "./deno-std";

/**
 * Charge une fonction de bord de l'application historique (`../supabase/functions`,
 * lue TELLE QUELLE) dans le processus du test, contre la base LOCALE.
 *
 * `npx supabase functions serve` exige l'image `edge-runtime`, que le réseau de
 * l'agent ne peut pas tirer (registre ECR refusé, Docker Hub limité), et la
 * fonction importe ses modules depuis deno.land et esm.sh, eux aussi fermés
 * (D-AUTH-09). On réécrit donc SEULEMENT les spécificateurs d'import — vers la
 * doublure de `serve` et le supabase-js du dépôt — et l'on pose `Deno.env`.
 * Le corps de la fonction, lui, est exécuté sans une virgule de changée.
 */
const RACINE_BORD = join(import.meta.dirname, "../../../../supabase/functions");
const require = createRequire(import.meta.url);

const IMPORTS: [RegExp, string][] = [
  [/"https:\/\/deno\.land\/std@[^"]+\/http\/server\.ts"/g, JSON.stringify(join(import.meta.dirname, "deno-std.ts"))],
  [/"https:\/\/esm\.sh\/@supabase\/supabase-js@2"/g, JSON.stringify(require.resolve("@supabase/supabase-js"))],
];

function reecrire(source: string): string {
  const texte = IMPORTS.reduce((t, [motif, cible]) => t.replace(motif, cible), source);
  const restant = /from "https?:\/\/[^"]+"/.exec(texte);
  if (restant) throw new Error(`Import distant non doublé : ${restant[0]}`);
  return texte;
}

export interface EnvBord {
  url: string;
  cleAnon: string;
  cleService: string;
  site: string;
}

export async function chargerFonctionDeBord(nom: string, env: EnvBord) {
  verifierCibleLocale();
  const variables: Record<string, string> = {
    SUPABASE_URL: env.url,
    SUPABASE_ANON_KEY: env.cleAnon,
    SUPABASE_SERVICE_ROLE_KEY: env.cleService,
    SITE_URL: env.site,
  };
  (globalThis as { Deno?: unknown }).Deno = { env: { get: (k: string) => variables[k] } };

  const dossier = mkdtempSync(join(tmpdir(), "bord-"));
  mkdirSync(join(dossier, nom));
  mkdirSync(join(dossier, "_shared"));
  writeFileSync(join(dossier, "_shared", "supabase.ts"), reecrire(readFileSync(join(RACINE_BORD, "_shared", "supabase.ts"), "utf8")));
  writeFileSync(join(dossier, nom, "index.ts"), reecrire(readFileSync(join(RACINE_BORD, nom, "index.ts"), "utf8")));
  await import(/* @vite-ignore */ join(dossier, nom, "index.ts"));
  return gestionnaireBord();
}
