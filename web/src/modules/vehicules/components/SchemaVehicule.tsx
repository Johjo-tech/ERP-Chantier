import { useId, useState, type MouseEvent } from "react";
import { HAUTEUR_SCHEMA, LARGEUR_SCHEMA, marqueDepuisClic, ZONES_SCHEMA, type Marque } from "../domain/schema-vehicule";

interface Props {
  /** Ce que le schéma relève, dit aux lecteurs d'écran (l'ancien le disait dans la phrase au-dessus). */
  titre: string;
  marques: readonly Marque[];
  /** Absent : schéma en lecture seule. */
  onChange?: (marques: Marque[]) => void;
}

/** Coin haut-gauche des quatre roues, dans le repère 220 × 420 de la silhouette. */
const ROUES = [[14, 70], [192, 70], [14, 300], [192, 300]] as const;
const TRAIT = "#8a93a3";
const VITRE = "#dbe1ea";

/**
 * Le schéma de `vehiculeSchemaHTML` (app.js l. 15359), mêmes couleurs, même
 * `.vehicule-schema-wrap` : un clic pose une croix rouge, « Effacer les
 * marques » dessous. Au clavier, une zone nommée se choisit (D-VEH-02) — ces
 * contrôles sont réservés aux lecteurs d'écran et au clavier (`.sr-only`),
 * pour ne rien ajouter à l'écran de l'ancien (D-ECR-PAR-03).
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
    <div className="vehicule-schema-wrap">
      <svg
        viewBox={`0 0 ${LARGEUR_SCHEMA} ${HAUTEUR_SCHEMA}`}
        className="vehicule-schema-svg"
        style={{ cursor: modifiable ? "crosshair" : "default" }}
        role="img"
        aria-label={`${titre} — ${resume}`}
        onClick={cliquer}
      >
        <rect x="30" y="20" width="160" height="380" rx="35" fill="#f0f2f6" stroke={TRAIT} strokeWidth="2" />
        <rect x="45" y="55" width="130" height="70" rx="8" fill={VITRE} stroke={TRAIT} strokeWidth="1.5" />
        <rect x="45" y="300" width="130" height="55" rx="8" fill={VITRE} stroke={TRAIT} strokeWidth="1.5" />
        <line x1="30" y1="145" x2="190" y2="145" stroke={TRAIT} strokeWidth="1.5" />
        <line x1="30" y1="280" x2="190" y2="280" stroke={TRAIT} strokeWidth="1.5" />
        <line x1="110" y1="145" x2="110" y2="280" stroke="#c3c9d3" strokeWidth="1" />
        {ROUES.map(([x, y]) => (
          <rect key={`${x}-${y}`} x={x} y={y} width="14" height="45" rx="4" fill="#5a6472" />
        ))}
        <text x="110" y="15" textAnchor="middle" fontSize="12" fill={TRAIT}>
          AVANT
        </text>
        <text x="110" y="412" textAnchor="middle" fontSize="12" fill={TRAIT}>
          ARRIÈRE
        </text>
        {marques.map((m, i) => (
          <text key={i} x={m.x} y={m.y} textAnchor="middle" dominantBaseline="middle" fontSize="22" fontWeight="800" fill="#E23535">
            ✕
          </text>
        ))}
      </svg>
      {onChange && (
        <>
          <span className="sr-only">
            <label htmlFor={idZone}>Zone de la marque</label>
            <select id={idZone} value={zone} onChange={(e) => setZone(Number(e.target.value))}>
              {ZONES_SCHEMA.map((z, i) => (
                <option key={z.libelle} value={i}>
                  {z.libelle}
                </option>
              ))}
            </select>
            <button type="button" onClick={() => ZONES_SCHEMA[zone] && onChange([...marques, ZONES_SCHEMA[zone].marque])}>
              Marquer cette zone
            </button>
          </span>
          <button type="button" className="btn small ghost" style={{ marginTop: "6px" }} onClick={() => onChange([])}>
            Effacer les marques
          </button>
        </>
      )}
    </div>
  );
}
