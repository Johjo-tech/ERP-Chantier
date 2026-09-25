import { useState } from "react";
import { Chargement, Erreur, Vide } from "@/components/etats/Etats";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/input";
import { messageErreur } from "@/lib/erreurs";
import { estRole, ROLES, ROLES_LIBELLES, type RoleMembre } from "@/modules/auth-roles/domain/permissions";
import { usePermission, useSession } from "@/modules/auth-roles/hooks/useSession";
import { MESSAGES_ISSUE, trierMembres, verrouAdmin, type Membre } from "../domain/comptes";
import { useGererComptes, useMembres } from "../hooks/useComptes";
import { BlocInvitations } from "./BlocInvitations";

/**
 * Comptes et accès (AUTH-18, 20, 32, 40). Réservé à `utilisateurs` : la RLS
 * n'accorde l'écriture des membres et des invitations qu'à l'administrateur.
 */
export function SectionComptes() {
  const modifiable = usePermission("utilisateurs", "modifier");
  return (
    <div className="flex flex-col gap-4">
      <BlocMembres modifiable={modifiable} />
      <BlocInvitations modifiable={usePermission("utilisateurs", "creer")} />
    </div>
  );
}

function BlocMembres({ modifiable }: { modifiable: boolean }) {
  const membres = useMembres();
  const gerer = useGererComptes();
  const { etat } = useSession();
  const [aConfirmer, setAConfirmer] = useState<{ membre: Membre; role: RoleMembre } | null>(null);
  const moi = etat.statut === "connecte" ? etat.session.utilisateur.id : "";
  const issue = gerer.role.data;
  const erreur = gerer.role.error ?? gerer.acces.error;

  function changerRole(membre: Membre, role: RoleMembre) {
    // Donner TOUS les droits se confirme, comme à l'invitation (AUTH-19).
    if (role === "admin") return setAConfirmer({ membre, role });
    gerer.role.mutate({ membre, role });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Membres de la société</CardTitle>
        <p className="text-sm text-muted-foreground">Le rôle décide des écrans, des droits et du tableau de bord de chacun. Un accès désactivé se réactive sans perdre l'historique.</p>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {erreur && <Alert variant="erreur">{messageErreur(erreur)}</Alert>}
        {issue && gerer.role.isSuccess && <Alert variant={issue === "change" || issue === "inchange" ? "succes" : "erreur"}>{MESSAGES_ISSUE[issue]}</Alert>}
        {aConfirmer && (
          <Alert role="alertdialog" aria-label="Confirmer le rôle administrateur">
            Donner TOUS les droits à {aConfirmer.membre.nom}, y compris la gestion des comptes ?
            <span className="ml-2 inline-flex gap-2">
              <Button size="sm" variant="destructive" onClick={() => { gerer.role.mutate(aConfirmer); setAConfirmer(null); }}>Confirmer</Button>
              <Button size="sm" variant="ghost" onClick={() => setAConfirmer(null)}>Annuler</Button>
            </span>
          </Alert>
        )}
        {membres.isPending ? (
          <Chargement />
        ) : membres.isError ? (
          <Erreur erreur={membres.error} reessayer={() => void membres.refetch()} />
        ) : membres.data.length === 0 ? (
          <Vide message="Aucun membre." />
        ) : (
          <ul className="flex flex-col divide-y divide-border rounded-md border border-border">
            {trierMembres(membres.data).map((m) => {
              const verrou = verrouAdmin(m, moi, membres.data);
              return (
                <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 p-2 text-sm">
                  <div>
                    <p className="font-medium">
                      {m.nom} {m.profileId === moi && <Badge variant="neutre">vous</Badge>} {!m.actif && <Badge variant="danger">accès désactivé</Badge>}
                      {!m.compteActif && <Badge variant="danger">compte coupé</Badge>}
                    </p>
                    <p className="text-xs text-muted-foreground">{m.email}</p>
                    {verrou && modifiable && <p className="text-xs text-muted-foreground">{verrou}</p>}
                  </div>
                  {modifiable ? (
                    <span className="flex items-center gap-2">
                      <label className="sr-only" htmlFor={`role-${m.id}`}>Rôle de {m.nom}</label>
                      <Select id={`role-${m.id}`} className="w-auto" value={m.role} disabled={gerer.role.isPending || (verrou !== null)} onChange={(e) => estRole(e.target.value) && changerRole(m, e.target.value)}>
                        {ROLES.map((r) => (
                          <option key={r} value={r}>{ROLES_LIBELLES[r]}</option>
                        ))}
                      </Select>
                      <Button size="sm" variant="ghost" disabled={gerer.acces.isPending || (m.actif && verrou !== null)} onClick={() => gerer.acces.mutate({ id: m.id, actif: !m.actif })}>
                        {m.actif ? "Désactiver l'accès" : "Réactiver l'accès"}
                      </Button>
                    </span>
                  ) : (
                    <span>{ROLES_LIBELLES[m.role]}</span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
