import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialogue } from "@/modules/planning/components/Dialogue";
import { couleurAnnotation, fermerZone, OUTILS, pointeDeFleche, QUALITE_ANNOTATION, type Forme, type Outil, type Point } from "../domain/annotation";
import type { CategoriePhoto } from "../domain/rapport";

const EPAISSEUR_RELATIVE = 0.006;
const TAILLE_TEXTE_RELATIVE = 0.04;
const PAS_HACHURE_RELATIF = 0.02;

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
      const [g, d] = pointeDeFleche(f.de, f.a, trait * 5);
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
      ctx.font = `bold ${Math.max(14, l * TAILLE_TEXTE_RELATIVE)}px sans-serif`;
      ctx.fillText(f.texte, f.en.x, f.en.y);
    } else if (f.type === "zone") {
      chemin(f.points);
      ctx.closePath();
      ctx.stroke();
      ctx.save();
      ctx.clip();
      const pas = Math.max(8, l * PAS_HACHURE_RELATIF);
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

/** Annoter une photo sur place (PLN-10), à la souris comme au doigt. */
export function AnnotationPhoto({ image, categorie, onValider, onFermer }: Props) {
  const toile = useRef<HTMLCanvasElement>(null);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [outil, setOutil] = useState<Outil>("fleche");
  const [formes, setFormes] = useState<Forme[]>([]);
  const [zone, setZone] = useState<Point[]>([]);
  const [depart, setDepart] = useState<Point | null>(null);
  const [texte, setTexte] = useState("");
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

  return (
    <Dialogue
      titre="Annoter la photo"
      large
      onFermer={onFermer}
      actions={
        <>
          <Button variant="ghost" onClick={onFermer}>Annuler</Button>
          <Button disabled={!img} onClick={() => toile.current && onValider(toile.current.toDataURL("image/jpeg", QUALITE_ANNOTATION))}>Enregistrer l'annotation</Button>
        </>
      }
    >
      <div role="toolbar" aria-label="Outils d'annotation" className="flex flex-wrap gap-1">
        {OUTILS.map((o) => (
          <Button key={o.outil} size="sm" variant={o.outil === outil ? "default" : "outline"} aria-pressed={o.outil === outil} onClick={() => setOutil(o.outil)}>{o.libelle}</Button>
        ))}
        {outil === "zone" && <Button size="sm" variant="secondary" disabled={zone.length < 2} onClick={() => { setFormes(fermerZone(formes, zone)); setZone([]); }}>Fermer la zone</Button>}
        <Button size="sm" variant="ghost" disabled={!formes.length} onClick={() => setFormes(formes.slice(0, -1))}>Annuler le dernier tracé</Button>
      </div>
      {outil === "texte" && (
        <label className="flex items-center gap-2 text-sm">
          Texte à poser
          <Input value={texte} onChange={(e) => setTexte(e.target.value)} placeholder="Puis cliquez sur la photo" />
        </label>
      )}
      <p className="text-xs text-muted-foreground">{categorie === "preconisation" ? "Photo de préconisation : tracés en vert." : "Tracés en rouge (photo de constatation)."}</p>
      <canvas
        ref={toile}
        role="img"
        aria-label="Photo à annoter"
        className="w-full touch-none rounded-md border"
        onPointerDown={(e) => {
          const p = point(e);
          if (outil === "zone") setZone([...zone, p]);
          else if (outil === "texte") {
            if (texte.trim()) setFormes([...formes, { type: "texte", en: p, texte: texte.trim() }]);
          } else setDepart(p);
        }}
        onPointerUp={(e) => {
          if (!depart || (outil !== "fleche" && outil !== "carre" && outil !== "cercle")) return;
          setFormes([...formes, { type: outil, de: depart, a: point(e) }]);
          setDepart(null);
        }}
      />
    </Dialogue>
  );
}
