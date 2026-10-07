import { Button } from "@/components/ui/button";
import { useSession } from "@/modules/auth-roles/hooks/useSession";

export function PageSansSociete() {
  const { deconnecter } = useSession();
  return (
    <main className="mx-auto flex max-w-md flex-col gap-4 p-8">
      <h1 className="text-xl font-semibold">Aucun accès</h1>
      <p className="text-sm text-muted-foreground">
        Votre compte n'est rattaché à aucune société active. Demandez à un administrateur de vous inviter.
      </p>
      <Button variant="outline" onClick={() => void deconnecter()}>
        Se déconnecter
      </Button>
    </main>
  );
}
