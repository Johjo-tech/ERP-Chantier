import { montant } from "@/lib/money";
import { formatEurosEcran, useModeDiscret } from "@/lib/modeDiscret";
import { afficherToast } from "@/lib/toast";
import { messageErreur } from "@/lib/erreurs";
import type { CartePlanning } from "../domain/cartes";
import { useMontantSousTraitant } from "../hooks/usePlanning";
import { usePlanningContexte } from "./contexte";

const DUREE_TOAST_PRIX_MS = 1800;

/**
 * Le prix convenu avec le sous-traitant (HT), dans la vue sous-traitant
 * (`planningPrixSTZoneHTML`) — repris sur sa facture pré-remplie. Le
 * sous-traitant lit « Votre montant » (le sien, jamais celui du bon) ; qui
 * planifie et voit les prix le saisit.
 */
export function MontantSousTraitant({ carte }: { carte: CartePlanning }) {
  useModeDiscret();
  const { affectation, peutPlanifier, voitPrix, role, donnees } = usePlanningContexte();
  const enregistrer = useMontantSousTraitant();
  if (affectation !== "sous_traitant") return null;
  if (role === "sous_traitant") {
    const sien = donnees.montantsSousTraitant[carte.bcId];
    return sien != null ? (
      <div className="planning-card-sub" style={{ fontWeight: 700, color: "var(--success)" }}>💶 Votre montant : {formatEurosEcran(montant(sien))} HT</div>
    ) : (
      <div className="planning-card-sub" style={{ color: "var(--text-dim)" }}>💶 Montant en cours de définition</div>
    );
  }
  if (!peutPlanifier || !voitPrix) return null;
  const initial = carte.bon.montant_sous_traitant === null ? "" : String(carte.bon.montant_sous_traitant);
  return (
    <div className="planning-prix-st" onClick={(e) => e.stopPropagation()}>
      💶{" "}
      <input
        type="number"
        min="0"
        step="0.01"
        defaultValue={initial}
        placeholder="Prix ST €"
        aria-label="Prix sous-traitant"
        title="Montant convenu avec le sous-traitant (HT) — repris sur sa facture pré-remplie"
        // L'événement `change` natif de l'ancien part à la validation du champ, pas à chaque frappe.
        onBlur={(e) =>
          e.target.value !== initial &&
          enregistrer.mutate(
            { bcId: carte.bcId, valeur: e.target.value.trim() || null },
            { onSuccess: () => afficherToast("💶 Prix sous-traitant enregistré", "success", DUREE_TOAST_PRIX_MS), onError: (err) => afficherToast(messageErreur(err)) }
          )
        }
      />{" "}
      € HT
    </div>
  );
}
