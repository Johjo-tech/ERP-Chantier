import { useEffect, useId, useRef, useState } from "react";
import { couleurAnnotation, fermerZone, pointeDeFleche, QUALITE_ANNOTATION, type Forme, type Outil, type Point } from "../domain/annotation";
import type { CategoriePhoto } from "../domain/rapport";

/** Les outils et leurs libellés, tels que la fenêtre `photoAnnotationModal` les montre. */
const BOUTONS_OUTILS: readonly [Outil, string][] = [
  ["fleche", "➡️ Flèche"],
  ["carre", "⬜ Carré"],
  ["cercle", "⭕ Cercle"],
  ["texte", "🔤 Texte"],
  ["zone", "🟨 Zone chantier"],
];

const EPAISSEUR_RELATIVE = 0.006;
const TAILLE_TEXTE_RELATIVE = 0.04;
const PAS_HACHURE_RELATIF = 0.02;
/** Planchers en pixels : sur une petite photo, la proportion seule rendrait texte et hachures illisibles. */
const TAILLE_TEXTE_MIN_PX = 14;
const PAS_HACHURE_MIN_PX = 8;
/** La pointe d'une flèche mesure cinq épaisseurs de trait. */
const POINTE_EN_TRAITS = 5;

function dessiner(ctx: CanvasRenderingContext2D, image: HTMLImageElement, formes: readonly Forme[], enCours: readonly Point[], couleur: string) {
  const { width: l, height: h } = ctx.canvas;
  ctx.clearRect(0, 0, l, h);
  ctx.drawImage(image, 0, 0, l, h);
  const trait = Math.max(2, l * EPAISSEUR_RELATIVE);
  ctx.strokeStyle = couleur;
  ctx.fillStyle = couleur;
  ctx.lineWidth = trait;
  ctx.lineCap = "round";
  const chemin = (points: readonly Point[]) => {
    ctx.beginPath();
    points.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  };
  for (const f of formes) {
    if (f.type === "fleche") {
      const [g, d] = pointeDeFleche(f.de, f.a, trait * POINTE_EN_TRAITS);
      chemin([f.de, f.a]);
      ctx.stroke();
      chemin([g, f.a, d]);
      ctx.stroke();
    } else if (f.type === "carre") ctx.strokeRect(f.de.x, f.de.y, f.a.x - f.de.x, f.a.y - f.de.y);
    else if (f.type === "cercle") {
      ctx.beginPath();
      ctx.ellipse((f.de.x + f.a.x) / 2, (f.de.y + f.a.y) / 2, Math.abs(f.a.x - f.de.x) / 2, Math.abs(f.a.y - f.de.y) / 2, 0, 0, 2 * Math.PI);
      ctx.stroke();
    } else if (f.type === "texte") {
      ctx.font = `bold ${Math.max(TAILLE_TEXTE_MIN_PX, l * TAILLE_TEXTE_RELATIVE)}px sans-serif`;
      ctx.fillText(f.texte, f.en.x, f.en.y);
    } else if (f.type === "zone") {
      chemin(f.points);
      ctx.closePath();
      ctx.stroke();
      ctx.save();
      ctx.clip();
      const pas = Math.max(PAS_HACHURE_MIN_PX, l * PAS_HACHURE_RELATIF);
      ctx.lineWidth = trait / 2;
      for (let x = -h; x < l; x += pas) {
        chemin([{ x, y: h }, { x: x + h, y: 0 }]);
        ctx.stroke();
      }
      ctx.restore();
    }
  }
  if (enCours.length) {
    chemin(enCours);
    ctx.stroke();
  }
}

interface Props {
  image: string;
  categorie: CategoriePhoto | null;
  onValider: (dataUrl: string) => void;
  onFermer: () => void;
}

