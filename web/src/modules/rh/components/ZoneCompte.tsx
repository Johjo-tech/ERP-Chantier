import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { formatDateFr, jourIso } from "@/lib/dates";
import { messageErreur } from "@/lib/erreurs";
import { afficherToast } from "@/lib/toast";
import { useToastErreur } from "@/modules/materiel/components/communs";
import { usePermission } from "@/modules/auth-roles/hooks/useSession";
import { invitationEnAttente, libelleRole, messageInvitation, MESSAGES_ISSUE, ROLES_INVITATION, schemaSaisieInvitation } from "@/modules/comptes/domain/comptes";
import { useGererComptes, useInvitations, useMembres } from "@/modules/comptes/hooks/useComptes";
import type { RoleMembre } from "@/modules/auth-roles/domain/permissions";

/**
 * Le compte du salarié (RH-05), au HTML de `zoneInvitationHTML` (app.js
 * l. 16465). Le compte ne se rattache plus à la main — un homonyme choisi de
 * travers donnait ses droits à quelqu'un d'autre : il se crée par invitation,
 * à l'adresse de la personne, et la base l'inscrit à la confirmation.
 */
export function ZoneCompte({ salarieId, profileId, email, rolePropose }: { salarieId: string | null; profileId: string | null; email: string; rolePropose: RoleMembre }) {
  const membres = useMembres();
  const peutInviter = usePermission("utilisateurs", "creer");
  if (profileId) {
    const nom = membres.data?.find((m) => m.profileId === profileId)?.nom;
    return (
      <div className="card-sub" style={{ marginTop: "6px", color: "#15803d" }}>
        ✓ Compte rattaché{nom ? ` — ${nom}` : ""}.
      </div>
    );
  }
  if (!peutInviter)
    return (
      <div className="card-sub" style={{ marginTop: "6px" }}>
        ⚠ Sans compte. Seul un administrateur peut lui en créer un.
      </div>
    );
  if (!salarieId)
    return (
      <div className="card-sub" style={{ marginTop: "6px" }}>
        Enregistrez la fiche, puis invitez-le à se créer un compte : le bloc apparaîtra ici.
      </div>
    );
  return <Invitation salarieId={salarieId} emailFiche={email} rolePropose={rolePropose} />;
}

function Invitation({ salarieId, emailFiche, rolePropose }: { salarieId: string; emailFiche: string; rolePropose: RoleMembre }) {
  const invitations = useInvitations();
  const gerer = useGererComptes();
  const [email, setEmail] = useState(emailFiche);
  const [role, setRole] = useState<string>(rolePropose);
  const attente = invitationEnAttente(invitations.data ?? [], salarieId);
  useToastErreur(gerer.inviter.error ?? gerer.annuler.error);
  const reussi = { onSuccess: (r: { etat: Parameters<typeof messageInvitation>[0]; email: string }) => afficherToast(messageInvitation(r.etat, r.email), "success") };

  function inviter() {
    const r = schemaSaisieInvitation.safeParse({ email, role });
    if (!r.success) {
      afficherToast(r.error.issues[0]?.message ?? "Indiquez une adresse e-mail valide.");
      return;
    }
    if (r.data.role === "admin" && !window.confirm("Donner TOUS les droits à ce compte, y compris la gestion des utilisateurs ?")) return;
    gerer.inviter.mutate({ salarieId, saisie: r.data }, reussi);
  }

  if (invitations.isPending)
    return (
      <div className="card-sub" style={{ marginTop: "6px" }}>
        Chargement des invitations…
      </div>
    );
  if (attente) {
    return (
      <div className="card-sub" style={{ marginTop: "8px" }}>
        ✉ Invitation en attente pour <strong>{attente.email}</strong>
        {attente.invitee_le ? ` — envoyée le ${formatDateFr(jourIso(attente.invitee_le))}` : ""}.
        <div style={{ display: "flex", gap: "8px", marginTop: "6px" }}>
          <button
            type="button"
            className="btn small"
            disabled={gerer.inviter.isPending}
            onClick={() => {
              // Renvoyer = réinviter à l'identique ; la fonction de bord refuse un renvoi à moins de 10 min.
              const r = schemaSaisieInvitation.safeParse({ email: attente.email, role: attente.role });
              if (r.success) gerer.inviter.mutate({ salarieId, saisie: r.data }, reussi);
              else afficherToast(r.error.issues[0]?.message ?? "Invitation illisible.");
            }}
          >
            Renvoyer
          </button>
          <button
            type="button"
            className="btn small danger"
            onClick={() => {
              if (window.confirm("Annuler l'invitation ? Le lien déjà envoyé ne donnera plus aucun droit.")) gerer.annuler.mutate(attente.id);
            }}
          >
            Annuler
          </button>
        </div>
      </div>
    );
  }
  return (
    <div style={{ marginTop: "8px", padding: "10px", border: "1px dashed var(--border)", borderRadius: "10px" }} role="group" aria-label="Inviter le salarié">
      <div className="card-sub" style={{ marginBottom: "6px" }}>
        Pas de compte ? Invitez-le : il recevra un courriel et choisira son mot de passe.
      </div>
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
        <input type="email" aria-label="Adresse e-mail de l'invitation" value={email} placeholder="adresse e-mail" style={{ flex: 1, minWidth: "180px" }} onChange={(e) => setEmail(e.target.value)} />
        <select aria-label="Rôle du compte" style={{ width: "auto" }} value={role} onChange={(e) => setRole(e.target.value)}>
          {ROLES_INVITATION.map((r) => (
            <option key={r.role} value={r.role}>
              {r.libelle}
            </option>
          ))}
        </select>
        <button type="button" className="btn small primary" disabled={gerer.inviter.isPending} onClick={inviter}>
          ✉ Inviter
        </button>
      </div>
      {!emailFiche.trim() && (
        <div className="card-sub" style={{ marginTop: "6px" }}>
          Renseignez d&apos;abord son e-mail ci-dessous, ou saisissez-le ici.
        </div>
      )}
    </div>
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
