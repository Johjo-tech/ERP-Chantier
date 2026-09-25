import { useState, type FormEvent } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { BoutonConfirme } from "@/components/ui/confirmation";
import { Input, Select } from "@/components/ui/input";
import { formatDateFr } from "@/lib/dates";
import { messageErreur } from "@/lib/erreurs";
import { usePermission } from "@/modules/auth-roles/hooks/useSession";
import { invitationEnAttente, libelleRole, messageInvitation, MESSAGES_ISSUE, ROLES_INVITATION, schemaSaisieInvitation } from "@/modules/comptes/domain/comptes";
import { useGererComptes, useInvitations, useMembres } from "@/modules/comptes/hooks/useComptes";
import type { RoleMembre } from "@/modules/auth-roles/domain/permissions";

/**
 * Le compte du salarié (RH-05). Le compte ne se rattache plus à la main — un
 * homonyme choisi de travers donnait ses droits à quelqu'un d'autre : il se
 * crée par invitation, à l'adresse de la personne, et la base l'inscrit à la
 * confirmation. Réutilise `comptes/api` (même fonction de bord, mêmes règles).
 */
export function ZoneCompte({ salarieId, profileId, email, rolePropose }: { salarieId: string | null; profileId: string | null; email: string; rolePropose: RoleMembre }) {
  const membres = useMembres();
  const peutInviter = usePermission("utilisateurs", "creer");
  if (profileId) {
    const nom = membres.data?.find((m) => m.profileId === profileId)?.nom;
    return <p className="text-sm text-success">✓ Compte rattaché{nom ? ` — ${nom}` : ""}.</p>;
  }
  if (!peutInviter) return <p className="text-sm text-muted-foreground">⚠ Sans compte. Seul un administrateur peut lui en créer un.</p>;
  if (!salarieId) return <p className="text-sm text-muted-foreground">Enregistrez la fiche, puis invitez-le à se créer un compte : le bloc apparaîtra ici.</p>;
  return <Invitation salarieId={salarieId} emailFiche={email} rolePropose={rolePropose} />;
}

function Invitation({ salarieId, emailFiche, rolePropose }: { salarieId: string; emailFiche: string; rolePropose: RoleMembre }) {
  const invitations = useInvitations();
  const gerer = useGererComptes();
  const [email, setEmail] = useState(emailFiche);
  const [role, setRole] = useState<string>(rolePropose);
  const [erreur, setErreur] = useState<string | null>(null);
  const [confirmerAdmin, setConfirmerAdmin] = useState(false);
  const attente = invitationEnAttente(invitations.data ?? [], salarieId);

  function inviter(e: FormEvent) {
    e.preventDefault();
    const r = schemaSaisieInvitation.safeParse({ email, role });
    if (!r.success) return setErreur(r.error.issues[0]?.message ?? "Saisie invalide.");
    if (r.data.role === "admin" && !confirmerAdmin) return setConfirmerAdmin(true);
    setErreur(null);
    setConfirmerAdmin(false);
    gerer.inviter.mutate({ salarieId, saisie: r.data });
  }

  const retour = gerer.inviter.isSuccess ? <Alert variant="succes">{messageInvitation(gerer.inviter.data.etat, gerer.inviter.data.email)}</Alert> : null;
  const echec = gerer.inviter.error ?? gerer.annuler.error;
  if (invitations.isPending) return <p className="text-sm text-muted-foreground">Chargement des invitations…</p>;
  if (attente) {
    return (
      <div className="flex flex-col gap-1 text-sm">
        {retour}
        {echec && <Alert variant="erreur">{messageErreur(echec)}</Alert>}
        <p>
          ✉ Invitation en attente pour <strong>{attente.email}</strong>
          {attente.invitee_le ? ` — envoyée le ${formatDateFr(attente.invitee_le)}` : ""}.
        </p>
        <span className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={gerer.inviter.isPending}
            onClick={() => {
              // Renvoyer = réinviter à l'identique ; la fonction de bord refuse un renvoi à moins de 10 min.
              const r = schemaSaisieInvitation.safeParse({ email: attente.email, role: attente.role });
              if (r.success) gerer.inviter.mutate({ salarieId, saisie: r.data });
              else setErreur(r.error.issues[0]?.message ?? "Invitation illisible.");
            }}
          >
            Renvoyer
          </Button>
          <BoutonConfirme libelle="Annuler l'invitation" question="Annuler l'invitation ? Le lien déjà envoyé ne donnera plus aucun droit." onConfirmer={() => gerer.annuler.mutate(attente.id)} />
        </span>
      </div>
    );
  }
  return (
    <form onSubmit={inviter} noValidate aria-label="Inviter le salarié" className="flex flex-col gap-2 rounded-md border border-dashed border-border p-2 text-sm">
      {retour}
      <p className="text-muted-foreground">Pas de compte ? Invitez-le : il recevra un courriel et choisira son mot de passe.</p>
      <span className="flex flex-wrap gap-2">
        <Input aria-label="Adresse e-mail de l'invitation" type="email" className="min-w-48 flex-1" value={email} placeholder="adresse e-mail" onChange={(e) => setEmail(e.target.value)} />
        <Select aria-label="Rôle du compte" className="w-auto" value={role} onChange={(e) => setRole(e.target.value)}>
          {ROLES_INVITATION.map((r) => (
            <option key={r.role} value={r.role}>{r.libelle}</option>
          ))}
        </Select>
        <Button type="submit" size="sm" disabled={gerer.inviter.isPending}>✉ Inviter</Button>
      </span>
      {confirmerAdmin && <Alert>Donner TOUS les droits à ce compte, y compris la gestion des utilisateurs ? Cliquez de nouveau sur « Inviter » pour confirmer.</Alert>}
      {(erreur || echec) && <Alert variant="erreur">{erreur ?? messageErreur(echec)}</Alert>}
    </form>
  );
}

