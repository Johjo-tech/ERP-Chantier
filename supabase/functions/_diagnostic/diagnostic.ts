/**
 * Diagnostic : Gemini contre Mistral, sur de vrais bons de commande.
 *
 * Hors déploiement — le préfixe `_` écarte ce dossier de `supabase functions
 * deploy`, comme `_shared`. Rien de ceci ne part en production.
 *
 * Il ne construit rien : il mesure. Trois extractions par document, le même
 * contrat en sortie, et un tableau champ par champ pour voir où elles
 * divergent. C'est ce qui manquait pour trancher.
 *
 *   docker run --rm -v "$PWD:/w" -w /w --env-file supabase/functions/.env \
 *     denoland/deno:alpine-2.1.4 run --allow-net --allow-read --allow-write --allow-env \
 *     supabase/functions/_diagnostic/diagnostic.ts
 */

import { CHAMPS_TEXTE, ecartsDeForme } from "./contrat.ts";
import { extraireMistral, ocrMistral, parGemini, type Mesure } from "./fournisseurs.ts";

const DOSSIER = "supabase/functions/_diagnostic";
const ECHANTILLONS = `${DOSSIER}/samples`;
const SORTIE = `${DOSSIER}/resultats`;

/**
 * Tarifs, à renseigner pour obtenir une estimation en euros.
 *
 * Laissés à `null` volontairement : annoncer un coût sur des prix que je n'ai
 * pas vérifiés vaudrait moins que de n'en annoncer aucun. Le rapport donne de
 * toute façon les jetons et les pages, qui eux sont mesurés.
 */
const TARIFS: Record<string, { entree: number | null; sortie: number | null; parPage?: number | null }> = {
  "mistral-ocr-latest": { entree: null, sortie: null, parPage: null },
  "mistral-medium-latest": { entree: null, sortie: null },
  "mistral-small-latest": { entree: null, sortie: null },
  "gemini-3.7-flash": { entree: null, sortie: null },
  "gemini-3.8-flash": { entree: null, sortie: null },
  "gemini-3.6-flash": { entree: null, sortie: null },
};

/* ------------------------------------------------------------ anonymat ---- */

/**
 * Le nom d'un locataire ne sort pas d'ici.
 *
 * `occupant` et `interlocuteur` portent des personnes physiques ; ils sont
 * masqués partout où ce diagnostic écrit — fichiers comme rapport — et leur
 * **présence** reste visible, puisque c'est elle qu'on compare. Savoir qu'un
 * fournisseur a trouvé l'occupant et l'autre non ne demande pas de lire le nom.
 */
const SENSIBLES = new Set(["occupant", "interlocuteur"]);

function masquer(champ: string, valeur: unknown): unknown {
  if (!SENSIBLES.has(champ) || valeur == null || valeur === "") return valeur;
  const t = String(valeur);
  return `«${t.length} caractères masqués»`;
}

export function bonAnonyme(bon: Record<string, unknown> | null): Record<string, unknown> | null {
  if (!bon) return null;
  const copie: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(bon)) copie[k] = masquer(k, v);
  return copie;
}

/* -------------------------------------------------------------- rapport --- */

function afficher(valeur: unknown, largeur = 34): string {
  if (valeur == null || valeur === "") return "—";
  const t = String(valeur).replace(/\s+/g, " ");
  return t.length > largeur ? t.slice(0, largeur - 1) + "…" : t;
}

/** Deux valeurs disent-elles la même chose ? La casse et les espaces ne comptent pas. */
function equivalent(a: unknown, b: unknown): boolean {
  const n = (v: unknown) => (v == null ? "" : String(v).trim().toLowerCase().replace(/\s+/g, " "));
  return n(a) === n(b);
}

function totalMs(m: Mesure[]): number {
  return m.reduce((s, x) => s + x.ms, 0);
}

