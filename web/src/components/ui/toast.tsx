import { useEffect, useState } from "react";
import { useToast } from "@/lib/toast";

/** Le fondu de sortie de `#toastBox` (`transition: opacity .25s` de l'ancienne feuille). */
const FONDU_MS = 250;

type Etape = "entree" | "visible" | "sortie" | "cache";

/** `#toastBox` de l'ancien écran, à poser une fois dans le cadre de l'application. */
export function ToastBox() {
  const toast = useToast();
  const [phase, setPhase] = useState<{ cle: number; etape: Etape }>({ cle: 0, etape: "cache" });
  const etape: Etape = toast && phase.cle === toast.cle ? phase.etape : toast ? "entree" : "cache";

  useEffect(() => {
    if (!toast) return undefined;
    // Deux images : la bulle doit être posée AVANT de recevoir `.show`, sans quoi sa transition ne joue pas.
    let seconde = 0;
    const premiere = requestAnimationFrame(() => {
      seconde = requestAnimationFrame(() => setPhase({ cle: toast.cle, etape: "visible" }));
    });
    const sortie = setTimeout(() => setPhase({ cle: toast.cle, etape: "sortie" }), toast.duree);
    const fin = setTimeout(() => setPhase({ cle: toast.cle, etape: "cache" }), toast.duree + FONDU_MS);
    return () => {
      cancelAnimationFrame(premiere);
      cancelAnimationFrame(seconde);
      clearTimeout(sortie);
      clearTimeout(fin);
    };
  }, [toast]);

  if (!toast || etape === "cache") return null;
  return (
    <div id="toastBox" role="status" aria-live="polite" className={`toast ${toast.type}${etape === "visible" ? " show" : ""}`} style={{ display: "block" }}>
      {toast.message}
    </div>
  );
}
