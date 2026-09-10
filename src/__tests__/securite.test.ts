/**
 * Exposition des données sans authentification.
 *
 * Ce test interroge l'API avec la seule clé anon — celle qui part dans le
 * bundle navigateur et qu'il faut considérer comme publique. Toute table qui
 * répond avec des lignes est lisible par quiconque connaît l'URL de l'app.
 *
 * Il tourne sans identifiants : c'est un contrôle de posture, pas un test
 * métier, et il doit passer y compris en CI.
 */

import { describe, it, expect } from "vitest";

const URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const CLE = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** Sans projet joignable (CI), le contrôle n'a pas lieu d'être. */
const disponible = Boolean(URL && CLE && !CLE.startsWith("cle-factice"));
const suite = disponible ? describe : describe.skip;

/** Nombre de lignes qu'un anonyme obtient, ou null si la table est fermée. */
async function lignesVisibles(table: string): Promise<number | null> {
  const rep = await fetch(`${URL}/rest/v1/${table}?select=*`, {
    headers: { apikey: CLE!, Prefer: "count=exact", Range: "0-0" },
  });
  if (!rep.ok) return null;
  const plage = rep.headers.get("content-range");
  const total = plage?.split("/")[1];
  return total ? Number(total) : null;
}

suite("Exposition anonyme", () => {
  const SENSIBLES = [
    "clients",
    "devis",
    "factures",
    "bons_commande",
    "interventions",
    "salaries",
    "societes",
    "membres_societe",
    "profiles",
    "planning_taches",
  ];

  it.each(SENSIBLES)("%s ne livre rien sans session", async (table) => {
    expect(await lignesVisibles(table)).toBeFalsy();
  });

  /**
   * `kv_store` précède la modélisation relationnelle et n'était protégée par
   * rien : 116 lignes lisibles, modifiables et effaçables avec la seule clé
   * anon. Fermée le 2026-09-09 par activation de la RLS sans politique.
   *
   * **Rouverte le 2026-09-10, délibérément** : un outil externe s'y branche et
   * personne ne sait encore avec quelle clé. Le cas est retourné plutôt que
   * supprimé — il dit désormais ce qui est vrai, et il redeviendra un test de
   * fermeture le jour où l'on refermera. Un test qu'on efface est un risque
   * qu'on oublie.
   *
   * Pour refermer : `drop policy kv_store_ouverte on public.kv_store;`
   * puis `revoke all on table public.kv_store from anon;`
   */
  it("kv_store est ouverte aux anonymes — provisoire et assumé", async () => {
    expect(await lignesVisibles("kv_store")).toBeTruthy();
  });
});
