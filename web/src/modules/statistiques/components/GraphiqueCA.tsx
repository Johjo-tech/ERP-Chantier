import { useState } from "react";
import { Table, TBody, Td, Th, THead, Tr } from "@/components/ui/table";
import { ZERO, type Montant } from "@/lib/money";
import { formatEurosEcran } from "@/lib/modeDiscret";
import { partDuMax, type SerieCA } from "../domain/indicateurs";

/**
 * Le chiffre d'affaires HT mois par mois, face à l'année précédente
 * (`renderYearlyComparisonSVG`). Dessiné à la main en SVG : pas de
 * bibliothèque de graphiques à embarquer ni à surveiller (D-STA-03).
 *
 * L'année en cours prend la couleur de la société quand elle est posée
 * (`--color-accent-societe`), l'année précédente reste en retrait. Chaque
 * barre se survole ET se parcourt au clavier ; le tableau équivalent est
 * toujours disponible.
 */
const L = 960;
const H = 280;
const HAUT = 16;
const BAS = 30;
const COTE = 12;
const LARGEUR_BARRE_MAX = 22;
const ECART = 4;
/** Une barre non nulle reste visible, même minuscule face au plus grand mois. */
const HAUTEUR_MIN = 2;

export const COULEUR_COURANTE = "var(--color-accent-societe, var(--color-primary))";
const COULEUR_PRECEDENTE = "var(--color-muted-foreground)";

interface Survol {
  x: number;
  libelle: string;
  montant: Montant;
}

export function GraphiqueCA({ serie }: { serie: SerieCA }) {
  const [survol, setSurvol] = useState<Survol | null>(null);
  const { points, anneeCourante, anneePrecedente } = serie;
  const max = points.reduce((m, p) => (p.courant.gt(m) ? p.courant : p.precedent.gt(m) ? p.precedent : m), ZERO);
  const largeurGroupe = (L - 2 * COTE) / Math.max(1, points.length);
  const barre = Math.min(LARGEUR_BARRE_MAX, largeurGroupe * 0.32);
  const utile = H - HAUT - BAS;
  const hauteur = (m: Montant) => (m.gt(ZERO) ? Math.max(HAUTEUR_MIN, (utile * partDuMax(m, max)) / 100) : 0);

  return (
    <figure className="flex flex-col gap-2">
      <figcaption className="flex flex-wrap items-center gap-4 text-sm">
        <span className="flex items-center gap-1.5"><span aria-hidden="true" className="inline-block h-3 w-3 rounded-sm" style={{ background: COULEUR_COURANTE }} />{anneeCourante}</span>
        <span className="flex items-center gap-1.5"><span aria-hidden="true" className="inline-block h-3 w-3 rounded-sm opacity-40" style={{ background: COULEUR_PRECEDENTE }} />{anneePrecedente}</span>
      </figcaption>
      <div className="relative">
        <svg viewBox={`0 0 ${L} ${H}`} className="block h-auto w-full" role="img" aria-label={`Chiffre d'affaires HT par mois, ${anneeCourante} comparé à ${anneePrecedente}. Le détail est dans le tableau.`}>
          <line x1={COTE} x2={L - COTE} y1={H - BAS} y2={H - BAS} stroke="var(--color-border)" />
          {points.map((p, i) => {
            const centre = COTE + i * largeurGroupe + largeurGroupe / 2;
            const barres = [
              { cle: "precedent", x: centre - barre - ECART / 2, m: p.precedent, libelle: `${p.libelleLong} ${p.annee - 1}`, couleur: COULEUR_PRECEDENTE, opacite: 0.35 },
              { cle: "courant", x: centre + ECART / 2, m: p.courant, libelle: `${p.libelleLong} ${p.annee}`, couleur: COULEUR_COURANTE, opacite: 1 },
            ];
            return (
              <g key={p.cle}>
                {barres.map((b) => {
                  const h = hauteur(b.m);
                  const montrer = () => setSurvol({ x: ((b.x + barre / 2) / L) * 100, libelle: b.libelle, montant: b.m });
                  return (
                    <g key={b.cle} tabIndex={0} role="button" aria-label={`${b.libelle} : ${formatEurosEcran(b.m)}`} onMouseEnter={montrer} onFocus={montrer} onMouseLeave={() => setSurvol(null)} onBlur={() => setSurvol(null)} className="cursor-default focus:outline-none">
                      {/* Zone de survol plus grande que la barre : on vise la colonne, pas le trait. */}
                      <rect x={b.x} y={HAUT} width={barre} height={utile} fill="transparent" />
                      {h > 0 && <rect x={b.x} y={H - BAS - h} width={barre} height={h} rx={3} fill={b.couleur} opacity={b.opacite} />}
                    </g>
                  );
                })}
                <text x={centre} y={H - BAS + 20} textAnchor="middle" fontSize="13" fill="var(--color-muted-foreground)">{p.libelle}</text>
              </g>
            );
          })}
        </svg>
        {survol && (
          <div role="status" className="pointer-events-none absolute top-0 -translate-x-1/2 rounded-md border border-border bg-card px-2 py-1 text-xs shadow" style={{ left: `${survol.x}%` }}>
            <b className="capitalize">{survol.libelle}</b>
            <br />
            {formatEurosEcran(survol.montant)}
          </div>
        )}
      </div>
      <details className="text-sm">
        <summary className="cursor-pointer text-muted-foreground">Voir en tableau</summary>
        <Table>
          <THead>
            <Tr><Th>Mois</Th><Th className="text-right">{anneeCourante}</Th><Th className="text-right">{anneePrecedente}</Th></Tr>
          </THead>
          <TBody>
            {points.map((p) => (
              <Tr key={p.cle}><Td className="capitalize">{p.libelleLong}</Td><Td className="text-right tabular-nums">{formatEurosEcran(p.courant)}</Td><Td className="text-right tabular-nums">{formatEurosEcran(p.precedent)}</Td></Tr>
            ))}
          </TBody>
        </Table>
      </details>
    </figure>
  );
}
