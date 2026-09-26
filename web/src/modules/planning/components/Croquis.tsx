import { useEffect, useRef, type CSSProperties } from "react";

const COULEUR_TRAIT = "#E23535";
const EPAISSEUR_TRAIT = 2.5;

interface Props {
  valeur: string | null;
  onChange: (image: string | null) => void;
  desactive?: boolean;
  libelle?: string;
  couleur?: string;
  /** L'identifiant de l'ancienne toile, auquel sa feuille s'accroche (`#sigCanvas`, `#sigCanvasTech`). */
  id?: string;
  /** La toile de l'ancien écran : 540 × 280 pour le croquis de la fiche, 500 × 150 pour une signature. */
  largeur: number;
  hauteur: number;
  style?: CSSProperties;
  /** Un cadre autour de la toile (`.sig-wrap` des signatures). */
  enveloppe?: string;
  effacer: { libelle: string; classe: string; style?: CSSProperties };
}

/**
 * Un croquis à main levée (souris, doigt, stylet), rendu en PNG — la colonne
 * `planning_taches.croquis` le garde en texte. Sert aussi de pavé de signature
 * dans les rapports d'intervention. Le trait et son épaisseur sont ceux de
 * l'ancien (`setupTechDessinCanvas`).
 */
export function Croquis({ id, valeur, onChange, desactive = false, libelle = "Croquis", couleur = COULEUR_TRAIT, largeur, hauteur, style, enveloppe, effacer }: Props) {
  const toile = useRef<HTMLCanvasElement>(null);
  const trace = useRef<{ x: number; y: number } | null>(null);
  const initial = useRef(valeur);

  useEffect(() => {
    const ctx = toile.current?.getContext("2d");
    if (!ctx || !initial.current) return;
    const img = new Image();
    // Une image d'un autre domaine (lien signé du seau) « salirait » la toile : plus d'export possible.
    img.crossOrigin = "anonymous";
    img.onload = () => ctx.drawImage(img, 0, 0, largeur, hauteur);
    img.src = initial.current;
  }, [largeur, hauteur]);

  const point = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: ((e.clientX - r.left) * largeur) / (r.width || largeur), y: ((e.clientY - r.top) * hauteur) / (r.height || hauteur) };
  };

  const canvas = (
    <canvas
      ref={toile}
      id={id}
      role="img"
      aria-label={libelle}
      width={largeur}
      height={hauteur}
      style={style}
      onPointerDown={(e) => {
        if (desactive) return;
        e.currentTarget.setPointerCapture?.(e.pointerId);
        trace.current = point(e);
      }}
      onPointerMove={(e) => {
        const ctx = e.currentTarget.getContext("2d");
        if (!trace.current || !ctx) return;
        const p = point(e);
        ctx.strokeStyle = couleur;
        ctx.lineWidth = EPAISSEUR_TRAIT;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(trace.current.x, trace.current.y);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
        trace.current = p;
      }}
      onPointerUp={(e) => {
        if (!trace.current) return;
        trace.current = null;
        onChange(e.currentTarget.toDataURL("image/png"));
      }}
    />
  );
  return (
    <>
      {enveloppe ? <div className={enveloppe}>{canvas}</div> : canvas}
      <button
        type="button"
        className={effacer.classe}
        style={effacer.style}
        disabled={desactive}
        onClick={() => {
          toile.current?.getContext("2d")?.clearRect(0, 0, largeur, hauteur);
          onChange(null);
        }}
      >
        {effacer.libelle}
      </button>
    </>
  );
}
