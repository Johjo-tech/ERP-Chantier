import { useState } from "react";
import { Chargement, Erreur } from "@/components/etats/Etats";
import { useSession } from "@/modules/auth-roles/hooks/useSession";
import type { Bon } from "../api/bons";
import { estSav } from "../domain/bon";
import { actionsTache, circuitTermine } from "../domain/circuit";
import { tachesTerminees } from "../domain/workflow";
import { useBons, useTaches, useTravaux } from "../hooks/useBons";
import { ActionsCircuit } from "./ActionsCircuit";
import { ModaleValidationConducteur } from "./ModaleValidationConducteur";
import { StepperBon } from "./StepperBon";
import { TachesDuBon } from "./TachesDuBon";
import { TravauxSupplementaires } from "./TravauxSupplementaires";

/**
 * Le « ✓ Valider (conducteur) » du stepper, ou pourquoi il n'est pas encore là
 * — le contexte « attente » de `bcWorkflowStepperHTML`.
 */
function GesteConducteur({ bon, onOuvrir }: { bon: Bon; onOuvrir: () => void }) {
  const { roleEffectif } = useSession();
  if (bon.circuit.valideConducteur || !actionsTache("realisee", roleEffectif).peutArbitrer) return null;
  if (!tachesTerminees(bon.circuit)) {
    return <div className="bc-attente-message">⏳ En attente — tous les métiers doivent être marqués comme réalisés par le technicien avant de pouvoir passer à la validation du conducteur.</div>;
  }
  return <button type="button" className="btn small primary" onClick={onOuvrir}>✓ Valider (conducteur)</button>;
}

/**
 * Le circuit d'un bon enregistré, sous son formulaire (D-ECR-BC-06), dans
 * l'habit de la carte dépliée de l'ancien : le stepper et son geste, le message
 * d'attente, les tâches et les travaux en `achat-row`, les boutons de la carte.
 * La validation conducteur s'ouvre dans sa fenêtre. Chaque geste recharge la
 * collection (BC-70) et se dit par un toast, comme dans l'ancien.
 */
export function PanneauCircuit({ bon }: { bon: Bon }) {
  const taches = useTaches(bon.id);
  const travaux = useTravaux(bon.id);
  const tous = useBons();
  const [conducteur, setConducteur] = useState(false);
  const facturee = bon.factures.length > 0;
  const clos = circuitTermine(bon, facturee);
  const sav = estSav(bon);
  const enAttente = !facturee && !sav && bon.statut_workflow !== "cloture_gratuit" && !bon.circuit.valideDirecteur;

  return (
    <div className="card" id="circuitBonCommande" style={{ marginTop: "16px" }}>
      <div className="section-title" style={{ marginTop: 0 }}>Circuit du bon</div>
      {!sav && <StepperBon bon={bon} actions={!clos && <GesteConducteur bon={bon} onOuvrir={() => setConducteur(true)} />} />}
      {enAttente && (
        <div className="bc-attente-message" style={{ marginTop: "8px" }}>
          ⏳ En attente — {bon.circuit.valideConducteur ? "la validation du directeur est requise" : "la validation du conducteur puis du directeur est requise"} avant de pouvoir facturer ce bon de commande.
        </div>
      )}
      {taches.isPending && <Chargement libelle="Chargement des tâches…" />}
      {taches.isError && <Erreur erreur={taches.error} reessayer={() => void taches.refetch()} />}
      {taches.isSuccess && <TachesDuBon bon={bon} taches={taches.data} circuitOuvert={!clos} />}
      {travaux.isError && <Erreur erreur={travaux.error} reessayer={() => void travaux.refetch()} />}
      {travaux.isSuccess && <TravauxSupplementaires bonId={bon.id} travaux={travaux.data} circuitOuvert={!clos} />}
      <ActionsCircuit bon={bon} tous={tous.data ?? []} />
      {conducteur && <ModaleValidationConducteur bon={bon} onFermer={() => setConducteur(false)} />}
    </div>
  );
}
