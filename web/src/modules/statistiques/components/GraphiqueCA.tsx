import { useState, type FocusEvent, type MouseEvent } from "react";
import { ZERO, type Montant } from "@/lib/money";
import { formatEurosEcran, useModeDiscret } from "@/lib/modeDiscret";
import { partDuMax, type SerieCA } from "../domain/indicateurs";

/**
 * Le chiffre d'affaires HT mois par mois, face à l'année précédente — le
 * dessin de l'ancien écran (`renderYearlyComparisonSVG`) à la même géométrie :
 * 960 × 300, barres de 20 px au plus, l'année précédente en gris à 32 %, la
 * légende en haut à droite. Écrit à la main, sans bibliothèque (D-STA-03).
 *
 * Ce que l'ancien n'avait pas : chaque barre se parcourt aussi au clavier, et
 * le tableau équivalent est là pour les lecteurs d'écran — hors de la vue,
 * pour ne rien changer au dessin (D-VIS-07).
 */
const L = 960;
const H = 300;
const HAUT = 40;
const BAS = 34;
const COTE = 16;
const LARGEUR_BARRE_MAX = 20;
const ECART = 4;
/** La part d'un groupe qu'occupe chaque barre. */
const PART_BARRE = 0.32;
const OPACITE_PRECEDENTE = 0.32;
/** Une barre non nulle reste visible, même minuscule face au plus grand mois. */
const HAUTEUR_MIN = 2;
/** Sous l'axe : la ligne des mois. */
const DECALAGE_MOIS = 22;
/** La légende, calée à 230 px du bord droit et 10 px du haut. */
const LEGENDE = { droite: 230, haut: 10, ecartSerie: 75 } as const;
/** L'infobulle : 14 px à droite du pointeur, 44 au-dessus, et retournée à gauche près du bord (140 + 14). */
const BULLE = { dx: 14, dy: 44, largeur: 140, retour: 154, dessous: 18 } as const;

export const COULEUR_COURANTE = "var(--accent)";
const COULEUR_PRECEDENTE = "var(--text-dim)";

/** Une coordonnée d'attribut SVG, au dixième comme l'ancien écran (`toFixed(1)`). */
const c = (n: number) => n.toFixed(1);

interface Survol {
  left: number;
  top: number;
  libelle: string;
  montant: Montant;
}

export function GraphiqueCA({ serie }: { serie: SerieCA }) {
  useModeDiscret();
  const [survol, setSurvol] = useState<Survol | null>(null);
  const { points, anneeCourante, anneePrecedente } = serie;
  const max = points.reduce((m, p) => (p.courant.gt(m) ? p.courant : p.precedent.gt(m) ? p.precedent : m), ZERO);
  const largeurGroupe = (L - 2 * COTE) / Math.max(1, points.length);
  const barre = Math.min(LARGEUR_BARRE_MAX, largeurGroupe * PART_BARRE);
  const utile = H - HAUT - BAS;
  const hauteur = (m: Montant) => (m.gt(ZERO) ? Math.max(HAUTEUR_MIN, (utile * partDuMax(m, max)) / 100) : 0);

  /** `showRevenueTooltip` : la bulle suit le pointeur dans la carte. */
  const placer = (x: number, y: number, carte: DOMRect) => {
    let left = x - carte.left + BULLE.dx;
    let top = y - carte.top - BULLE.dy;
    if (left + BULLE.largeur > carte.width) left = x - carte.left - BULLE.retour;
    if (top < 0) top = y - carte.top + BULLE.dessous;
    return { left, top };
  };
  const carteDe = (e: MouseEvent<Element> | FocusEvent<Element>) => e.currentTarget.closest(".dash-revenue-card")?.getBoundingClientRect() ?? null;

  return (
    <>
      <svg viewBox={`0 0 ${L} ${H}`} style={{ width: "100%", height: "auto", display: "block" }} role="img" aria-label={`Chiffre d'affaires HT par mois, ${anneeCourante} comparé à ${anneePrecedente}. Le détail est dans le tableau qui suit.`}>
        {points.map((p, i) => {
          const centre = COTE + i * largeurGroupe + largeurGroupe / 2;
          const barres = [
            { cle: "precedent", x: centre - barre - ECART / 2, m: p.precedent, libelle: `${p.libelleLong} ${p.annee - 1}`, couleur: COULEUR_PRECEDENTE, opacite: OPACITE_PRECEDENTE },
            { cle: "courant", x: centre + ECART / 2, m: p.courant, libelle: `${p.libelleLong} ${p.annee}`, couleur: COULEUR_COURANTE, opacite: 1 },
          ];
          return (
            <g key={p.cle}>
              {barres.map((b) => {
                const h = hauteur(b.m);
                const montrer = (x: number, y: number, carte: DOMRect | null) => carte && setSurvol({ ...placer(x, y, carte), libelle: b.libelle, montant: b.m });
                return (
                  <g
                    key={b.cle}
                    tabIndex={0}
                    role="button"
                    aria-label={`${b.libelle} : ${formatEurosEcran(b.m)}`}
                    onFocus={(e) => {
                      const r = e.currentTarget.getBoundingClientRect();
                      montrer(r.left + r.width / 2, r.top, carteDe(e));
                    }}
                    onBlur={() => setSurvol(null)}
                    style={{ outline: "none" }}
                  >
                    <rect x={c(b.x)} y={HAUT} width={c(barre)} height={c(utile)} fill="transparent" style={{ cursor: "pointer" }} onMouseMove={(e) => montrer(e.clientX, e.clientY, carteDe(e))} onMouseLeave={() => setSurvol(null)} />
                    <rect x={c(b.x)} y={c(H - BAS - h)} width={c(barre)} height={c(h)} rx="3" fill={b.couleur} opacity={b.opacite === 1 ? undefined : b.opacite} pointerEvents="none" />
                  </g>
                );
              })}
              <text x={c(centre)} y={H - BAS + DECALAGE_MOIS} textAnchor="middle" fontSize="12.5" fill="var(--text-dim)">
                {p.libelle}
              </text>
            </g>
          );
        })}
        <g transform={`translate(${c(L - LEGENDE.droite)}, ${LEGENDE.haut})`} aria-hidden="true">
          <rect x="0" y="2" width="13" height="13" rx="3" fill="var(--accent)" />
          <text x="19" y="12.5" fontSize="13.5" fill="var(--text)">
            {anneeCourante}
          </text>
          <rect x={LEGENDE.ecartSerie} y="2" width="13" height="13" rx="3" fill="var(--text-dim)" opacity={OPACITE_PRECEDENTE} />
          <text x="94" y="12.5" fontSize="13.5" fill="var(--text)">
            {anneePrecedente}
          </text>
        </g>
      </svg>
      {survol && (
        <div id="revenueTooltip" role="status" style={{ display: "block", left: `${survol.left}px`, top: `${survol.top}px` }}>
          <b>{survol.libelle}</b>
          <br />
          {formatEurosEcran(survol.montant)}
        </div>
      )}
      <table className="sr-only">
        <caption>Chiffre d'affaires HT par mois</caption>
        <thead>
          <tr>
            <th scope="col">Mois</th>
            <th scope="col">{anneeCourante}</th>
            <th scope="col">{anneePrecedente}</th>
          </tr>
        </thead>
        <tbody>
          {points.map((p) => (
            <tr key={p.cle}>
              <td>{p.libelleLong}</td>
              <td>{formatEurosEcran(p.courant)}</td>
              <td>{formatEurosEcran(p.precedent)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
