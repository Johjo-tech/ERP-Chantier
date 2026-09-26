import { Link } from "react-router";
import { Chargement, Erreur, Vide } from "@/components/etats/Etats";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateFr } from "@/lib/dates";
import { Can } from "@/modules/auth-roles/components/Can";
import { usePermission } from "@/modules/auth-roles/hooks/useSession";
import { useListeDevis } from "../hooks/useDevis";
import { BadgeStatutDevis } from "./BadgeStatutDevis";

/** Les devis d'un chantier ou d'un client, sur leur fiche. Rien pour qui ne voit pas les devis. */
/** `lienNouveau` : la fiche chantier y met client et lieu, pour un devis complémentaire prérempli (CHA-13). */
export function DevisLies({ chantierId, clientId, lienNouveau }: { chantierId?: string; clientId?: string; lienNouveau?: string }) {
  const autorise = usePermission("devis", "voir");
  if (!autorise) return null;
  return <Liste chantierId={chantierId} clientId={clientId} lienNouveau={lienNouveau} />;
}

function Liste({ chantierId, clientId, lienNouveau }: { chantierId?: string | undefined; clientId?: string | undefined; lienNouveau?: string | undefined }) {
  const filtre = chantierId ? { chantierId } : clientId ? { clientId } : {};
  const devis = useListeDevis(filtre);
  const nouveau = lienNouveau ?? (chantierId ? `/devis/nouveau?chantier=${chantierId}` : `/devis/nouveau?client=${clientId ?? ""}`);
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Devis</CardTitle>
        <Can module="devis" action="creer">
          <Button asChild size="sm" variant="secondary">
            <Link to={nouveau}>Nouveau devis</Link>
          </Button>
        </Can>
      </CardHeader>
      <CardContent>
        {devis.isPending && <Chargement />}
        {devis.isError && <Erreur erreur={devis.error} reessayer={() => void devis.refetch()} />}
        {devis.isSuccess && devis.data.length === 0 && <Vide message="Aucun devis." />}
        <ul className="divide-y divide-border">
          {devis.data?.map((d) => (
            <li key={d.id} className="flex items-center justify-between gap-2 py-2 text-sm">
              <Link to={`/devis/${d.id}`} className="font-medium text-primary hover:underline">
                {d.numero}
              </Link>
              <span className="text-muted-foreground">{formatDateFr(d.date)}</span>
              <BadgeStatutDevis statut={d.statut} />
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
