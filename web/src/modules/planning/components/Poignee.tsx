import { useEffect, useRef, useState } from "react";
import { HEURES_PLANNING } from "../domain/calendrier";

/** La hauteur d'une case d'une heure, en pixels : fixe, pour que la poignée convertisse sans mesurer. */
export const HAUTEUR_CASE = 48;
/** Une case se prend dès qu'on en a franchi la moitié, dans un sens comme dans l'autre. */
const DEMI_CASE = 0.5;

interface Props {
  casesDepart: number;
  indiceDebut: number;
  /** Étendre aussi sur d'autres jours (le jour du rendez-vous), ou seulement allonger (une journée à part). */
  horizontal: boolean;
  onApercu: (cases: number | null) => void;
  onFin: (cases: number, jour: string | null) => void;
}

/**
 * La poignée d'une carte posée (PLN-05) : tirer vers le bas allonge d'une case
 * par heure, vers une autre colonne étend jusqu'à ce jour. Échap annule, comme
 * dans l'ancien planning. Les mêmes réglages restent accessibles au clavier
 * (durée, date de fin) : la poignée n'est qu'un raccourci.
 */
export function Poignee({ casesDepart, indiceDebut, horizontal, onApercu, onFin }: Props) {
  const [actif, setActif] = useState(false);
  const depart = useRef({ y: 0, cases: casesDepart, jour: null as string | null });
  const rappels = useRef({ onApercu, onFin });
  useEffect(() => {
    rappels.current = { onApercu, onFin };
  });

  useEffect(() => {
    if (!actif) return;
    const maxCases = HEURES_PLANNING.length - indiceDebut;
    const casesPour = (y: number) => Math.min(maxCases, Math.max(1, depart.current.cases + Math.trunc((y - depart.current.y) / HAUTEUR_CASE + Math.sign(y - depart.current.y) * DEMI_CASE)));
    const jourSous = (x: number, y: number) => (horizontal ? (document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-jour]")?.dataset.jour ?? null) : null);
    const bouger = (e: PointerEvent) => {
      depart.current.jour = jourSous(e.clientX, e.clientY) ?? depart.current.jour;
      rappels.current.onApercu(casesPour(e.clientY));
    };
    const lacher = (e: PointerEvent) => {
      setActif(false);
      rappels.current.onApercu(null);
      rappels.current.onFin(casesPour(e.clientY), jourSous(e.clientX, e.clientY) ?? depart.current.jour);
    };
    const touche = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setActif(false);
      rappels.current.onApercu(null);
    };
    document.addEventListener("pointermove", bouger);
    document.addEventListener("pointerup", lacher);
    document.addEventListener("keydown", touche);
    return () => {
      document.removeEventListener("pointermove", bouger);
      document.removeEventListener("pointerup", lacher);
      document.removeEventListener("keydown", touche);
    };
  }, [actif, horizontal, indiceDebut]);

  return (
    <div
      aria-hidden="true"
      title="Glisser pour ajuster la durée (et étendre sur d'autres jours) — Échap annule"
      className="absolute bottom-0 right-0 h-3 w-3 cursor-nwse-resize rounded-tl bg-primary/60 print:hidden"
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
        depart.current = { y: e.clientY, cases: casesDepart, jour: null };
        setActif(true);
      }}
    />
  );
}
