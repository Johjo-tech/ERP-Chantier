import { Chargement, Erreur } from "@/components/etats/Etats";
import { Alert } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { messageErreur } from "@/lib/erreurs";
import { usePermission } from "@/modules/auth-roles/hooks/useSession";
import { useDefinirFeriesAlsaceMoselle, useFeriesAlsaceMoselle } from "@/modules/societes/hooks/useFeries";
import { CaseACocher } from "./champs";

/**
 * Réglages › Organisation : la société est-elle en Alsace-Moselle (PLN-53) ?
 * Enregistré au clic : c'est une seule case, sans rapport avec le formulaire
 * d'identité au-dessus, qu'on ne veut pas obliger à revalider pour elle.
 */
export function BlocFeries() {
  const lu = useFeriesAlsaceMoselle();
  const definir = useDefinirFeriesAlsaceMoselle();
  const modifiable = usePermission("reglages", "modifier");
  return (
    <Card>
      <CardHeader>
        <CardTitle>Jours fériés</CardTitle>
        <p className="text-sm text-muted-foreground">Le planning grise les fériés nationaux. En Bas-Rhin, Haut-Rhin et Moselle, le droit local y ajoute le Vendredi saint et le 26 décembre.</p>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {lu.isPending ? (
          <Chargement />
        ) : lu.isError ? (
          <Erreur erreur={lu.error} reessayer={() => void lu.refetch()} />
        ) : (
          <CaseACocher
            libelle="Société établie en Alsace-Moselle (Vendredi saint et 26 décembre fériés)"
            coche={definir.isPending ? definir.variables : lu.data}
            desactive={!modifiable || definir.isPending}
            onChange={(v) => definir.mutate(v)}
          />
        )}
        {definir.isError && <Alert variant="erreur">{messageErreur(definir.error)}</Alert>}
        {definir.isSuccess && <Alert variant="succes">Réglage des jours fériés enregistré.</Alert>}
      </CardContent>
    </Card>
  );
}
