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
import { Info } from "@/modules/materiel/components/Info";
import { nomPersonne } from "@/modules/materiel/domain/prets";
import { usePersonnes } from "@/modules/materiel/hooks/useMateriel";
import { GardeSociete } from "@/modules/societes/components/GardeSociete";
import { useReglagesSociete } from "@/modules/societes/hooks/useSocieteReglages";
import { etiquetteEcheance } from "../domain/echeances";
import { formatKm, libelleType, libelleVehicule, type Vehicule } from "../domain/vehicule";
import { useSupprimerVehicule, useVehicule } from "../hooks/useVehicules";
import { BlocAbonnements } from "./BlocAbonnements";
import { BlocDocuments } from "./BlocDocuments";
import { BlocEntretiens } from "./BlocEntretiens";
import { BlocPretsVehicule } from "./BlocPretsVehicule";

function Identite({ v }: { v: Vehicule }) {
  const personnes = usePersonnes();
  const reglages = useReglagesSociete();
  const conducteur = (personnes.data ?? []).find((p) => p.id === v.conducteur_salarie_id);
  const seuil = reglages.data?.seuils.vehiculeControle;
  const ct = seuil === undefined ? null : etiquetteEcheance(v.date_controle_technique, seuil, v.vendu);
  return (
    <Card>
      <CardContent className="pt-4">
        <dl className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <Info libelle="Type">{libelleType(v.type_vehicule) || "—"}</Info>
          <Info libelle="Conducteur attitré">{conducteur ? nomPersonne(conducteur) : "Sans conducteur"}</Info>
          <Info libelle="Immatriculation">{v.immatriculation || "—"}</Info>
          <Info libelle="TVA">{v.tva_applicable === false ? "Sans TVA" : "Avec TVA"}</Info>
          <Info libelle="Motorisation">{v.motorisation || "—"}</Info>
          <Info libelle="Taille de pneus">{v.taille_pneus || "—"}</Info>
          <Info libelle="Kilométrage">{formatKm(v.kilometrage)}</Info>
          <Info libelle="Date d'achat">{formatDateFr(v.date_achat)}</Info>
          <Info libelle="Contrôle technique">
            {formatDateFr(v.date_controle_technique)}{" "}
            {ct && <Badge variant={ct.niveau === "danger" ? "danger" : "alerte"}>{ct.niveau === "danger" ? "Expiré" : "Bientôt"}</Badge>}
          </Info>
          <Info libelle="Statut">{v.vendu ? <Badge variant="neutre">Vendu</Badge> : <Badge variant="succes">En service</Badge>}</Info>
        </dl>
      </CardContent>
    </Card>
  );
}

/** La fiche d'un véhicule (VEH-01) : identité, pièces, abonnements, vente, prêts, entretiens. */
export function PageFicheVehicule() {
  const { id } = useParams();
  const vehicule = useVehicule(id);
  const supprimer = useSupprimerVehicule(id ?? "");
  const navigate = useNavigate();

  if (vehicule.isPending) return <Chargement />;
  if (vehicule.isError) return <Erreur erreur={vehicule.error} reessayer={() => void vehicule.refetch()} />;
  const v = vehicule.data;

  return (
    <GardeSociete societeId={v.societe_id} retour="/vehicules">
      <div className="flex flex-col gap-4">
        <Link to="/vehicules" className="text-sm text-primary hover:underline">
          ← Retour aux véhicules
        </Link>
        <EnTetePage
          titre={libelleVehicule(v)}
          actions={
            <>
              <Can module="vehicules" action="modifier">
                <Button asChild variant="outline">
                  <Link to={`/vehicules/${v.id}/modifier`}>Modifier</Link>
                </Button>
              </Can>
              <Can module="vehicules" action="supprimer">
                <BoutonConfirme
                  libelle="Supprimer"
                  question="Supprimer ce véhicule, ses prêts, ses entretiens et ses documents ?"
                  enCours={supprimer.isPending}
                  onConfirmer={() => supprimer.mutate(undefined, { onSuccess: () => void navigate("/vehicules") })}
                />
              </Can>
            </>
          }
        />
        {supprimer.isError && <Alert variant="erreur">{messageErreur(supprimer.error)}</Alert>}
        <Identite v={v} />
        <div className="grid gap-4 lg:grid-cols-2">
          <BlocDocuments vehicule={v} />
          <BlocAbonnements vehicule={v} />
        </div>
        <BlocPretsVehicule vehicule={v} />
        <BlocEntretiens vehicule={v} />
      </div>
    </GardeSociete>
  );
}
