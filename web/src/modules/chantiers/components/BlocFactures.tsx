import { Link } from "react-router";
import { Chargement, Erreur } from "@/components/etats/Etats";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateFr } from "@/lib/dates";
import { montant } from "@/lib/money";
import { formatEurosEcran } from "@/lib/modeDiscret";
import { usePermission } from "@/modules/auth-roles/hooks/useSession";
import { useFacturesDuChantier } from "../hooks/useFiche";

/** Même code couleur que l'ancien badge (app.js l. 14378). */
function variante(statut: string | null): BadgeVariant {
  if (statut === "payée") return "succes";
  if (statut === "impayée") return "danger";
  return "default";
}

/**
 * Les factures du chantier (CHA-12) : numéro, TTC (vue `v_facture_totaux`),
 * statut, et l'aperçu imprimable (PDF). Rien pour qui ne voit pas les factures.
 */
export function BlocFactures({ chantierId }: { chantierId: string }) {
  const autorise = usePermission("factures", "voir");
  const factures = useFacturesDuChantier(chantierId);
  if (!autorise) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Factures</CardTitle>
      </CardHeader>
      <CardContent>
        {factures.isPending && <Chargement />}
        {factures.isError && <Erreur erreur={factures.error} reessayer={() => void factures.refetch()} />}
        {factures.isSuccess && factures.data.length === 0 && <p className="text-sm text-muted-foreground">Aucune facture pour l'instant.</p>}
        <ul className="divide-y divide-border">
          {factures.data?.map((f) => (
            <li key={f.id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
              <Link to={`/factures/${f.id}`} className="font-medium text-primary hover:underline">
                {f.numero ?? "Brouillon"}
              </Link>
              <span className="text-muted-foreground">{formatDateFr(f.date)}</span>
              <span className="tabular-nums">{f.ttc == null ? "—" : `${formatEurosEcran(montant(f.ttc))} TTC`}</span>
              <Badge variant={variante(f.statut)}>{f.statut ?? "brouillon"}</Badge>
              <Button asChild size="sm" variant="outline" className="ml-auto">
                <Link to={`/factures/${f.id}/apercu`}>Imprimer / PDF</Link>
              </Button>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