/** Annoter une photo sur place (PLN-10, `photoAnnotationModal`), à la souris comme au doigt. */
export function AnnotationPhoto({ image, categorie, onValider, onFermer }: Props) {
  const toile = useRef<HTMLCanvasElement>(null);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [outil, setOutil] = useState<Outil>("fleche");
  const [formes, setFormes] = useState<Forme[]>([]);
  const [zone, setZone] = useState<Point[]>([]);
  const [depart, setDepart] = useState<Point | null>(null);
  const idTitre = useId();
  const couleur = couleurAnnotation(categorie);

  useEffect(() => {
    const i = new Image();
    i.crossOrigin = "anonymous";
    i.onload = () => {
      if (toile.current) {
        toile.current.width = i.naturalWidth;
        toile.current.height = i.naturalHeight;
      }
      setImg(i);
    };
    i.src = image;
  }, [image]);

  useEffect(() => {
    const ctx = toile.current?.getContext("2d");
    if (ctx && img) dessiner(ctx, img, formes, zone, couleur);
  }, [img, formes, zone, couleur]);

  const point = (e: React.PointerEvent<HTMLCanvasElement>): Point => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: ((e.clientX - r.left) * e.currentTarget.width) / (r.width || 1), y: ((e.clientY - r.top) * e.currentTarget.height) / (r.height || 1) };
  };

  const choisir = (o: Outil) => {
    // Changer d'outil en plein tracé de zone l'annulerait : l'ancien le demandait d'abord.
    if (outil === "zone" && o !== "zone" && zone.length && !window.confirm("Une zone est en cours de tracé. Changer d'outil l'annulera. Continuer ?")) return;
    if (o !== "zone") setZone([]);
    setOutil(o);
  };
  const terminerZone = () => {
    setFormes(fermerZone(formes, zone));
    setZone([]);
  };

  return (
    <div className="view-modal open" role="dialog" aria-modal="true" aria-labelledby={idTitre} style={{ display: "flex" }}>
      <div className="view-modal-panel" style={{ maxWidth: "640px" }}>
        <button type="button" className="view-modal-close" aria-label="Fermer" onClick={onFermer}>✕</button>
        <h3 id={idTitre} style={{ marginTop: 0 }}>Annoter la photo</h3>
        <p className="card-sub">Choisissez un outil, puis cliquez-glissez sur la photo pour placer une flèche ou un carré.</p>
        <div role="toolbar" aria-label="Outils d'annotation" style={{ display: "flex", gap: "8px", marginBottom: "10px", flexWrap: "wrap" }}>
          {BOUTONS_OUTILS.map(([o, libelle]) => (
            <button key={o} type="button" className={`btn small${o === outil ? " primary" : ""}`} aria-pressed={o === outil} onClick={() => choisir(o)}>{libelle}</button>
          ))}
          <button type="button" className="btn small ghost" onClick={terminerZone} style={{ display: outil === "zone" && zone.length >= 2 ? "inline-flex" : "none" }}>✓ Terminer la zone</button>
          <button type="button" className="btn small ghost" onClick={() => setFormes(formes.slice(0, -1))}>↩ Annuler le dernier</button>
          <button type="button" className="btn small ghost" onClick={() => (setFormes([]), setZone([]))}>Tout effacer</button>
        </div>
        <p className="card-sub" style={{ display: outil === "zone" ? "block" : "none" }}>Cliquez pour poser chaque coin de la zone (autant que vous voulez), puis double-cliquez ou "Terminer la zone".</p>
        <canvas
          ref={toile}
          role="img"
          aria-label={categorie === "preconisation" ? "Photo à annoter (tracés en vert)" : "Photo à annoter (tracés en rouge)"}
          style={{ width: "100%", touchAction: "none", border: "1px solid var(--border)", borderRadius: "10px", cursor: "crosshair" }}
          onDoubleClick={() => outil === "zone" && terminerZone()}
          onPointerDown={(e) => {
            const p = point(e);
            if (outil === "zone") setZone([...zone, p]);
            else if (outil === "texte") {
              const texte = window.prompt("Texte à afficher sur la photo :");
              if (texte && texte.trim()) setFormes([...formes, { type: "texte", en: p, texte: texte.trim() }]);
            } else setDepart(p);
          }}
          onPointerUp={(e) => {
            if (!depart || (outil !== "fleche" && outil !== "carre" && outil !== "cercle")) return;
            setFormes([...formes, { type: outil, de: depart, a: point(e) }]);
            setDepart(null);
          }}
        />
        <div style={{ display: "flex", gap: "10px", marginTop: "14px" }}>
          <button type="button" className="btn primary" disabled={!img} onClick={() => toile.current && onValider(toile.current.toDataURL("image/jpeg", QUALITE_ANNOTATION))}>✓ Enregistrer</button>
          <button type="button" className="btn ghost" onClick={onFermer}>Annuler</button>
        </div>
      </div>
    </div>
  );
}
