import { Link, useNavigate, useParams } from "react-router";
import { Chargement, Erreur } from "@/components/etats/Etats";
import { EnTetePage } from "@/components/page/EnTetePage";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { BoutonConfirme } from "@/components/ui/confirmation";
import { formatDateFr } from "@/lib/dates";
import { messageErreur } from "@/lib/erreurs";
import { Can } from "@/modules/auth-roles/components/Can";
import { GardeSociete } from "@/modules/societes/components/GardeSociete";
import { pretEnCours } from "../domain/prets";
import { useMateriel, useSupprimerMateriel } from "../hooks/useMateriel";
import { BlocPretsMateriel } from "./BlocPretsMateriel";
import { Info } from "./Info";

export function PageFicheMateriel() {
  const { id } = useParams();
  const materiel = useMateriel(id);
  const supprimer = useSupprimerMateriel(id ?? "");
  const navigate = useNavigate();

  if (materiel.isPending) return <Chargement />;
  if (materiel.isError) return <Erreur erreur={materiel.error} reessayer={() => void materiel.refetch()} />;
  const m = materiel.data;

  return (
    <GardeSociete societeId={m.societe_id} retour="/materiel">
      <div className="flex flex-col gap-4">
        <Link to="/materiel" className="text-sm text-primary hover:underline">
          ← Retour au matériel
        </Link>
        <EnTetePage
          titre={m.nom}
          actions={
            <>
              <Can module="materiel" action="modifier">
                <Button asChild variant="outline">
                  <Link to={`/materiel/${m.id}/modifier`}>Modifier</Link>
                </Button>
              </Can>
              <Can module="materiel" action="supprimer">
                <BoutonConfirme
                  libelle="Supprimer"
                  question="Supprimer ce matériel et tout son historique de prêt ?"
                  enCours={supprimer.isPending}
                  onConfirmer={() => supprimer.mutate(undefined, { onSuccess: () => void navigate("/materiel") })}
                />
              </Can>
            </>
          }
        />
        {supprimer.isError && <Alert variant="erreur">{messageErreur(supprimer.error)}</Alert>}
        <Card>
          <CardContent className="pt-4">
            <dl className="grid gap-3 sm:grid-cols-5">
              <Info libelle="Catégorie">{m.categorie || "—"}</Info>
              <Info libelle="État général">{m.etat_general || "—"}</Info>
              <Info libelle="N° de série">{m.numero_serie || "—"}</Info>
              <Info libelle="Date d'achat">{formatDateFr(m.date_achat)}</Info>
              <Info libelle="Statut">{pretEnCours(m.prets) ? <Badge variant="alerte">En prêt</Badge> : <Badge variant="succes">Disponible</Badge>}</Info>
            </dl>
          </CardContent>
        </Card>
        <BlocPretsMateriel materiel={m} />
      </div>
    </GardeSociete>
  );
}
