import { type FormEvent } from "react";
import { Chargement, Erreur, Vide } from "@/components/etats/Etats";
import { ChampTexte } from "@/components/formulaire/Champ";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BoutonConfirme } from "@/components/ui/confirmation";
import { messageErreur } from "@/lib/erreurs";
import { useFormulaire } from "@/lib/useFormulaire";
import { usePermission } from "@/modules/auth-roles/hooks/useSession";
import { schemaSaisieInterlocuteur } from "../domain/interlocuteur";
import { useAjouterInterlocuteur, useInterlocuteurs, useSupprimerInterlocuteur } from "../hooks/useClients";

const VIDE = { nom: "", fonction: "", email: "", telephone: "" };

export function BlocInterlocuteurs({ clientId }: { clientId: string }) {
  const liste = useInterlocuteurs(clientId);
  const ajouter = useAjouterInterlocuteur(clientId);
  const supprimer = useSupprimerInterlocuteur(clientId);
  // Les interlocuteurs suivent les droits du client qui les porte.
  const peutModifier = usePermission("clients", "modifier");
  const { valeurs, erreurs, changer, valider, reinitialiser } = useFormulaire(VIDE);

  function soumettre(e: FormEvent) {
    e.preventDefault();
    const s = valider(schemaSaisieInterlocuteur);
    if (s) ajouter.mutate(s, { onSuccess: () => reinitialiser(VIDE) });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Interlocuteurs</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {liste.isPending && <Chargement />}
        {liste.isError && <Erreur erreur={liste.error} reessayer={() => void liste.refetch()} />}
        {liste.isSuccess && liste.data.length === 0 && <Vide message="Aucun interlocuteur." />}
        {(ajouter.isError || supprimer.isError) && (
          <Alert variant="erreur">{messageErreur(ajouter.error ?? supprimer.error)}</Alert>
        )}
        <ul className="flex flex-col divide-y divide-border">
          {liste.data?.map((i) => (
            <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
              <span>
                <strong>{i.nom}</strong>
                {i.fonction && <span className="text-muted-foreground"> — {i.fonction}</span>}
                <span className="block text-muted-foreground">{[i.telephone, i.email].filter(Boolean).join(" · ")}</span>
              </span>
              {peutModifier && (
                <BoutonConfirme
                  libelle="Retirer"
                  question={`Retirer ${i.nom} ?`}
                  enCours={supprimer.isPending}
                  onConfirmer={() => supprimer.mutate(i.id)}
                />
              )}
            </li>
          ))}
        </ul>
        {peutModifier && (
          <form onSubmit={soumettre} noValidate className="grid gap-2 border-t border-border pt-3 sm:grid-cols-5">
            <ChampTexte libelle="Nom" valeur={valeurs.nom} onChange={(v) => changer("nom", v)} erreur={erreurs.nom} requis />
            <ChampTexte libelle="Fonction" valeur={valeurs.fonction} onChange={(v) => changer("fonction", v)} />
            <ChampTexte libelle="Téléphone" type="tel" valeur={valeurs.telephone} onChange={(v) => changer("telephone", v)} />
            <ChampTexte libelle="E-mail" type="email" valeur={valeurs.email} onChange={(v) => changer("email", v)} erreur={erreurs.email} />
            <div className="flex items-end">
              <Button type="submit" variant="secondary" disabled={ajouter.isPending}>
                Ajouter
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
