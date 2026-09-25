import { z } from "zod";
import { analyser } from "@/lib/validation";

/**
 * Autocomplétion d'adresse par la Base Adresse Nationale (api-adresse.data.gouv.fr,
 * gratuite, sans clé, CORS ouvert) — celle de l'ancien écran
 * (`src/integrations/adresse.ts`). Un service muet n'empêche jamais la saisie
 * manuelle : on trace, et l'on ne propose rien.
 */
const URL_BAN = "https://api-adresse.data.gouv.fr/search/";
/** En dessous, la BAN répond n'importe quoi. */
export const CARACTERES_MINIMUM_ADRESSE = 3;
const PROPOSITIONS_MAX = 6;

export interface SuggestionAdresse {
  label: string;
  adresse: string;
  codePostal: string;
  ville: string;
}

const schemaBan = z.object({
  features: z
    .array(z.object({ properties: z.object({ label: z.string().nullish(), name: z.string().nullish(), postcode: z.string().nullish(), city: z.string().nullish() }).nullish() }))
    .nullish(),
});

export async function rechercherAdresse(requete: string, signal?: AbortSignal): Promise<SuggestionAdresse[]> {
  const q = requete.trim();
  if (q.length < CARACTERES_MINIMUM_ADRESSE) return [];
  try {
    const rep = await fetch(`${URL_BAN}?limit=${PROPOSITIONS_MAX}&type=housenumber&autocomplete=1&q=${encodeURIComponent(q)}`, {
      headers: { Accept: "application/json" },
      ...(signal ? { signal } : {}),
    });
    if (!rep.ok) {
      console.warn(`Base Adresse Nationale : réponse ${rep.status} — saisie manuelle.`);
      return [];
    }
    return (analyser(schemaBan, await rep.json(), "adresses proposées").features ?? [])
      .map((f) => ({ label: f.properties?.label ?? "", adresse: f.properties?.name ?? "", codePostal: f.properties?.postcode ?? "", ville: f.properties?.city ?? "" }))
      .filter((s) => s.label);
  } catch (e) {
    if (signal?.aborted) return [];
    console.warn("Base Adresse Nationale injoignable — saisie manuelle.", e);
    return [];
  }
}
