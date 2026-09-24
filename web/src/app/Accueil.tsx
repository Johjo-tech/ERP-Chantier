import { ROLES_LIBELLES } from "@/modules/auth-roles/domain/permissions";
import { useSession, useSocieteActive } from "@/modules/auth-roles/hooks/useSession";

export function Accueil() {
  const societe = useSocieteActive();
  const { roleEffectif } = useSession();
  return (
    <div className="flex flex-col gap-2">
      <h1 className="text-2xl font-semibold">Tableau de bord</h1>
      <p className="text-sm text-muted-foreground">
        {societe.nom} — {roleEffectif ? ROLES_LIBELLES[roleEffectif] : ""}
      </p>
    </div>
  );
}
