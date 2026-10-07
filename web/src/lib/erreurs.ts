/**
 * Toute erreur montrée à l'écran est en français et dit quoi faire.
 *
 * Les codes Postgres/PostgREST sont traduits ici, à un seul endroit ; un
 * composant n'affiche jamais `error.message` brut.
 */
interface ErreurPostgrest {
  code?: string;
  message?: string;
  details?: string | null;
  hint?: string | null;
}

const PAR_CODE: Record<string, string> = {
  "42501": "Vous n'avez pas le droit de faire cette opération.",
  "23505": "Cet enregistrement existe déjà (doublon).",
  "23503": "Cet enregistrement est utilisé ailleurs et ne peut pas être modifié ainsi.",
  "23502": "Une information obligatoire manque.",
  "23514": "Une valeur saisie n'est pas acceptée.",
  "22P02": "Une valeur saisie n'a pas le bon format.",
  PGRST116: "Enregistrement introuvable, ou vous n'y avez pas accès.",
  PGRST301: "Votre session a expiré. Reconnectez-vous.",
};

function estErreurPostgrest(e: unknown): e is ErreurPostgrest {
  return typeof e === "object" && e !== null && ("code" in e || "message" in e);
}

/**
 * Un texte rédigé par NOS fonctions et déclencheurs, en français — par
 * opposition aux messages natifs de Postgres ou PostgREST, en anglais et
 * techniques (« new row violates row-level security policy… »).
 *
 * Le test porte sur la langue et non sur le code : la base lève ses refus
 * rédigés sous 42501, 23514, P0001 ou P0002 selon la fonction, et un message
 * natif anglais ne doit jamais atteindre l'écran.
 */
const MARQUES_DU_FRANCAIS = /[àâçéèêëîïôûùüœ]|\b(le|la|les|du|des|une?|est|pas|doit|seul|ce|cette|sur|aux?|introuvable|refus[ée]?e?|non|droits?)\b/i;

function estRedigeEnFrancais(t: string | null | undefined): t is string {
  return !!t && MARQUES_DU_FRANCAIS.test(t);
}

/**
 * Le motif d'un refus de la base, quand elle en a rédigé un (AUTH-39).
 *
 * Même ordre que l'ancien écran (`dernierRefus = details || hint || message`) :
 * le détail est le plus précis. Rend null pour un message natif.
 */
export function motifDeLaBase(e: unknown): string | null {
  // Seule une réponse de la base (objet PostgREST, avec son code) est lue : une
  // erreur de validation Zod porte aussi du français, mais en JSON illisible.
  // Une réponse PostgREST porte toujours `details` et `hint` (fût-ce à null) ;
  // les refus fabriqués par nos modules `api/` (« Suppression refusée ») n'en
  // ont pas, et gardent leur traduction générique.
  if (!estErreurPostgrest(e) || !e.code || !("details" in e || "hint" in e)) return null;
  if (e instanceof Error && e.name !== "PostgrestError") return null;
  const { details, hint, message } = e as ErreurPostgrest;
  return [details, hint, message].find(estRedigeEnFrancais) ?? null;
}

export function messageErreur(e: unknown): string {
  if (estErreurPostgrest(e)) {
    // Un refus que la base a motivé se montre avec son motif : « Vous n'avez
    // pas le droit » sans dire lequel envoyait chercher un défaut ailleurs.
    const motif = motifDeLaBase(e);
    if (motif) return motif;
    if (e.code && PAR_CODE[e.code]) return PAR_CODE[e.code] as string;
    // Les déclencheurs métier lèvent des messages déjà rédigés en français
    // (« facture figée », etc.) : ils sont faits pour être lus tels quels.
    if (e.code === "P0001" && e.message) return e.message;
    if (e.message && /Failed to fetch|NetworkError|fetch failed/i.test(e.message)) {
      return "Le serveur est injoignable. Vérifiez votre connexion puis réessayez.";
    }
    if (e.message === "Invalid login credentials") return "Adresse e-mail ou mot de passe incorrect.";
  }
  if (e instanceof Error && (e.message.startsWith("Configuration invalide") || ["ErreurFormat", "EnregistrementPartiel", "LectureImpossible", "PreparationImpossible", "SavSansToutesSesPhotos", "DemarrageImpossible", "ListeTronquee"].includes(e.name))) {
    return e.message;
  }
  return "Une erreur inattendue est survenue. Réessayez ; si elle persiste, signalez-la.";
}

/** Lève l'erreur Supabase si elle existe, pour que TanStack Query la voie. */
export function exiger<T>(r: { data: T | null; error: unknown }): T {
  if (r.error) throw r.error;
  if (r.data === null) throw { code: "PGRST116", message: "Aucune donnée" } satisfies ErreurPostgrest;
  return r.data;
}
