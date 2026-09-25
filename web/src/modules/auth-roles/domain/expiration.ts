/**
 * Reconnaître une session expirée dans une erreur de lecture.
 *
 * L'ancien écran testait `PGRST301`, le statut 401 et la mention « JWT »
 * (`app.js:557`) : un jeton expiré que le rafraîchissement n'a pas pu
 * renouveler (poste en veille, mot de passe changé ailleurs) fait échouer
 * TOUTES les lectures. Afficher « session expirée » sur chaque écran sans
 * rien proposer laissait l'utilisateur devant une application morte ; on le
 * renvoie à la connexion.
 */
const CODES_EXPIRATION = new Set(["PGRST301", "PGRST302", "PGRST303"]);
const STATUT_NON_AUTHENTIFIE = 401;

interface ErreurHttp {
  code?: unknown;
  status?: unknown;
  message?: unknown;
}

export function estSessionExpiree(e: unknown): boolean {
  if (typeof e !== "object" || e === null) return false;
  const { code, status, message } = e as ErreurHttp;
  if (typeof code === "string" && CODES_EXPIRATION.has(code)) return true;
  if (status === STATUT_NON_AUTHENTIFIE) return true;
  return typeof message === "string" && /\bJWT\b|jwt expired|invalid jwt/i.test(message);
}

/** Pourquoi la session a été fermée sans que l'utilisateur l'ait demandé. */
export type MotifDeconnexion = "session_expiree";

export const MESSAGES_DECONNEXION: Record<MotifDeconnexion, string> = {
  session_expiree: "Votre session a expiré. Reconnectez-vous pour reprendre là où vous en étiez.",
};
