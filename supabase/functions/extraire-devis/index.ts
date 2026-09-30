/**
 * Relecture d'un devis (PDF ou image) via Mistral.
 *
 * Sert à faire entrer dans l'ERP un devis qui n'existe que dans l'ancien
 * logiciel. Il y garde son NUMÉRO d'origine : c'est la référence que le client
 * a sous les yeux.
 *
 * Toute la mécanique — les deux appels, le budget de temps, la reprise unique
 * sur refus passager, la cartographie des erreurs, les en-têtes CORS — vit dans
 * `_shared/ocr-mistral.ts`. Ce qui est propre au devis vit dans
 * `_shared/contrat-devis.ts`. Il ne reste rien à écrire ici, et c'est le but :
 * deux copies d'un budget de temps finiraient par diverger en silence.
 *
 * Déployée avec `verify_jwt = true` — déclaré dans `supabase/config.toml`, et
 * nulle part ailleurs. Sans ce bloc, la fonction est OUVERTE et n'importe qui
 * connaissant l'URL consomme le quota Mistral du projet.
 */

import { servirLecture } from "../_shared/ocr-mistral.ts";
import { CONTRAT_DEVIS } from "../_shared/contrat-devis.ts";

Deno.serve(servirLecture(CONTRAT_DEVIS));