function coutEuros(mesures: Mesure[]): number | null {
  // Sans appel, il n'y a rien à estimer : afficher « 0,0000 € » laisserait
  // croire à une extraction gratuite là où il n'y a pas eu d'extraction.
  if (!mesures.length) return null;
  let total = 0;
  for (const m of mesures) {
    const t = TARIFS[m.modele];
    if (!t) return null;
    if (m.pages != null) {
      if (t.parPage == null) return null;
      total += m.pages * t.parPage;
      continue;
    }
    if (t.entree == null || t.sortie == null) return null;
    total += (m.tokensEntree / 1_000_000) * t.entree + (m.tokensSortie / 1_000_000) * t.sortie;
  }
  return total;
}

/* ----------------------------------------------------------------- main --- */

export interface Colonne {
  nom: string;
  bon: Record<string, unknown> | null;
  mesures: Mesure[];
  erreur: string | null;
}

export function tableau(colonnes: Colonne[]): string {
  const lignes: string[] = [];
  const entete = ["champ".padEnd(20), ...colonnes.map((c) => c.nom.padEnd(36))].join(" │ ");
  lignes.push(entete);
  lignes.push("─".repeat(entete.length));

  const champs = [...CHAMPS_TEXTE, "montantTotalHT"];
  for (const champ of champs) {
    const valeurs = colonnes.map((c) => (c.bon ? masquer(champ, c.bon[champ]) : null));
    const remplies = valeurs.filter((v) => v != null && v !== "");
    /* On ne compare que ce qui a été rempli : une case vide n'est pas un
       désaccord, c'est une absence de réponse. Les mélanger marquait « ≠ » des
       champs sur lesquels les fournisseurs s'accordaient mot pour mot.

       Quatre états, et le plus instructif est le troisième : « · » désigne un
       champ qu'un seul fournisseur a trouvé — c'est là que se juge l'écart. */
    const diverge = remplies.length > 1 && !remplies.every((v) => equivalent(v, remplies[0]));
    const marque = diverge ? "≠" : remplies.length > 1 ? "=" : remplies.length === 1 ? "·" : " ";
    lignes.push(
      [`${marque} ${champ}`.padEnd(20), ...valeurs.map((v) => afficher(v).padEnd(36))].join(" │ "),
    );
  }

  const compte = (c: Colonne, cle: string) => (Array.isArray(c.bon?.[cle]) ? (c.bon![cle] as unknown[]).length : 0);
  lignes.push("─".repeat(entete.length));
  lignes.push(["  lignes".padEnd(20), ...colonnes.map((c) => String(compte(c, "lignes")).padEnd(36))].join(" │ "));
  lignes.push(["  dont chapitres".padEnd(20), ...colonnes.map((c) => {
    const l = (c.bon?.lignes as { type?: string }[] | undefined) ?? [];
    return String(l.filter((x) => x.type === "chapitre").length).padEnd(36);
  })].join(" │ "));
  lignes.push(["  avertissements".padEnd(20), ...colonnes.map((c) => String(compte(c, "avertissements")).padEnd(36))].join(" │ "));

  lignes.push(["  champs remplis".padEnd(20), ...colonnes.map((c) => {
    const n = champs.filter((f) => c.bon && c.bon[f] != null && c.bon[f] !== "").length;
    return `${n} / ${champs.length}`.padEnd(36);
  })].join(" │ "));

  lignes.push(["  durée".padEnd(20), ...colonnes.map((c) => `${(totalMs(c.mesures) / 1000).toFixed(1)} s`.padEnd(36))].join(" │ "));
  lignes.push(["  jetons (in/out)".padEnd(20), ...colonnes.map((c) => {
    const e = c.mesures.reduce((s, m) => s + m.tokensEntree, 0);
    const s = c.mesures.reduce((x, m) => x + m.tokensSortie, 0);
    return `${e} / ${s}`.padEnd(36);
  })].join(" │ "));
  lignes.push(["  coût estimé".padEnd(20), ...colonnes.map((c) => {
    const e = coutEuros(c.mesures);
    return (e == null ? "tarifs non renseignés" : `${e.toFixed(4)} €`).padEnd(36);
  })].join(" │ "));

  const enErreur = colonnes.filter((c) => c.erreur);
  if (enErreur.length) {
    lignes.push("");
    for (const c of enErreur) lignes.push(`  ⚠ ${c.nom} : ${c.erreur}`);
  }

  const malformes = colonnes.flatMap((c) => (c.bon ? ecartsDeForme(c.bon).map((e) => `  ⚠ ${c.nom} : ${e}`) : []));
  if (malformes.length) { lignes.push(""); lignes.push(...malformes); }

  return lignes.join("\n");
}

