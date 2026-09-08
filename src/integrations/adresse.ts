/**
 * Autocomplétion d'adresse via la Base Adresse Nationale
 * (api-adresse.data.gouv.fr — gratuite, sans clé, CORS ouvert).
 *
 * Porté depuis chantier-mate-ease, où l'appel passait par une fonction serveur.
 * ERP-Chantier étant statique, l'appel part du navigateur : l'API l'autorise,
 * et aucune donnée sensible ne transite.
 */

export interface SuggestionAdresse {
  label: string;
  adresse: string;
  codePostal: string;
  ville: string;
}

const URL_BAN = "https://api-adresse.data.gouv.fr/search/";

export async function rechercherAdresse(requete: string): Promise<SuggestionAdresse[]> {
  const q = requete.trim();
  if (q.length < 3) return [];

  try {
    const url = `${URL_BAN}?limit=6&type=housenumber&autocomplete=1&q=${encodeURIComponent(q)}`;
    const rep = await fetch(url, { headers: { Accept: "application/json" } });
    if (!rep.ok) return [];

    const json = (await rep.json()) as {
      features?: Array<{
        properties?: { label?: string; name?: string; postcode?: string; city?: string };
      }>;
    };

    return (json.features ?? [])
      .map((f) => ({
        label: f.properties?.label ?? "",
        adresse: f.properties?.name ?? "",
        codePostal: f.properties?.postcode ?? "",
        ville: f.properties?.city ?? "",
      }))
      .filter((s) => s.label);
  } catch {
    // Réseau indisponible : la saisie manuelle reste possible
    return [];
  }
}
