import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { messageErreur } from "@/lib/erreurs";
import { montant } from "@/lib/money";
import { formatEurosEcran } from "@/lib/modeDiscret";
import { usePermission } from "@/modules/auth-roles/hooks/useSession";
import type { Solde } from "../domain/solde";
import { useReglementsFacture } from "../hooks/useFactures";
import { avoirsImputables } from "../domain/lettrage";
import { FormulaireImputation } from "./FormulaireImputation";
import { ListeReglements } from "./ListeReglements";
import { SaisieReglement } from "./SaisieReglement";

/**
 * Règlements d'une facture émise : le solde vient de la base (`v_facture_solde`),
 * l'ajout est contrôlé (jamais au-delà du reste), l'historique se corrige ✎ ou
 * se retire ✕, et un avoir du même client peut la solder (FAC-22).
 */
export function BlocReglements({ solde, soldes, modeParDefaut }: { solde: Solde; soldes: readonly Solde[]; modeParDefaut: string | null }) {
  const { reglements, chargement } = useReglementsFacture(solde.facture_id);
  const peutCreer = usePermission("reglements", "creer");
  const [parAvoir, setParAvoir] = useState(false);
  // Ce que la facture doit en tout : TTC − acomptes déduits (la retenue de garantie reste due).
  const totalDu = Number(montant(solde.ttc).minus(montant(solde.acomptes)).toString());
  const retenueNonEchue = solde.retenue > 0 && solde.reste_exigible === 0 && solde.reste > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Règlements</CardTitle>
        <p className="text-sm text-muted-foreground">
          Réglé {formatEurosEcran(montant(solde.paye))} sur {formatEurosEcran(montant(totalDu))} — reste dû {formatEurosEcran(montant(solde.reste))}
        </p>
        {retenueNonEchue && <p className="text-sm text-muted-foreground">Le reste est la retenue de garantie : due à sa levée, elle ne met pas la facture en retard.</p>}
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {chargement.isError && <Alert variant="erreur">{messageErreur(chargement.error)}</Alert>}
        <ListeReglements factureId={solde.facture_id} totalDu={totalDu} reglements={reglements} modeParDefaut={modeParDefaut} />
        {peutCreer && solde.du > 0 && (
          <>
            <SaisieReglement factureId={solde.facture_id} totalDu={totalDu} reglements={reglements} modeParDefaut={modeParDefaut} />
            {!parAvoir && avoirsImputables(solde, soldes).length > 0 && (
              <Button variant="outline" className="self-start" onClick={() => setParAvoir(true)}>Régler par un avoir</Button>
            )}
            {parAvoir && <FormulaireImputation facture={solde} soldes={soldes} fermer={() => setParAvoir(false)} />}
          </>
        )}
      </CardContent>
    </Card>
  );
}
