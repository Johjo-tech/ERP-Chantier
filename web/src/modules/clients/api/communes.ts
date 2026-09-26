import { z } from "zod";
import { analyser } from "@/lib/validation";

/** Service public de découpage administratif (gratuit, sans clé), celui de l'ancien écran (app.js l. 2900). */
const GEO_API = "https://geo.api.gouv.fr/communes";
const CODE_POSTAL = /^\d{5}$/;

const schemaCommunes = z.array(z.object({ nom: z.string() }));

/**
 * Les communes d'un code postal (CLI-06). Un service qui ne répond pas ne
 * doit pas gêner la saisie : la ville se tape à la main, et on le trace.
 */
export async function communesDuCodePostal(codePostal: string, signal?: AbortSignal): Promise<string[]> {
  const cp = codePostal.trim();
  if (!CODE_POSTAL.test(cp)) return [];
  try {
    const rep = await fetch(`${GEO_API}?codePostal=${cp}&fields=nom&format=json`, signal ? { signal } : {});
    if (!rep.ok) {
      console.warn(`Communes du ${cp} indisponibles (HTTP ${rep.status}) : saisie manuelle.`);
      return [];
    }
    return analyser(schemaCommunes, await rep.json(), "communes du code postal").map((c) => c.nom);
  } catch (e) {
    if (signal?.aborted) return [];
    console.warn(`Communes du ${cp} indisponibles : saisie manuelle.`, e);
    return [];
  }
}
