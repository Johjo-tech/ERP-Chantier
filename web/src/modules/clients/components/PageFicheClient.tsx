import { Link, useNavigate, useParams } from "react-router";
import { Chargement, Erreur } from "@/components/etats/Etats";
import { EnTetePage } from "@/components/page/EnTetePage";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BoutonConfirme } from "@/components/ui/confirmation";
import { messageErreur } from "@/lib/erreurs";
import { Can } from "@/modules/auth-roles/components/Can";
import { libelleCadre, type Client } from "../domain/client";
import { delaiPaiementRetenu, libelleDelaiPaiement } from "../domain/delais";
import { useClient, useSupprimerClient } from "../hooks/useClients";
import { BlocInterlocuteurs } from "./BlocInterlocuteurs";

function Ligne({ libelle, valeur }: { libelle: string; valeur: string | null | undefined }) {
  return (
    <div className="flex flex-col">
      <dt className="text-xs text-muted-foreground">{libelle}</dt>
      <dd className="text-sm">{valeur || "—"}</dd>
    </div>
  );
}

export function PageFicheClient({ complements }: { complements?: (client: Client) => React.ReactNode }) {
  const { id } = useParams();
  const client = useClient(id);
  const supprimer = useSupprimerClient();
  const navigate = useNavigate();

  if (client.isPending) return <Chargement />;
  if (client.isError) return <Erreur erreur={client.error} reessayer={() => void client.refetch()} />;
  const c = client.data;
  // Sans délai propre, la fiche montre le délai qui s'appliquera réellement.
  const delai = c.delai_paiement_jours == null ? "Celui de la société" : libelleDelaiPaiement(delaiPaiementRetenu(c));

  return (
    <div className="flex flex-col gap-4">
      <EnTetePage
        titre={c.nom}
        sousTitre={libelleCadre(c.cadre_facturation)}
        actions={
          <>
            <Can module="clients" action="modifier">
              <Button asChild variant="outline">
                <Link to={`/clients/${c.id}/modifier`}>Modifier</Link>
              </Button>
            </Can>
            <Can module="clients" action="supprimer">
              <BoutonConfirme
                libelle="Supprimer"
                question="Supprimer définitivement ce client ?"
                enCours={supprimer.isPending}
                onConfirmer={() => supprimer.mutate(c.id, { onSuccess: () => void navigate("/clients") })}
              />
            </Can>
          </>
        }
      />
      {supprimer.isError && <Alert variant="erreur">{messageErreur(supprimer.error)}</Alert>}
      <Card>
        <CardHeader>
          <CardTitle>Fiche</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-3 sm:grid-cols-3">
            <Ligne libelle="Adresse" valeur={[c.adresse, [c.code_postal, c.ville].filter(Boolean).join(" ")].filter(Boolean).join(", ")} />
            <Ligne libelle="Téléphone" valeur={c.telephone} />
            <Ligne libelle="E-mail" valeur={c.email} />
            <Ligne libelle="SIRET" valeur={c.siret} />
            <Ligne libelle="TVA intracommunautaire" valeur={c.tva_intracom} />
            <Ligne libelle="Délai de paiement" valeur={delai} />
          </dl>
          {c.notes && <p className="mt-3 whitespace-pre-line text-sm text-muted-foreground">{c.notes}</p>}
        </CardContent>
      </Card>
      <BlocInterlocuteurs clientId={c.id} />
      {complements?.(c)}
    </div>
  );
}
