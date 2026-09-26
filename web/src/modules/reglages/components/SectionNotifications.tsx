import { useState, type FormEvent } from "react";
import { Chargement, Erreur } from "@/components/etats/Etats";
import { ChampTexte } from "@/components/formulaire/Champ";
import { usePermission } from "@/modules/auth-roles/hooks/useSession";
import { schemaNotifications, type ReglagesSociete } from "@/modules/societes/domain/reglages-societe";
import { useEnregistrerReglages, useReglagesSociete } from "@/modules/societes/hooks/useSocieteReglages";
import { PiedEnregistrement } from "./champs";

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
    <form className="card" onSubmit={soumettre} noValidate>
      <div className="card-title" style={{ marginBottom: "10px" }}>
        🔔 Notifications
      </div>
      <div className="field-grid">
        <div className="field full">
          <label style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <input type="checkbox" id="rg_notifActives" checked={actives} disabled={!modifiable} onChange={(e) => setActives(e.target.checked)} /> Afficher les alertes d&apos;échéance
          </label>
        </div>
        <ChampTexte
          className="full"
          libelle="Destinataires des rappels (emails séparés par des virgules)"
          valeur={destinataires}
          onChange={setDestinataires}
          erreur={erreur}
          placeholder="conducteur@exemple.fr, rh@exemple.fr"
          desactive={!modifiable}
        />
      </div>
      <PiedEnregistrement modifiable={modifiable} enCours={enregistrer.isPending} erreur={enregistrer.error} succes={enregistrer.isSuccess ? "Préférences enregistrées." : null} />
    </form>
  );
}
