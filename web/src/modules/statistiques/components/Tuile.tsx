import type { ReactNode } from "react";
import { Link } from "react-router";
import { cn } from "@/lib/utils";

export type TonTuile = "neutre" | "succes" | "alerte" | "danger";

const BORDURES: Record<TonTuile, string> = {
  neutre: "border-border",
  succes: "border-success/50",
  alerte: "border-warning",
  danger: "border-destructive/60",
};

/**
 * Une tuile du tableau de bord (`tuileDashboard`) : un chiffre qui appelle le
 * clic OUVRE l'écran qu'il résume. Le ton ne porte jamais seul le sens : le
 * libellé dit ce qui est compté.
 */
export function Tuile({ libelle, valeur, sous, ton = "neutre", vers, titre }: { libelle: string; valeur: ReactNode; sous?: ReactNode; ton?: TonTuile; vers: string; titre?: string }) {
  return (
    <Link
      to={vers}
      title={titre ?? libelle}
      className={cn("flex flex-col gap-1 rounded-md border-2 bg-card p-4 shadow-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", BORDURES[ton])}
    >
      <span className="text-sm text-muted-foreground">{libelle}</span>
      <span className="text-2xl font-semibold tabular-nums">{valeur}</span>
      {sous && <span className="text-xs text-muted-foreground">{sous}</span>}
    </Link>
  );
}

/** Une ligne de « À traiter » : n'apparaît que si elle compte quelque chose. */
export function LigneATraiter({ libelle, precision, nombre, vers, ton = "neutre" }: { libelle: string; precision?: string; nombre: number; vers: string; ton?: TonTuile }) {
  if (!nombre) return null;
  return (
    <li>
      <Link to={vers} className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <span className="flex-1">
          <span className="font-medium">{libelle}</span>
          {precision && <span className="block text-xs text-muted-foreground">{precision}</span>}
        </span>
        <span className={cn("min-w-8 rounded-full px-2 py-0.5 text-center text-xs font-semibold tabular-nums", ton === "danger" ? "bg-destructive/15 text-destructive" : ton === "alerte" ? "bg-warning/25" : "bg-muted")}>{nombre}</span>
        <span aria-hidden="true">›</span>
      </Link>
    </li>
  );
}

/** L'en-tête commun : salutation, sous-titre, date du jour en toutes lettres. */
export function EnTeteTableau({ titre, sousTitre, date }: { titre: string; sousTitre: string; date: string }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold">{titre}</h1>
        <p className="text-sm text-muted-foreground">{sousTitre}</p>
      </div>
      <p className="rounded-full border border-border px-3 py-1 text-sm">{date}</p>
    </div>
  );
}
