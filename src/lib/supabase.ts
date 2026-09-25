/**
 * Le client Supabase, pour les îlots React.
 *
 * Ce fichier ne CRÉE rien : il ré-exporte l'instance unique de
 * `src/api/client.ts`. La distinction n'est pas cosmétique.
 *
 * `createClient()` fabrique un client qui tient sa propre session : jeton en
 * mémoire, rafraîchissement, écoute des changements d'authentification. Deux
 * appels donnent deux sessions qui se rafraîchissent chacune de leur côté et
 * finissent par diverger — l'une se déconnecte, l'autre se croit connectée.
 * L'écran hérité (`app.js`) n'appelle jamais `createClient` ; il passe par le
 * pont `window.*`, qui repose sur cette même instance. Un îlot qui en créerait
 * une seconde romprait l'unicité que tout le reste tient déjà.
 *
 * Donc : importer d'ici, ou directement de `@/api/client`. Jamais
 * `createClient` ailleurs que dans `src/api/client.ts`.
 */

export { supabase } from "@/api/client";
export type { Database } from "@/api/database.types";
