interface Props {
  page: number;
  pages: number;
  libelle: string;
  onPage: (page: number) => void;
}

/** La pagination de l'ancien catalogue ; rien à montrer sur une seule page. */
export function Pagination({ page, pages, libelle, onPage }: Props) {
  if (pages <= 1) return null;
  return (
    <nav aria-label={libelle} style={{ display: "flex", gap: "8px", alignItems: "center", justifyContent: "center", marginTop: "14px" }}>
      <button type="button" className="btn small" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        ← Précédent
      </button>
      <span aria-live="polite" className="card-sub">
        Page {page} sur {pages}
      </span>
      <button type="button" className="btn small" disabled={page >= pages} onClick={() => onPage(page + 1)}>
        Suivant →
      </button>
    </nav>
  );
}
