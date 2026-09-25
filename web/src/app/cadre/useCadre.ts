import { useEffect, useState, type MouseEvent } from "react";

/**
 * Un seul menu déroulant ouvert à la fois (`toggleUserMenu`, app.js l. 601) :
 * en ouvrir un referme les autres, et tout clic ailleurs dans la page les
 * referme tous.
 */
export function useMenuDeroulant() {
  const [ouvert, setOuvert] = useState<string | null>(null);
  useEffect(() => {
    if (!ouvert) return undefined;
    const fermer = () => setOuvert(null);
    document.addEventListener("click", fermer);
    return () => document.removeEventListener("click", fermer);
  }, [ouvert]);
  return {
    estOuvert: (id: string) => ouvert === id,
    ouvrir: (id: string) => (e: MouseEvent) => {
      // Le clic qui ouvre ne doit pas atteindre le document, qui refermerait aussitôt.
      e.stopPropagation();
      setOuvert(id);
    },
    fermer: () => setOuvert(null),
  };
}

/**
 * Les classes que l'ancien écran posait sur <body> (`sidebar-collapsed`,
 * `is-planning-view`, `role-technicien`…) : sa feuille s'y accroche, on les
 * pose donc au même endroit, et on les retire en quittant.
 */
export function useClassesDuCorps(classes: Readonly<Record<string, boolean>>): void {
  const cle = Object.entries(classes)
    .map(([c, actif]) => `${c}:${actif ? 1 : 0}`)
    .join(" ");
  useEffect(() => {
    const actives = cle
      .split(" ")
      .filter((x) => x.endsWith(":1"))
      .map((x) => x.slice(0, x.lastIndexOf(":")));
    document.body.classList.add(...actives);
    return () => document.body.classList.remove(...actives);
  }, [cle]);
}
