import { useState } from "react";
import { Chargement, Erreur } from "@/components/etats/Etats";
import { Alert } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { messageErreur } from "@/lib/erreurs";
import { useSession } from "@/modules/auth-roles/hooks/useSession";
import type { Bon } from "../api/bons";
import { estSav } from "../domain/bon";
import { actionsTache, attenteAvantChiffrage, circuitTermine } from "../domain/circuit";
import { etapeValidation } from "../domain/workflow";
import { useBons, useTaches, useTravaux } from "../hooks/useBons";
import { ActionsCircuit } from "./ActionsCircuit";
import { StepperBon } from "./StepperBon";
import { TachesDuBon } from "./TachesDuBon";
import { TravauxSupplementaires } from "./TravauxSupplementaires";
import { ValidationConducteur } from "./ValidationConducteur";

/**
 * Le circuit d'un bon enregistré, sous son formulaire : où il en est, ce que
 * le terrain a pointé, ce que le conducteur arbitre, ce qui a été constaté en
 * plus, et le geste suivant. Chaque geste recharge la collection (BC-70).
 */
export function PanneauCircuit({ bon }: { bon: Bon }) {
  const { roleEffectif } = useSession();
  const taches = useTaches(bon.id);
  const travaux = useTravaux(bon.id);
  const tous = useBons();
  const [resultat, setResultat] = useState<{ message: string; erreur?: unknown } | null>(null);
  const onResultat = (message: string, erreur?: unknown) => setResultat({ message, erreur });
  const clos = circuitTermine(bon, bon.factures.length > 0);
  const attente = attenteAvantChiffrage(etapeValidation(bon.circuit), bon.circuit.tachesNonPointees);
  const arbitre = actionsTache("realisee", roleEffectif).peutArbitrer;

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 pt-4">
        <h2 className="text-base font-semibold">Circuit du bon</h2>
        {!estSav(bon) && <StepperBon bon={bon} />}
        {attente && <p className="text-sm text-muted-foreground">⏳ {attente}</p>}
        {resultat && <Alert variant={resultat.erreur ? "erreur" : "succes"}>{resultat.erreur ? messageErreur(resultat.erreur) : resultat.message}</Alert>}
        {taches.isPending && <Chargement libelle="Chargement des tâches…" />}
        {taches.isError && <Erreur erreur={taches.error} reessayer={() => void taches.refetch()} />}
        {taches.isSuccess && (
          <>
            <TachesDuBon bon={bon} taches={taches.data} circuitOuvert={!clos} onResultat={onResultat} />
            {arbitre && !clos && !bon.circuit.valideConducteur && <ValidationConducteur bon={bon} taches={taches.data} onResultat={onResultat} />}
          </>
        )}
        {travaux.isError && <Erreur erreur={travaux.error} reessayer={() => void travaux.refetch()} />}
        {travaux.isSuccess && <TravauxSupplementaires bonId={bon.id} travaux={travaux.data} circuitOuvert={!clos} onResultat={onResultat} />}
        <ActionsCircuit bon={bon} tous={tous.data ?? []} onResultat={onResultat} />
      </CardContent>
    </Card>
  );
}
