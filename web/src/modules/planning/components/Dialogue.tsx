import { useEffect, useId, useRef, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Props {
  titre: string;
  onFermer: () => void;
  children: ReactNode;
  actions?: ReactNode;
  large?: boolean;
}

/**
 * Une fenêtre modale accessible : rôle `dialog`, titre annoncé, Échap ferme,
 * le focus y entre à l'ouverture et revient d'où il venait à la fermeture —
 * sur un téléphone de chantier comme au clavier.
 */
export function Dialogue({ titre, onFermer, children, actions, large = false }: Props) {
  const idTitre = useId();
  const cadre = useRef<HTMLDivElement>(null);
  const fermer = useRef(onFermer);
  useEffect(() => {
    fermer.current = onFermer;
  });

  useEffect(() => {
    const precedent = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    cadre.current?.focus();
    const touche = (e: KeyboardEvent) => {
      if (e.key === "Escape") fermer.current();
    };
    document.addEventListener("keydown", touche);
    return () => {
      document.removeEventListener("keydown", touche);
      precedent?.focus();
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-2 sm:p-6 print:hidden" onMouseDown={(e) => e.target === e.currentTarget && onFermer()}>
      <div ref={cadre} role="dialog" aria-modal="true" aria-labelledby={idTitre} tabIndex={-1} className={cn("w-full rounded-lg border bg-background p-4 shadow-xl outline-none", large ? "max-w-3xl" : "max-w-md")}>
        <div className="mb-3 flex items-start justify-between gap-2">
          <h2 id={idTitre} className="text-lg font-semibold">{titre}</h2>
          <Button variant="ghost" size="sm" aria-label="Fermer" onClick={onFermer}>✕</Button>
        </div>
        <div className="flex flex-col gap-3">{children}</div>
        {actions && <div className="mt-4 flex flex-wrap justify-end gap-2">{actions}</div>}
      </div>
    </div>
  );
}
