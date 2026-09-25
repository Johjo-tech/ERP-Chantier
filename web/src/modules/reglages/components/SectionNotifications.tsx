import { useState, type FormEvent } from "react";
import { Chargement, Erreur } from "@/components/etats/Etats";
import { ChampTexte } from "@/components/formulaire/Champ";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { usePermission } from "@/modules/auth-roles/hooks/useSession";
import { schemaNotifications, type ReglagesSociete } from "@/modules/societes/domain/reglages-societe";
import { useEnregistrerReglages, useReglagesSociete } from "@/modules/societes/hooks/useSocieteReglages";
import { CaseACocher, PiedEnregistrement } from "./champs";

/** Alertes d'échéance et destinataires des rappels. */
export function SectionNotifications() {
  const reglages = useReglagesSociete();
  const enregistrer = useEnregistrerReglages();
  if (reglages.isPending) return <Chargement />;
  if (reglages.isError) return <Erreur erreur={reglages.error} reessayer={() => void reglages.refetch()} />;
  return <FormulaireNotifications key={JSON.stringify(reglages.data.notifications)} reglages={reglages.data} enregistrer={enregistrer} />;
}

function FormulaireNotifications({ reglages, enregistrer }: { reglages: ReglagesSociete; enregistrer: ReturnType<typeof useEnregistrerReglages> }) {
  const modifiable = usePermission("reglages", "modifier");
  const [actives, setActives] = useState(reglages.notifications.actives);
  const [destinataires, setDestinataires] = useState(reglages.notifications.destinataires);
  const [erreur, setErreur] = useState<string | undefined>();

  function soumettre(e: FormEvent) {
    e.preventDefault();
    const r = schemaNotifications.safeParse({ actives, destinataires });
    if (!r.success) return setErreur(r.error.issues[0]?.message);
    setErreur(undefined);
    enregistrer.mutate((x) => ({ ...x, notifications: r.data }));
  }

  return (
    <form onSubmit={soumettre} noValidate>
      <Card>
        <CardHeader>
          <CardTitle>Notifications</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <CaseACocher libelle="Afficher les alertes d'échéance" coche={actives} onChange={setActives} desactive={!modifiable} />
          <ChampTexte
            libelle="Destinataires des rappels (e-mails séparés par des virgules)"
            valeur={destinataires}
            onChange={setDestinataires}
            erreur={erreur}
            placeholder="conducteur@exemple.fr, rh@exemple.fr"
            desactive={!modifiable}
          />
          <PiedEnregistrement modifiable={modifiable} enCours={enregistrer.isPending} erreur={enregistrer.error} succes={enregistrer.isSuccess ? "Notifications enregistrées." : null} />
        </CardContent>
      </Card>
    </form>
  );
}
