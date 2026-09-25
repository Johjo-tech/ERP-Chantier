import { useState } from "react";
import { Input } from "@/components/ui/input";
import type { CartePlanning } from "../domain/cartes";
import { useMontantSousTraitant } from "../hooks/usePlanning";
import { usePlanningContexte } from "./contexte";

/**
 * Le prix convenu avec le sous-traitant (HT), saisi sur sa carte dans la vue
 * sous-traitant — repris sur sa facture pré-remplie. Seulement pour qui voit
 * les prix et planifie ; le sous-traitant, lui, lit « Votre montant ».
 */
export function MontantSousTraitant({ carte }: { carte: CartePlanning }) {
  const { affectation, peutPlanifier, voitPrix, signaler } = usePlanningContexte();
  const initial = carte.bon.montant_sous_traitant === null ? "" : String(carte.bon.montant_sous_traitant);
  const [valeur, setValeur] = useState(initial);
  const enregistrer = useMontantSousTraitant();
  if (affectation !== "sous_traitant" || !peutPlanifier || !voitPrix) return null;
  return (
    <label className="flex items-center gap-1 text-[11px]" onClick={(e) => e.stopPropagation()}>
      💶 Prix sous-traitant
      <Input
        type="text"
        inputMode="decimal"
        className="h-7 w-24 px-1 text-xs"
        value={valeur}
        onChange={(e) => setValeur(e.target.value)}
        onBlur={() => {
          if (valeur === initial) return;
          enregistrer.mutate(
            { bcId: carte.bcId, valeur: valeur.trim() || null },
            { onSuccess: () => signaler("Prix sous-traitant enregistré."), onError: (e) => signaler("", e) }
          );
        }}
      />
      € HT
    </label>
  );
}
