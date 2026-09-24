import { Button } from "@/components/ui/button";

interface Props {
  page: number;
  pages: number;
  libelle: string;
  onPage: (page: number) => void;
}

/** Précédent / suivant, annoncé aux lecteurs d'écran ; rien à montrer sur une seule page. */
export function Pagination({ page, pages, libelle, onPage }: Props) {
  if (pages <= 1) return null;
  return (
    <nav aria-label={libelle} className="mt-3 flex items-center justify-center gap-3">
      <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        ← Précédente
      </Button>
      <span aria-live="polite" className="text-sm text-muted-foreground">
        Page {page} sur {pages}
      </span>
      <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>
        Suivante →
      </Button>
    </nav>
  );
}
