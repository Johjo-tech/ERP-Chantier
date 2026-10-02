import { useEffect, useRef, useState, type KeyboardEvent } from "react";

/**
 * Le redessin différé des listes (TRV-06, `redessinerApresFrappe`, app.js
 * l. 5585) : la saisie s'affiche à chaque frappe, mais la recherche ne
 * s'applique qu'après une pause — sur un millier de bons, refiltrer à chaque
 * lettre fige la saisie.
 */
export const DELAI_FILTRAGE_MS = 300;

/**
 * `appliquee` est la recherche en vigueur (état de la page, ou de l'adresse) ;
 * `appliquer` la remplace. La saisie locale la rattrape après le délai.
 */
export function useRechercheDifferee(appliquee: string, appliquer: (q: string) => void, delai = DELAI_FILTRAGE_MS) {
  const [saisie, setSaisieLocale] = useState(appliquee);
  const minuteur = useRef<ReturnType<typeof setTimeout> | null>(null);
  const annuler = () => {
    if (minuteur.current) clearTimeout(minuteur.current);
    minuteur.current = null;
  };
  useEffect(() => annuler, []);
  const setSaisie = (v: string) => {
    setSaisieLocale(v);
    annuler();
    minuteur.current = setTimeout(() => {
      minuteur.current = null;
      appliquer(v);
    }, delai);
  };
  /** Entrée : on n'attend pas la fin du délai. */
  const appliquerMaintenant = () => {
    annuler();
    appliquer(saisie);
  };
  return { saisie, setSaisie, appliquerMaintenant, enAttente: saisie !== appliquee };
}

/**
 * « Entrée fait défiler les résultats » (`searchEnterCycle`) : chaque appui
 * amène le résultat suivant au centre de l'écran et le met en évidence ; une
 * nouvelle requête repart du premier. Une frappe encore en attente : Entrée
 * applique d'abord la recherche, le défilement suit à l'appui suivant.
 */
export function useEntreeDefile(prefixe: string, ids: readonly string[], requete: string, recherche?: { enAttente: boolean; appliquerMaintenant: () => void }) {
  const curseur = useRef<{ requete: string; index: number } | null>(null);
  const [enEvidence, setEnEvidence] = useState<string | null>(null);
  const idDomDe = (id: string) => `${prefixe}-${id}`;

  function surTouche(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    if (recherche?.enAttente) return recherche.appliquerMaintenant();
    if (!ids.length) return;
    const c = curseur.current;
    const index = c && c.requete === requete ? (c.index + 1) % ids.length : 0;
    curseur.current = { requete, index };
    const id = ids[index] as string;
    setEnEvidence(id);
    // jsdom n'implémente pas le défilement : sa présence n'est pas garantie.
    document.getElementById(idDomDe(id))?.scrollIntoView?.({ behavior: "smooth", block: "center" });
  }

  return { surTouche, enEvidence: requete.trim() ? enEvidence : null, idDomDe };
}

/** La classe du résultat mis en évidence par Entrée. */
export const CLASSE_EN_EVIDENCE = "bg-primary/10 ring-2 ring-inset ring-primary";
