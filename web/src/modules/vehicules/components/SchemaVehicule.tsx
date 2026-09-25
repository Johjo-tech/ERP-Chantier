import { useId, useState, type MouseEvent } from "react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { HAUTEUR_SCHEMA, LARGEUR_SCHEMA, marqueDepuisClic, ZONES_SCHEMA, type Marque } from "../domain/schema-vehicule";

interface Props {
  titre: string;
  marques: readonly Marque[];
  /** Absent : schéma en lecture seule. */
  onChange?: (marques: Marque[]) => void;
}

/** La silhouette de l'ancien écran (app.js l. 15283), vue de dessus, avant en haut. */
function Silhouette() {
  return (
    <>
      <rect x="30" y="20" width="160" height="380" rx="35" className="fill-muted stroke-muted-foreground" strokeWidth="2" />
      <rect x="45" y="55" width="130" height="70" rx="8" className="fill-background stroke-muted-foreground" strokeWidth="1.5" />
      <rect x="45" y="300" width="130" height="55" rx="8" className="fill-background stroke-muted-foreground" strokeWidth="1.5" />
      <line x1="30" y1="145" x2="190" y2="145" className="stroke-muted-foreground" strokeWidth="1.5" />
      <line x1="30" y1="280" x2="190" y2="280" className="stroke-muted-foreground" strokeWidth="1.5" />
      <line x1="110" y1="145" x2="110" y2="280" className="stroke-border" strokeWidth="1" />
      {[[14, 70], [192, 70], [14, 300], [192, 300]].map(([x, y]) => (
        <rect key={`${x}-${y}`} x={x} y={y} width="14" height="45" rx="4" className="fill-foreground/70" />
      ))}
      <text x="110" y="15" textAnchor="middle" fontSize="12" className="fill-muted-foreground">AVANT</text>
      <text x="110" y="412" textAnchor="middle" fontSize="12" className="fill-muted-foreground">ARRIÈRE</text>
    </>
  );
}

/**
 * Relever rayures et chocs : un clic sur le dessin pose une croix. Au clavier,
 * on choisit une zone nommée — sans quoi le relevé serait réservé à la souris.
 */
export function SchemaVehicule({ titre, marques, onChange }: Props) {
  const idZone = useId();
  const [zone, setZone] = useState(0);
  const modifiable = !!onChange;

  function cliquer(e: MouseEvent<SVGSVGElement>) {
    if (!onChange) return;
    const m = marqueDepuisClic({ x: e.clientX, y: e.clientY }, e.currentTarget.getBoundingClientRect());
    if (m) onChange([...marques, m]);
  }

  const resume = marques.length ? `${marques.length} marque(s) relevée(s)` : "Aucune marque relevée";
  return (
    <figure className="flex flex-col gap-2">
      <figcaption className="text-xs text-muted-foreground">{titre}</figcaption>
      <svg
        viewBox={`0 0 ${LARGEUR_SCHEMA} ${HAUTEUR_SCHEMA}`}
        className={`h-64 w-auto self-start ${modifiable ? "cursor-crosshair" : ""}`}
        role="img"
        aria-label={`${titre} — ${resume}`}
        onClick={cliquer}
      >
        <Silhouette />
        {marques.map((m, i) => (
          <text key={i} x={m.x} y={m.y} textAnchor="middle" dominantBaseline="middle" fontSize="22" fontWeight="800" className="fill-destructive">
            ✕
          </text>
        ))}
      </svg>
      <p className="text-xs" aria-live="polite">{resume}</p>
      {modifiable && (
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor={idZone} className="sr-only">Zone de la marque</label>
          <Select id={idZone} className="h-8 w-44 text-xs" value={zone} onChange={(e) => setZone(Number(e.target.value))}>
            {ZONES_SCHEMA.map((z, i) => (
              <option key={z.libelle} value={i}>{z.libelle}</option>
            ))}
          </Select>
          <Button type="button" size="sm" variant="outline" onClick={() => ZONES_SCHEMA[zone] && onChange([...marques, ZONES_SCHEMA[zone].marque])}>
            Marquer cette zone
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => onChange(marques.slice(0, -1))} disabled={!marques.length}>
            Retirer la dernière
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => onChange([])} disabled={!marques.length}>
            Effacer les marques
          </Button>
        </div>
      )}
    </figure>
  );
}
