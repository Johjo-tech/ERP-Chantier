import { useState, type FormEvent } from "react";
import { Chargement, Erreur, Vide } from "@/components/etats/Etats";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BoutonConfirme } from "@/components/ui/confirmation";
import { Input, Select } from "@/components/ui/input";
import { formatDateFr } from "@/lib/dates";
import { messageErreur } from "@/lib/erreurs";
import type { SalarieCompte } from "../api/comptes";
import {
  invitationEnAttente,
  libelleRole,
  messageInvitation,
  rolePropose,
  ROLES_INVITATION,
  schemaSaisieInvitation,
  STATUTS_INVITATION,
  type Invitation,
} from "../domain/comptes";
import { useConducteursSuivis, useGererComptes, useInvitations, useSalariesComptes } from "../hooks/useComptes";

/**
 * Inviter un salarié à créer son compte (AUTH-18, 19, 43). Une fois l'adresse
 * confirmée, la base rattache seule le membre et la fiche : l'écran relit.
 */
export function BlocInvitations({ modifiable }: { modifiable: boolean }) {
  const salaries = useSalariesComptes();
  const invitations = useInvitations();
  const suivis = useConducteursSuivis();
  const gerer = useGererComptes();
  const sansCompte = (salaries.data ?? []).filter((s) => !s.profileId);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Invitations</CardTitle>
        <p className="text-sm text-muted-foreground">Un salarié sans compte ne peut pas déclarer ses travaux lui-même. Il reçoit un courriel et choisit son mot de passe.</p>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {gerer.inviter.isSuccess && <Alert variant="succes">{messageInvitation(gerer.inviter.data.etat, gerer.inviter.data.email)}</Alert>}
        {(gerer.inviter.error ?? gerer.annuler.error ?? gerer.supprimer.error) && (
          <Alert variant="erreur">{messageErreur(gerer.inviter.error ?? gerer.annuler.error ?? gerer.supprimer.error)}</Alert>
        )}
        <section aria-label="Salariés sans compte" className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold">Salariés sans compte</h3>
          {salaries.isPending || invitations.isPending ? (
            <Chargement />
          ) : salaries.isError ? (
            <Erreur erreur={salaries.error} reessayer={() => void salaries.refetch()} />
          ) : sansCompte.length === 0 ? (
            <Vide message="Tous les salariés actifs ont un compte." />
          ) : (
            <ul className="flex flex-col divide-y divide-border rounded-md border border-border">
              {sansCompte.map((s) => (
                <LigneSalarie
                  key={s.id}
                  salarie={s}
                  attente={invitationEnAttente(invitations.data ?? [], s.id)}
                  roleInitial={rolePropose(s.id, suivis.data ?? [])}
                  modifiable={modifiable}
                  gerer={gerer}
                />
              ))}
            </ul>
          )}
        </section>
        <Historique invitations={invitations.data ?? []} modifiable={modifiable} gerer={gerer} />
      </CardContent>
    </Card>
  );
}

type Gerer = ReturnType<typeof useGererComptes>;

function LigneSalarie({ salarie, attente, roleInitial, modifiable, gerer }: { salarie: SalarieCompte; attente: Invitation | null; roleInitial: string; modifiable: boolean; gerer: Gerer }) {
  const [email, setEmail] = useState(salarie.email);
  const [role, setRole] = useState(roleInitial);
  const [erreur, setErreur] = useState<string | null>(null);
  const [confirmerAdmin, setConfirmerAdmin] = useState(false);

  function inviter(e: FormEvent) {
    e.preventDefault();
    const r = schemaSaisieInvitation.safeParse({ email, role });
    if (!r.success) return setErreur(r.error.issues[0]?.message ?? "Saisie invalide.");
    if (r.data.role === "admin" && !confirmerAdmin) return setConfirmerAdmin(true);
    setErreur(null);
    setConfirmerAdmin(false);
    gerer.inviter.mutate({ salarieId: salarie.id, saisie: r.data });
  }

  /** Renvoyer = réinviter à l'identique ; la fonction de bord refuse un renvoi à moins de 10 min. */
  function renvoyer(i: Invitation) {
    const r = schemaSaisieInvitation.safeParse({ email: i.email, role: i.role });
    if (!r.success) return setErreur(r.error.issues[0]?.message ?? "Invitation illisible.");
    gerer.inviter.mutate({ salarieId: salarie.id, saisie: r.data });
  }

  if (attente) {
    return (
      <li className="flex flex-wrap items-center justify-between gap-2 p-2 text-sm">
        <span>
          <strong>{salarie.nom}</strong> — invitation en attente pour {attente.email}
          {attente.invitee_le ? `, envoyée le ${formatDateFr(attente.invitee_le)}` : ""}.
          {erreur && <span className="block text-xs text-destructive">{erreur}</span>}
        </span>
        {modifiable && (
          <span className="flex gap-2">
            <Button size="sm" variant="outline" disabled={gerer.inviter.isPending} onClick={() => renvoyer(attente)}>
              Renvoyer
            </Button>
            <BoutonConfirme libelle="Annuler" question="Annuler l'invitation ? Le lien envoyé ne donnera plus aucun droit." onConfirmer={() => gerer.annuler.mutate(attente.id)} />
          </span>
        )}
      </li>
    );
  }
  if (!modifiable) return <li className="p-2 text-sm">{salarie.nom} — sans compte. Seul un administrateur peut lui en créer un.</li>;
  return (
    <li className="p-2 text-sm">
      <form onSubmit={inviter} noValidate className="flex flex-wrap items-center gap-2">
        <strong className="min-w-40">{salarie.nom}</strong>
        <Input aria-label={`Adresse e-mail de ${salarie.nom}`} type="email" className="w-56" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="adresse e-mail" />
        <Select aria-label={`Rôle proposé à ${salarie.nom}`} className="w-auto" value={role} onChange={(e) => { setRole(e.target.value); setConfirmerAdmin(false); }}>
          {ROLES_INVITATION.map((r) => (
            <option key={r.role} value={r.role}>{r.libelle}</option>
          ))}
        </Select>
        <Button type="submit" size="sm" disabled={gerer.inviter.isPending}>{confirmerAdmin ? "Confirmer : tous les droits" : "Inviter"}</Button>
      </form>
      {confirmerAdmin && <p className="pt-1 text-xs text-destructive">Donner TOUS les droits à ce compte, y compris la gestion des utilisateurs ? Cliquez à nouveau pour confirmer.</p>}
      {erreur && <p className="pt-1 text-xs text-destructive">{erreur}</p>}
    </li>
  );
}

function Historique({ invitations, modifiable, gerer }: { invitations: readonly Invitation[]; modifiable: boolean; gerer: Gerer }) {
  if (invitations.length === 0) return null;
  return (
    <section aria-label="Historique des invitations" className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold">Historique</h3>
      <ul className="flex flex-col divide-y divide-border rounded-md border border-border">
        {invitations.map((i) => (
          <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 p-2 text-sm">
            <span>
              {i.email} — {libelleRole(i.role)} <Badge variant={i.statut === "acceptee" ? "succes" : i.statut === "en_attente" ? "alerte" : "neutre"}>{STATUTS_INVITATION[i.statut]}</Badge>
            </span>
            {modifiable && i.statut !== "en_attente" && <BoutonConfirme libelle="Effacer" question="Effacer cette trace ?" onConfirmer={() => gerer.supprimer.mutate(i.id)} />}
          </li>
        ))}
      </ul>
    </section>
  );
}