/**
 * Le dernier maillon de la case « Conducteur de travaux » (AUTH-20) : le rôle
 * du compte, qui décide du tableau de bord reçu. DEMANDÉ, JAMAIS IMPOSÉ —
 * changer un rôle retire des droits.
 */
export function PropositionRole({ nom, profileId, roleActuel, onFini }: { nom: string; profileId: string; roleActuel: RoleMembre | null; onFini: () => void }) {
  const membres = useMembres();
  const gerer = useGererComptes();
  const peut = usePermission("utilisateurs", "modifier");
  const membre = membres.data?.find((m) => m.profileId === profileId) ?? null;
  if (!peut) {
    return (
      <Alert>
        Seul un administrateur peut changer un rôle. La fiche est enregistrée, le rôle non.{" "}
        <Button size="sm" variant="outline" onClick={onFini}>Continuer</Button>
      </Alert>
    );
  }
  if (gerer.role.isSuccess) {
    const texte = gerer.role.data === "change" ? `${nom} est désormais conducteur de travaux.` : MESSAGES_ISSUE[gerer.role.data];
    return (
      <Alert variant="succes">
        {texte} <Button size="sm" variant="outline" onClick={onFini}>Continuer</Button>
      </Alert>
    );
  }
  return (
    <Alert aria-label="Changer le rôle du compte">
      <p>
        Donner à {nom} le rôle « Conducteur de travaux » ? Son compte est aujourd'hui {roleActuel ? libelleRole(roleActuel) : "sans rôle"}. Sans ce changement, son tableau de bord restera celui du pilotage — chiffre d'affaires,
        impayés — au lieu de ses chantiers.
      </p>
      {gerer.role.isError && <p className="text-destructive">{messageErreur(gerer.role.error)}</p>}
      {!membre && !membres.isPending && <p className="text-destructive">{MESSAGES_ISSUE.absent}</p>}
      <span className="mt-2 flex gap-2">
        <Button size="sm" disabled={!membre || gerer.role.isPending} onClick={() => membre && gerer.role.mutate({ membre, role: "conducteur" })}>Donner le rôle</Button>
        <Button size="sm" variant="ghost" onClick={onFini}>Ne pas changer</Button>
      </span>
    </Alert>
  );
}
