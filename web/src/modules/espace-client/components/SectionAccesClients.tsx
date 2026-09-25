import { useState, type FormEvent } from "react";
import { Chargement, Erreur, Vide } from "@/components/etats/Etats";
import { ChampChoix, ChampTexte } from "@/components/formulaire/Champ";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BoutonConfirme } from "@/components/ui/confirmation";
import { formatDateFr } from "@/lib/dates";
import { messageErreur } from "@/lib/erreurs";
import { usePermission } from "@/modules/auth-roles/hooks/useSession";
import { useClients, useInterlocuteurs } from "@/modules/clients/hooks/useClients";
import { accesParClient, messageOuverture, schemaOuvertureAcces, type AccesClient } from "../domain/acces";
import { useAccesClients, useGererAccesClients } from "../hooks/useAccesClients";

type Gerer = ReturnType<typeof useGererAccesClients>;

/**
 * Réglages › Accès clients : qui, chez un client, lit son espace (chantiers,
 * devis envoyés, factures émises, suivi des bons). Réservé à l'administrateur,
 * comme la base (`est_admin`) ; un autre rôle ne voit même pas la rubrique.
 */
export function SectionAccesClients() {
  const acces = useAccesClients();
  const gerer = useGererAccesClients();
  const modifiable = usePermission("utilisateurs", "modifier");
  const erreur = gerer.definir.error ?? gerer.retirer.error;
  return (
    <div className="flex flex-col gap-4">
      {modifiable && <FormulaireOuverture gerer={gerer} />}
      <Card>
        <CardHeader>
          <CardTitle>Accès ouverts</CardTitle>
          <p className="text-sm text-muted-foreground">Un accès fermé se rouvre sans ressaisie ; un accès retiré disparaît.</p>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {erreur && <Alert variant="erreur">{messageErreur(erreur)}</Alert>}
          {acces.isPending ? (
            <Chargement />
          ) : acces.isError ? (
            <Erreur erreur={acces.error} reessayer={() => void acces.refetch()} />
          ) : acces.data.length === 0 ? (
            <Vide message="Aucun client n'a encore accès à son espace." />
          ) : (
            accesParClient(acces.data).map((g) => (
              <section key={g.clientId} aria-label={g.clientNom} className="flex flex-col gap-1">
                <h3 className="text-sm font-semibold">{g.clientNom}</h3>
                <ul className="flex flex-col divide-y divide-border rounded-md border border-border">
                  {g.acces.map((a) => <LigneAcces key={a.id} acces={a} modifiable={modifiable} gerer={gerer} />)}
                </ul>
              </section>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function LigneAcces({ acces: a, modifiable, gerer }: { acces: AccesClient; modifiable: boolean; gerer: Gerer }) {
  const enCours = gerer.definir.isPending || gerer.retirer.isPending;
  return (
    <li className="flex flex-wrap items-center gap-2 p-2 text-sm">
      <span className="min-w-0 flex-1">
        <span className="font-medium">{a.compte_nom || a.compte_email}</span>
        {a.compte_nom && a.compte_email && <span className="text-muted-foreground"> — {a.compte_email}</span>}
        <span className="block text-xs text-muted-foreground">
          {a.interlocuteur ? `Ses documents à « ${a.interlocuteur} » seulement` : "Tout le client"} · depuis le {formatDateFr(a.cree_le.slice(0, 10))}
        </span>
      </span>
      <Badge variant={a.actif ? "succes" : "neutre"}>{a.actif ? "Ouvert" : "Fermé"}</Badge>
      {modifiable && (
        <>
          <Button size="sm" variant="outline" disabled={enCours} onClick={() => gerer.definir.mutate({ id: a.id, actif: !a.actif })}>
            {a.actif ? "Fermer" : "Rouvrir"}
          </Button>
          <BoutonConfirme libelle="Retirer" question={`Retirer l'accès de ${a.compte_email ?? a.compte_nom} ?`} enCours={enCours} onConfirmer={() => gerer.retirer.mutate(a.id)} />
        </>
      )}
    </li>
  );
}

function FormulaireOuverture({ gerer }: { gerer: Gerer }) {
  const clients = useClients();
  const [clientId, setClientId] = useState("");
  const [email, setEmail] = useState("");
  const [interlocuteur, setInterlocuteur] = useState("");
  const [erreurs, setErreurs] = useState<Record<string, string>>({});
  const issue = gerer.ouvrir.data ? messageOuverture(gerer.ouvrir.data, gerer.ouvrir.variables.email) : null;

  const soumettre = (e: FormEvent) => {
    e.preventDefault();
    const r = schemaOuvertureAcces.safeParse({ clientId, email, interlocuteur });
    if (!r.success) {
      setErreurs(Object.fromEntries(r.error.issues.map((i) => [String(i.path[0]), i.message])));
      return;
    }
    setErreurs({});
    gerer.ouvrir.mutate(r.data, { onSuccess: (x) => x === "ouvert" || x === "rouvert" ? setEmail("") : undefined });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ouvrir un accès</CardTitle>
        <p className="text-sm text-muted-foreground">Le compte doit exister (le client l'a créé avec son adresse). Il ne devient jamais membre de la société : il ne lit que ses pièces.</p>
      </CardHeader>
      <CardContent>
        <form onSubmit={soumettre} className="grid gap-3 md:grid-cols-3" noValidate>
          <ChampChoix
            libelle="Client"
            requis
            valeur={clientId}
            onChange={(v) => {
              setClientId(v);
              setInterlocuteur("");
            }}
            erreur={erreurs.clientId}
            options={[{ valeur: "", libelle: clients.isPending ? "Chargement…" : "— Choisir —" }, ...(clients.data ?? []).map((c) => ({ valeur: c.id, libelle: c.nom }))]}
          />
          <ChampTexte libelle="Adresse du compte" requis type="email" inputMode="email" valeur={email} onChange={setEmail} erreur={erreurs.email} />
          {clientId ? (
            <ChoixInterlocuteur clientId={clientId} valeur={interlocuteur} onChange={setInterlocuteur} />
          ) : (
            <ChampChoix libelle="Restreindre à l'interlocuteur" valeur="" onChange={setInterlocuteur} desactive aide="Choisissez d'abord le client." options={[{ valeur: "", libelle: "Tout le client" }]} />
          )}
          <div className="md:col-span-3 flex flex-col gap-2">
            {issue && <Alert variant={issue.succes ? "succes" : "erreur"}>{issue.texte}</Alert>}
            {gerer.ouvrir.isError && <Alert variant="erreur">{messageErreur(gerer.ouvrir.error)}</Alert>}
            <Button type="submit" className="self-start" disabled={gerer.ouvrir.isPending}>
              Ouvrir l'accès
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

/** Les interlocuteurs ne se lisent qu'une fois le client choisi : un identifiant vide ferait échouer la lecture. */
function ChoixInterlocuteur({ clientId, valeur, onChange }: { clientId: string; valeur: string; onChange: (v: string) => void }) {
  const interlocuteurs = useInterlocuteurs(clientId);
  return (
    <ChampChoix
      libelle="Restreindre à l'interlocuteur"
      valeur={valeur}
      onChange={onChange}
      aide="« Tout le client » : toutes ses pièces ; sinon, celles adressées à cet interlocuteur."
      options={[{ valeur: "", libelle: "Tout le client" }, ...(interlocuteurs.data ?? []).map((i) => ({ valeur: i.nom, libelle: i.nom }))]}
    />
  );
}
