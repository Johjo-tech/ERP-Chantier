/**
 * Point d'entrée des îlots React.
 *
 * La racine Vite est `src/pages` : un `src="../islands/x.tsx"` dans le HTML
 * sort de la racine et n'est pas servi. Ce fichier, lui, est dans la racine et
 * peut importer au-dessus normalement — même raison d'être qu'`entry.ts`.
 *
 * Il est délibérément séparé d'`entry.ts`. Celui-là charge le pont dont
 * l'écran hérité DÉPEND pour démarrer ; celui-ci ne charge que des greffes
 * optionnelles. Fondus, une erreur dans un îlot empêcherait l'application de
 * se lancer.
 */

import { createElement } from "react";
import { monter } from "@/islands/monter";
import { IlotDemo } from "@/islands/demo";

monter("ilot-demo", createElement(IlotDemo));
