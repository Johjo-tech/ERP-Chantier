import { Link } from "react-router";
import { ChampChoix, ChampTexte } from "@/components/formulaire/Champ";
import { formatDateFr } from "@/lib/dates";
import { usePermission } from "@/modules/auth-roles/hooks/useSession";
import { useListeDevis } from "@/modules/devis/hooks/useDevis";
import { facturationRenseignee, type ValeursBon } from "../domain/bon";

interface Props {
  valeurs: ValeursBon;
  changer: (champ: keyof ValeursBon, v: string) => void;
  lectureSeule: boolean;
}

/** Le devis dont le bon découle : ses chapitres préremplissent les montants par métier (BC-05, BC-11). */
function DevisLie({ valeurs, changer, lectureSeule }: Props) {
  const devis = useListeDevis(valeurs.client_id ? { clientId: valeurs.client_id } : {});
  if (!valeurs.client_id) return <p className="text-xs text-muted-foreground sm:col-span-3">Choisissez d'abord le client pour lier un de ses devis.</p>;
  const options = (devis.data ?? []).map((d) => ({ valeur: d.id, libelle: `${d.numero ?? "Brouillon"} — ${formatDateFr(d.date)}${d.adresse_locataire ? ` — ${d.adresse_locataire}` : ""}` }));
  // Un devis lié qui n'est plus dans la liste (autre client, supprimé) reste affiché plutôt que de disparaître en silence.
  if (valeurs.devis_id && !options.some((o) => o.valeur === valeurs.devis_id)) options.unshift({ valeur: valeurs.devis_id, libelle: "Devis lié (hors de la liste du client)" });
  return (
    <div className="flex items-end gap-2 sm:col-span-2">
      <ChampChoix className="flex-1" libelle="Devis lié" valeur={valeurs.devis_id} onChange={(v) => changer("devis_id", v)} desactive={lectureSeule} options={[{ valeur: "", libelle: "— Aucun —" }, ...options]} />
      {valeurs.devis_id && <Link to={`/devis/${valeurs.devis_id}`} className="pb-2 text-sm text-primary hover:underline">Voir le devis</Link>}
    </div>
  );
}

/**
 * L'adresse de facturation, quand ce n'est pas le siège du client :
 * `bc_generer_facture` la recopie dans `factures.facturation_*`, que la
 * facture électronique lit avant l'adresse du client. Repliée tant qu'elle est
 * vide, dépliée d'office dès qu'elle porte quelque chose (BC-05).
 */
function FacturationDifferente({ valeurs, changer, lectureSeule }: Props) {
  const t = (champ: keyof ValeursBon, libelle: string) => <ChampTexte libelle={libelle} valeur={valeurs[champ]} onChange={(v) => changer(champ, v)} desactive={lectureSeule} />;
  return (
    <details className="rounded-md border p-3 sm:col-span-3" open={facturationRenseignee(valeurs)}>
      <summary className="cursor-pointer text-sm font-medium">Adresse de facturation différente</summary>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <div className="sm:col-span-3">{t("facturation_adresse", "Adresse de facturation")}</div>
        {t("facturation_code_postal", "Code postal de facturation")}
        {t("facturation_ville", "Ville de facturation")}
      </div>
    </details>
  );
}

export function SectionDevisFacturation(props: Props) {
  const voitDevis = usePermission("devis");
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {voitDevis && <DevisLie {...props} />}
      <FacturationDifferente {...props} />
    </div>
  );
}
