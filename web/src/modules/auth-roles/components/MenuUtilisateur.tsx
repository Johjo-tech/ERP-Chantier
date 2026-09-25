import { useState } from "react";
import { Link } from "react-router";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { messageErreur } from "@/lib/erreurs";
import { Select } from "@/components/ui/input";
import { ROLES, ROLES_LIBELLES, estRole, peutSimuler } from "../domain/permissions";
import { useSession } from "../hooks/useSession";
import { VersionConstruite } from "./VersionConstruite";

/** Identité, rôle, « voir en tant que » (admin seulement) et déconnexion. */
export function MenuUtilisateur() {
  const { etat, roleReel, roleSimule, simulerRole, deconnecter } = useSession();
  const [erreur, setErreur] = useState<unknown>(null);
  if (etat.statut !== "connecte") return null;
  const { utilisateur } = etat.session;

  return (
    <div className="flex flex-col gap-2 text-sm">
      <div>
        <p className="font-medium">{utilisateur.nom}</p>
        <p className="text-xs text-muted-foreground">{roleReel ? ROLES_LIBELLES[roleReel] : "Sans rôle"}</p>
        <Link to="/mon-compte" className="text-xs text-primary underline-offset-2 hover:underline">
          Mon compte
        </Link>
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
      {erreur !== null && <Alert variant="erreur">{messageErreur(erreur)}</Alert>}
      <Button variant="outline" size="sm" onClick={() => deconnecter().catch(setErreur)}>
        Se déconnecter
      </Button>
      <VersionConstruite />
    </div>
  );
}