async function main() {
  const cleMistral = Deno.env.get("MISTRAL_API_KEY");
  const cleGemini = Deno.env.get("GEMINI_API_KEY");
  if (!cleMistral) { console.error("MISTRAL_API_KEY absente de supabase/functions/.env"); Deno.exit(1); }
  if (!cleGemini) console.error("⚠ GEMINI_API_KEY absente : la colonne Gemini restera vide.\n");

  let fichiers: string[] = [];
  try {
    for await (const e of Deno.readDir(ECHANTILLONS)) {
      if (e.isFile && e.name.toLowerCase().endsWith(".pdf")) fichiers.push(e.name);
    }
  } catch {
    console.error(`Déposez vos bons de commande dans ${ECHANTILLONS}/`); Deno.exit(1);
  }
  fichiers.sort();
  if (!fichiers.length) { console.error(`Aucun PDF dans ${ECHANTILLONS}/`); Deno.exit(1); }

  await Deno.mkdir(SORTIE, { recursive: true });
  const debut = Date.now();
  const rapport: string[] = [];

  for (const nom of fichiers) {
    const octets = await Deno.readFile(`${ECHANTILLONS}/${nom}`);
    const base64 = btoa(Array.from(octets, (o) => String.fromCharCode(o)).join(""));
    const titre = `\n═══ ${nom}  (${(octets.length / 1024).toFixed(0)} Ko)`;
    console.error(titre);
    rapport.push(titre);

    console.error("  Gemini…");
    const gemini = cleGemini
      ? await parGemini(base64, cleGemini)
      : { bon: null, mesures: [], erreur: "clé absente" };

    console.error("  Mistral OCR…");
    const ocr = await ocrMistral(base64, cleMistral);
    if (ocr.erreur) console.error(`  ⚠ ${ocr.erreur}`);
    else {
      console.error(`  OCR : ${ocr.mesure.pages} page(s), ${(ocr.mesure.ms / 1000).toFixed(1)} s`);
      // Le Markdown n'est pas anonymisé : il est le document lui-même, et ne
      // sort pas du poste. On ne l'écrit donc pas sur disque.
    }

    const colonnes: Colonne[] = [{ nom: "Gemini (actuel)", ...gemini }];

    for (const modele of ["mistral-medium-latest", "mistral-small-latest"]) {
      if (ocr.erreur) {
        colonnes.push({ nom: modele.replace("-latest", ""), bon: null, mesures: [ocr.mesure], erreur: ocr.erreur });
        continue;
      }
      console.error(`  ${modele}…`);
      const r = await extraireMistral(ocr.markdown, modele, cleMistral);
      colonnes.push({
        nom: modele.replace("-latest", ""),
        bon: r.bon,
        // L'OCR est partagé : on le compte dans chaque colonne pour que la
        // durée et le coût reflètent un bon lu de bout en bout.
        mesures: [ocr.mesure, ...r.mesures],
        erreur: r.erreur,
      });
    }

    const t = tableau(colonnes);
    console.error(t);
    rapport.push(t);

    const sortie = nom.replace(/\.pdf$/i, "") + ".json";
    await Deno.writeTextFile(
      `${SORTIE}/${sortie}`,
      JSON.stringify(
        Object.fromEntries(colonnes.map((c) => [c.nom, { bon: bonAnonyme(c.bon), erreur: c.erreur, mesures: c.mesures }])),
        null,
        2,
      ),
    );
  }

  const fin = `\nTotal : ${fichiers.length} document(s) en ${((Date.now() - debut) / 1000).toFixed(1)} s.` +
    `\nDétail anonymisé écrit dans ${SORTIE}/.`;
  console.error(fin);
  rapport.push(fin);
  await Deno.writeTextFile(`${SORTIE}/rapport.txt`, rapport.join("\n"));
}

if (import.meta.main) await main();
