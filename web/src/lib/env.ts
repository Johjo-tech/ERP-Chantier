import { z } from "zod";

/**
 * La configuration, validée une fois au démarrage.
 *
 * Une URL de production dans un `.env.local` de développement a déjà coûté
 * cher au projet historique (des centaines de documents de test en base
 * réelle). On ne peut pas l'interdire ici — la production elle-même passe par
 * ce code — mais on refuse une configuration incomplète au lieu de démarrer à
 * moitié.
 */
/** Une clé publique réelle (JWT ou `sb_publishable_…`) dépasse largement cette longueur : en deçà, elle a été tronquée au copier-coller. */
const LONGUEUR_MIN_CLE = 20;

const schema = z.object({
  VITE_SUPABASE_URL: z.url({ message: "VITE_SUPABASE_URL doit être une URL." }),
  VITE_SUPABASE_ANON_KEY: z.string().min(LONGUEUR_MIN_CLE, "VITE_SUPABASE_ANON_KEY est vide ou tronquée."),
});

export type Configuration = { supabaseUrl: string; supabaseAnonKey: string };

export function lireConfiguration(source: Record<string, unknown>): Configuration {
  const r = schema.safeParse(source);
  if (!r.success) {
    const details = r.error.issues.map((i) => i.message).join(" ");
    throw new Error(`Configuration invalide : ${details} Voir web/.env.example.`);
  }
  return {
    supabaseUrl: r.data.VITE_SUPABASE_URL,
    supabaseAnonKey: r.data.VITE_SUPABASE_ANON_KEY,
  };
}
