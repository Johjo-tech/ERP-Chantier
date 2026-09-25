import { useSyncExternalStore } from "react";

/**
 * Le message éphémère de l'ancien écran (`showToast`, app.js l. 269) : une
 * bulle en bas de page, rouge par défaut, verte pour une réussite. Un seul à la
 * fois — le suivant remplace le précédent. Le rendu vit dans
 * `components/ui/toast.tsx`.
 */
export type TypeToast = "error" | "success";

export interface Toast {
  cle: number;
  message: string;
  type: TypeToast;
  duree: number;
}

/** L'ancien écran le laissait six secondes : le temps de lire une phrase de refus. */
export const DUREE_TOAST_MS = 6000;

let courant: Toast | null = null;
let compteur = 0;
const abonnes = new Set<() => void>();

export function afficherToast(message: string, type: TypeToast = "error", duree: number = DUREE_TOAST_MS): void {
  compteur += 1;
  courant = { cle: compteur, message, type, duree };
  for (const a of abonnes) a();
}

function abonner(rappel: () => void): () => void {
  abonnes.add(rappel);
  return () => abonnes.delete(rappel);
}

const lire = () => courant;

export function useToast(): Toast | null {
  return useSyncExternalStore(abonner, lire, lire);
}
