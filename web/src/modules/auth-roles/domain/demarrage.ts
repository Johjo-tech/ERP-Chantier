import type { DroitAccorde } from "./permissions";

/**
 * Ce que l'ouverture de session doit réunir avant le premier rendu, et ce qui
 * l'interdit.
 *
 * L'ancien écran attendait la couche de données 15 s puis affichait
 * « Application indisponible » avec la raison (`app.js#init`) : sans délai, un
 * module qui ne se charge pas — identifiants absents du déploiement, requête
 * bloquée — laissait l'écran vide et muet.
 */
export const DELAI_DEMARRAGE_MS = 15_000;

/**
 * Le démarrage ne peut pas aboutir, pour une raison qu'on sait dire.
 *
 * Nommée pour que `messageErreur` la montre telle quelle : c'est la seule
 * chose que l'utilisateur verra, elle doit dire quoi vérifier.
 */
export class DemarrageImpossible extends Error {
  override name = "DemarrageImpossible";
}

export const MESSAGE_DELAI_DEPASSE =
  "La couche de données n'a pas répondu en 15 secondes. Vérifiez votre connexion ; " +
  "si elle est bonne, vérifiez que VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY sont définies dans l'environnement de déploiement.";

/** La promesse, ou un refus nommé si elle ne se résout pas à temps. */
export function avecDelai<T>(promesse: Promise<T>, delaiMs: number = DELAI_DEMARRAGE_MS): Promise<T> {
  let minuteur: ReturnType<typeof setTimeout> | undefined;
  const expiration = new Promise<never>((_, rejeter) => {
    minuteur = setTimeout(() => rejeter(new DemarrageImpossible(MESSAGE_DELAI_DEPASSE)), delaiMs);
  });
  return Promise.race([promesse, expiration]).finally(() => clearTimeout(minuteur));
}

/**
 * La matrice lue doit être entière : tout l'affichage s'y réfère.
 *
 * Une matrice vide masquerait l'application entière en la faisant passer pour
 * un problème de droits ; une matrice tronquée (plafond de lignes de
 * PostgREST) retirerait des droits au hasard. Dans les deux cas l'ancien code
 * refusait de démarrer (`queries/acces.ts#listRolePermissions`) : on fait de même.
 */
export function verifierMatrice(lignes: readonly DroitAccorde[], total: number | null): readonly DroitAccorde[] {
  if (total !== null && lignes.length < total) {
    throw new DemarrageImpossible(`Matrice des droits tronquée : ${lignes.length} lignes reçues sur ${total}. Rechargez la page ; si le défaut persiste, signalez-le.`);
  }
  if (lignes.length === 0) {
    throw new DemarrageImpossible("Matrice des droits vide : aucun droit ne serait accordé à personne. Signalez-le à un administrateur.");
  }
  return lignes;
}
