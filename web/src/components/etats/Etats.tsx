import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { messageErreur } from "@/lib/erreurs";

/** Chargement, vide, erreur : chaque écran passe par ces trois états. */
export function Chargement({ libelle = "Chargement…" }: { libelle?: string }) {
  return (
    <div role="status" aria-live="polite" className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
      {libelle}
    </div>
  );
}

export function Vide({ message, action }: { message: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-md border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
      <p>{message}</p>
      {action}
    </div>
  );
}

export function Erreur({ erreur, reessayer }: { erreur: unknown; reessayer?: () => void }) {
  return (
    <Alert variant="erreur" className="flex items-center justify-between gap-4">
      <span>{messageErreur(erreur)}</span>
      {reessayer && (
        <Button variant="outline" size="sm" onClick={reessayer}>
          Réessayer
        </Button>
      )}
    </Alert>
  );
}
