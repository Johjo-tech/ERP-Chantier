import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";

const LARGEUR = 500;
const HAUTEUR = 200;
const COULEUR_TRAIT = "#E23535";
const EPAISSEUR_TRAIT = 2.5;

interface Props {
  valeur: string | null;
  onChange: (image: string | null) => void;
  desactive?: boolean;
  libelle?: string;
  couleur?: string;
}

/**
 * Un croquis à main levée (souris, doigt, stylet), rendu en PNG — la colonne
 * `planning_taches.croquis` le garde en texte. Sert aussi de pavé de signature
 * dans les rapports d'intervention.
 */
export function Croquis({ valeur, onChange, desactive = false, libelle = "Croquis", couleur = COULEUR_TRAIT }: Props) {
  const toile = useRef<HTMLCanvasElement>(null);
  const trace = useRef<{ x: number; y: number } | null>(null);
  const initial = useRef(valeur);

  useEffect(() => {
    const ctx = toile.current?.getContext("2d");
    if (!ctx || !initial.current) return;
    const img = new Image();
    // Une image d'un autre domaine (lien signé du seau) « salirait » la toile : plus d'export possible.
    img.crossOrigin = "anonymous";
    img.onload = () => ctx.drawImage(img, 0, 0, LARGEUR, HAUTEUR);
    img.src = initial.current;
  }, []);

  const point = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: ((e.clientX - r.left) * LARGEUR) / (r.width || LARGEUR), y: ((e.clientY - r.top) * HAUTEUR) / (r.height || HAUTEUR) };
  };

  return (
    <div className="flex flex-col gap-1">
      <canvas
        ref={toile}
        role="img"
        aria-label={libelle}
        width={LARGEUR}
        height={HAUTEUR}
        className="w-full max-w-lg touch-none rounded-md border bg-white"
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
      {!desactive && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="self-start"
          onClick={() => {
            toile.current?.getContext("2d")?.clearRect(0, 0, LARGEUR, HAUTEUR);
            onChange(null);
          }}
        >
          Effacer
        </Button>
      )}
    </div>
  );
}
