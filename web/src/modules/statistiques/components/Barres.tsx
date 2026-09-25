import { type Montant } from "@/lib/money";
import { formatEurosEcran } from "@/lib/modeDiscret";
import { COULEUR_COURANTE } from "./GraphiqueCA";

/**
 * Répartition en barres horizontales (`renderStatsCARepartitionHTML`). Une
 * seule couleur — celle de la société — : l'identité est portée par le
 * libellé écrit à côté, jamais par une teinte (et une 9ᵉ série n'invente pas
 * une couleur). Le tableau qui suit donne les mêmes chiffres.
 */
export function BarresRepartition({ titre, lignes }: { titre: string; lignes: { libelle: string; ht: Montant; part: number }[] }) {
  if (!lignes.length) return <p className="text-sm text-muted-foreground">Aucun chiffre d'affaires facturé sur la période.</p>;
  return (
    <figure className="flex flex-col gap-2">
      <figcaption className="text-sm font-medium">{titre}</figcaption>
      <ul className="flex flex-col gap-1.5">
        {lignes.map((l) => (
          <li key={l.libelle} className="grid grid-cols-[minmax(8rem,14rem)_1fr_auto] items-center gap-3 text-sm">
            <span className="truncate" title={l.libelle}>{l.libelle}</span>
            <span aria-hidden="true" className="h-2.5 overflow-hidden rounded-full bg-muted">
              <span className="block h-full rounded-full" style={{ width: `${l.part}%`, background: COULEUR_COURANTE }} />
            </span>
            <span className="tabular-nums">{formatEurosEcran(l.ht)} <span className="text-muted-foreground">({l.part} %)</span></span>
          </li>
        ))}
      </ul>
    </figure>
  );
}

/** Dans les temps / en retard, en deux segments (`renderStatsRetardHTML`) ; les nombres sont écrits. */
export function BarreRetard({ libelle, dansLesTemps, retard, part }: { libelle: string; dansLesTemps: number; retard: number; part: number }) {
  return (
    <li className="grid grid-cols-[minmax(8rem,14rem)_1fr_auto] items-center gap-3 text-sm">
      <span className="truncate">{libelle}</span>
      <span aria-hidden="true" className="flex h-2.5 gap-0.5 overflow-hidden rounded-full bg-muted">
        {part > 0 && <span className="h-full bg-success" style={{ width: `${part}%` }} />}
        {part < 100 && dansLesTemps + retard > 0 && <span className="h-full flex-1 bg-destructive" />}
      </span>
      <span className="tabular-nums">{dansLesTemps} dans les temps · {retard} en retard</span>
    </li>
  );
}
