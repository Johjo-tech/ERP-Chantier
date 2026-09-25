import { useRef, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface Onglet {
  cle: string;
  libelle: string;
}

interface Props {
  id: string;
  onglets: readonly Onglet[];
  actif: string;
  choisir: (cle: string) => void;
  children: ReactNode;
}

/**
 * Des onglets accessibles (motif ARIA « tabs ») : ← → Début Fin au clavier.
 * La fiche chantier de l'ancien écran empilait une dizaine de sections sur une
 * seule page ; on les range par usage, sans en perdre aucune.
 */
export function Onglets({ id, onglets, actif, choisir, children }: Props) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  function clavier(e: KeyboardEvent, i: number) {
    const cible = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: onglets.length - 1 }[e.key];
    if (cible === undefined) return;
    e.preventDefault();
    const j = (cible + onglets.length) % onglets.length;
    const o = onglets[j];
    if (!o) return;
    choisir(o.cle);
    refs.current[j]?.focus();
  }
  return (
    <div className="flex flex-col gap-4">
      <div role="tablist" aria-label="Sections du chantier" className="flex flex-wrap gap-1 border-b border-border">
        {onglets.map((o, i) => (
          <button
            key={o.cle}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="tab"
            id={`${id}-onglet-${o.cle}`}
            aria-selected={o.cle === actif}
            aria-controls={`${id}-panneau`}
            tabIndex={o.cle === actif ? 0 : -1}
            onClick={() => choisir(o.cle)}
            onKeyDown={(e) => clavier(e, i)}
            className={cn("-mb-px border-b-2 px-3 py-2 text-sm font-medium", o.cle === actif ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}
          >
            {o.libelle}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`${id}-panneau`} aria-labelledby={`${id}-onglet-${actif}`}>
        {children}
      </div>
    </div>
  );
}
