/**
 * Lecture d'un bon de commande (PDF ou image) via Mistral.
 *
 * Toute la mécanique — l'OCR puis la structuration sous schéma strict, le
 * budget de temps, la reprise unique sur refus passager, la cartographie des
 * erreurs, les en-têtes CORS — vit dans `_shared/ocr-mistral.ts`. Ce qui est
 * propre au bon vit dans `_shared/contrat-bc.ts`, et ce qui est propre à chaque
 * bailleur dans `_shared/profils-bc.ts`.
 *
 * Cette fonction en était une copie, faite avant que le socle n'existe. Les
 * pages nommées et les traces par page, ajoutées au socle, ne seraient arrivées
 * que d'un côté : deux copies d'un budget de temps finissent par diverger.
 *
 * Déployée avec `verify_jwt = true` — déclaré dans `supabase/config.toml`, et
 * nulle part ailleurs.
 */

import { servirLecture } from "../_shared/ocr-mistral.ts";
import { CONTRAT_BC } from "../_shared/contrat-bc.ts";

Deno.serve(servirLecture(CONTRAT_BC));
