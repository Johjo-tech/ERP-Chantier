import { useEffect, useRef, useState } from "react";
import { HEURES_PLANNING } from "../domain/calendrier";

/** Une case se prend dès qu'on en a franchi la moitié, dans un sens comme dans l'autre. */
const DEMI_CASE = 0.5;

interface Props {
  casesDepart: number;
  indiceDebut: number;
  /** Étendre aussi sur d'autres jours (le jour du rendez-vous), ou seulement allonger (une journée à part). */
  horizontal: boolean;
  /** Une journée supplémentaire ne fait que s'allonger : l'infobulle le dit. */
  journeeSeule: boolean;
  onApercu: (cases: number | null) => void;
  onFin: (cases: number, jour: string | null) => void;
}

/** La case suit la hauteur de la fenêtre (`planningRowExpr`) : on la mesure au moment de tirer. */
function hauteurCase(depuis: Element): number {
  const grille = depuis.closest(".planning-day-grid");
  return grille ? grille.getBoundingClientRect().height / HEURES_PLANNING.length : 1;
}

/**
 * La poignée d'angle d'une carte posée (`startResizeCorner`, PLN-05) : tirer
 * vers le bas allonge d'une case par heure, vers une autre colonne étend
 * jusqu'à ce jour. Échap annule, comme dans l'ancien planning. Les mêmes
 * réglages restent au clavier (durée, date de fin) : la poignée n'est qu'un
 * raccourci.
 */
export function Poignee({ casesDepart, indiceDebut, horizontal, journeeSeule, onApercu, onFin }: Props) {
  const [actif, setActif] = useState(false);
  const moi = useRef<HTMLDivElement>(null);
  const depart = useRef({ y: 0, cases: casesDepart, jour: null as string | null, hauteur: 1 });
  const rappels = useRef({ onApercu, onFin });
  useEffect(() => {
    rappels.current = { onApercu, onFin };
  });

  useEffect(() => {
    if (!actif) return;
    const carte = moi.current?.closest(".planning-card-scheduled");
    carte?.classList.add("is-resize-active");
    document.body.classList.add("is-resizing-corner");
    let cible: Element | null = null;
    const maxCases = HEURES_PLANNING.length - indiceDebut;
    const casesPour = (y: number) => {
      const ecart = (y - depart.current.y) / depart.current.hauteur;
      return Math.min(maxCases, Math.max(1, depart.current.cases + Math.trunc(ecart + Math.sign(ecart) * DEMI_CASE)));
    };
    const colonneSous = (x: number, y: number) => (horizontal ? (document.elementFromPoint(x, y)?.closest<HTMLElement>(".planning-daycol[data-iso]") ?? null) : null);
    const surligner = (col: Element | null) => {
      if (col === cible) return;
      cible?.classList.remove("is-resize-target");
      col?.classList.add("is-resize-target");
      cible = col;
    };
    const bouger = (e: PointerEvent) => {
      const col = colonneSous(e.clientX, e.clientY);
      if (col) depart.current.jour = col.dataset.iso ?? depart.current.jour;
      surligner(col);
      rappels.current.onApercu(casesPour(e.clientY));
    };
    const lacher = (e: PointerEvent) => {
      setActif(false);
      rappels.current.onApercu(null);
      rappels.current.onFin(casesPour(e.clientY), colonneSous(e.clientX, e.clientY)?.dataset.iso ?? depart.current.jour);
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
      carte?.classList.remove("is-resize-active");
      document.body.classList.remove("is-resizing-corner");
      surligner(null);
      document.removeEventListener("pointermove", bouger);
      document.removeEventListener("pointerup", lacher);
      document.removeEventListener("keydown", touche);
    };
  }, [actif, horizontal, indiceDebut]);

  return (
    <div
      ref={moi}
      aria-hidden="true"
      draggable={false}
      className="planning-resize-corner planning-resize-corner-big"
      title={!journeeSeule ? "Glisser pour ajuster la durée et/ou étendre sur d'autres jours" : "Glisser vers le bas pour allonger le créneau — une case par heure"}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
        depart.current = { y: e.clientY, cases: casesDepart, jour: null, hauteur: hauteurCase(e.currentTarget) };
        setActif(true);
      }}
    />
  );
}
