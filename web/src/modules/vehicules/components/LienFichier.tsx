import { Button } from "@/components/ui/button";
import { messageErreur } from "@/lib/erreurs";
import { useUrlFichier } from "@/modules/chantiers/hooks/useFiche";

/** Ouvrir un fichier du seau privé : par une URL signée, demandée au moment du clic. */
export function LienFichier({ chemin, libelle }: { chemin: string; libelle: string }) {
  const url = useUrlFichier();
  function ouvrir() {
    // La fenêtre s'ouvre pendant le clic (sinon bloquée), l'URL signée la remplit ensuite.
    const fenetre = window.open("", "_blank");
    url.mutate(chemin, {
      onSuccess: (u) => {
        if (fenetre) fenetre.location.href = u;
        else window.location.assign(u);
      },
      onError: () => fenetre?.close(),
    });
  }
  return (
    <>
      <Button variant="link" className="h-auto p-0 text-xs" onClick={ouvrir}>
        {libelle}
      </Button>
      {url.isError && <span role="alert" className="text-xs text-destructive">{messageErreur(url.error)}</span>}
    </>
  );
}
