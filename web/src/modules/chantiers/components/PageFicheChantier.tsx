import type { ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { Chargement, Erreur } from "@/components/etats/Etats";
import { EnTetePage } from "@/components/page/EnTetePage";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { BoutonConfirme } from "@/components/ui/confirmation";
import { formatDateFr } from "@/lib/dates";
import { messageErreur } from "@/lib/erreurs";
import { Can } from "@/modules/auth-roles/components/Can";
import type { Chantier } from "../domain/chantier";
import { useChantier, usePeutVoirDpgf, useSupprimerChantier } from "../hooks/useChantiers";
import { BlocDpgf } from "./BlocDpgf";

interface Props {
  /** Sections apportées par d'autres modules (devis du chantier, situations…), composées dans app/. */
  complements?: (c: Chantier) => ReactNode;
  actionsDpgf?: (c: Chantier) => ReactNode;
}

export function PageFicheChantier({ complements, actionsDpgf }: Props) {
  const { id } = useParams();
  const chantier = useChantier(id);
  const supprimer = useSupprimerChantier();
  const voitDpgf = usePeutVoirDpgf();
  const navigate = useNavigate();

  if (chantier.isPending) return <Chargement />;
  if (chantier.isError) return <Erreur erreur={chantier.error} reessayer={() => void chantier.refetch()} />;
  const c = chantier.data;

  return (
    <div className="flex flex-col gap-4">
      <EnTetePage
        titre={c.nom}
        sousTitre={
          <>
            {c.client_id ? (
              <Link to={`/clients/${c.client_id}`} className="text-primary hover:underline">
                {c.client_nom}
              </Link>
            ) : (
              c.client_nom || "Sans client"
            )}
            {c.type && ` · ${c.type}`}
          </>
        }
        actions={
          <>
            <Can module="chantiers" action="modifier">
              <Button asChild variant="outline">
                <Link to={`/chantiers/${c.id}/modifier`}>Modifier</Link>
              </Button>
            </Can>
            <Can module="chantiers" action="supprimer">
              <BoutonConfirme
                libelle="Supprimer"
                question="Supprimer ce chantier et son DPGF ?"
                enCours={supprimer.isPending}
                onConfirmer={() => supprimer.mutate(c.id, { onSuccess: () => void navigate("/chantiers") })}
              />
            </Can>
          </>
        }
      />
      {supprimer.isError && <Alert variant="erreur">{messageErreur(supprimer.error)}</Alert>}
      <Card>
        <CardContent className="grid gap-3 pt-4 sm:grid-cols-3">
          <div>
            <p className="text-xs text-muted-foreground">Adresse</p>
            <p className="text-sm">{[c.adresse, [c.code_postal, c.ville].filter(Boolean).join(" ")].filter(Boolean).join(", ") || "—"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Période</p>
            <p className="text-sm">
              {formatDateFr(c.date_debut)} → {formatDateFr(c.date_fin)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Conducteur</p>
            <p className="text-sm">{c.conducteur || "—"}</p>
          </div>
          {c.infos_diverses && <p className="whitespace-pre-line text-sm text-muted-foreground sm:col-span-3">{c.infos_diverses}</p>}
        </CardContent>
      </Card>
      {voitDpgf && <BlocDpgf chantierId={c.id} actions={actionsDpgf?.(c)} />}
      {complements?.(c)}
    </div>
  );
}
