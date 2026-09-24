import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { ROLES, ROLES_LIBELLES, estRole, peutSimuler } from "../domain/permissions";
import { useSession } from "../hooks/useSession";

/** Identité, rôle, « voir en tant que » (admin seulement) et déconnexion. */
export function MenuUtilisateur() {
  const { etat, roleReel, roleSimule, simulerRole, deconnecter } = useSession();
  if (etat.statut !== "connecte") return null;
  const { utilisateur } = etat.session;

  return (
    <div className="flex flex-col gap-2 text-sm">
      <div>
        <p className="font-medium">{utilisateur.nom}</p>
        <p className="text-xs text-muted-foreground">{roleReel ? ROLES_LIBELLES[roleReel] : "Sans rôle"}</p>
      </div>
      {peutSimuler(roleReel) && (
        <div className="flex flex-col gap-1">
          <label htmlFor="voir-en-tant-que" className="text-xs text-muted-foreground">
            Voir en tant que
          </label>
          <Select
            id="voir-en-tant-que"
            value={roleSimule ?? ""}
            onChange={(e) => simulerRole(estRole(e.target.value) ? e.target.value : null)}
          >
            <option value="">Moi-même (administrateur)</option>
            {ROLES.filter((r) => r !== "admin").map((r) => (
              <option key={r} value={r}>
                {ROLES_LIBELLES[r]}
              </option>
            ))}
          </Select>
        </div>
      )}
      <Button variant="outline" size="sm" onClick={() => void deconnecter()}>
        Se déconnecter
      </Button>
    </div>
  );
}
