import { Link } from "react-router";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateFr } from "@/lib/dates";
import type { AlerteVehicule } from "../domain/echeances";

/**
 * Les échéances proches du parc : ce que la cloche de l'ancien écran annonçait
 * (cartes), plus le contrôle technique et les documents qui expirent. Rien
 * à dire → rien d'affiché.
 */
export function BlocEcheances({ alertes }: { alertes: readonly AlerteVehicule[] }) {
  if (!alertes.length) return null;
  return (
    <Card className="mb-4">
      <CardHeader>
        <CardTitle>Échéances à surveiller ({alertes.length})</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col gap-1 text-sm" aria-label="Échéances à surveiller">
          {alertes.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center gap-2">
              <Badge variant={a.niveau === "danger" ? "danger" : "alerte"}>{a.jours < 0 ? "Expiré" : `Dans ${a.jours} j`}</Badge>
              <Link to={`/vehicules/${a.vehiculeId}`} className="text-primary hover:underline">
                {a.libelle}
              </Link>
              <span className="text-xs text-muted-foreground">({formatDateFr(a.echeance)})</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
