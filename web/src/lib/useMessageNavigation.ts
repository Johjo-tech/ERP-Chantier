import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router";
import { afficherToast } from "./toast";

/** Ce qu'un geste qui ouvre une autre page lui confie à dire : une phrase, rouge si c'est un refus. */
export interface MessageNavigation {
  message?: string;
  alerte?: boolean;
}

function lireMessage(etat: unknown): MessageNavigation | null {
  if (!etat || typeof etat !== "object") return null;
  const { message, alerte } = etat as Record<string, unknown>;
  return typeof message === "string" && message ? { message, alerte: alerte === true } : null;
}

/**
 * Dit, dans la bulle de l'ancien écran (`showToast`), le message qu'un geste a confié à la
 * navigation — « Facture créée en brouillon… » après « 🧾 Créer la facture », par exemple.
 * La page d'arrivée doit le lire : sans elle, le message part dans l'état de l'historique et
 * personne ne le voit (D-E2E-02). Il se dit une fois : il est retiré de l'état, le reste
 * (préremplissage, document lu…) est gardé, sans quoi un retour arrière le redirait.
 */
export function useMessageNavigation(): void {
  const location = useLocation();
  const navigate = useNavigate();
  const lu = lireMessage(location.state);
  const message = lu?.message;
  const alerte = lu?.alerte ?? false;
  useEffect(() => {
    if (!message) return;
    afficherToast(message, alerte ? "error" : "success");
    const reste = Object.entries((location.state ?? {}) as Record<string, unknown>).filter(([cle]) => cle !== "message" && cle !== "alerte");
    void navigate(location.pathname + location.search, { replace: true, state: reste.length ? Object.fromEntries(reste) : null });
  }, [message, alerte, navigate, location.pathname, location.search, location.state]);
}
