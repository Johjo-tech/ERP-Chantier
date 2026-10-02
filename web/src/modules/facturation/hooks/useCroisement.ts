import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { formatEuros, montant, enDecimal2 } from "@/lib/money";
import { montantsCherchables } from "@/lib/recherche";
import { usePermission, useSocieteActive } from "@/modules/auth-roles/hooks/useSession";
import { listerBons } from "@/modules/commandes/api/bons";
import { clesBons } from "@/modules/commandes/hooks/useBons";
import { listerFactures } from "../api/factures";
import { soldesDesFactures } from "../api/soldes";
import { apportsDeLaFacture, apportsDuBon, bonsDeLaFacture, construireIndex, facturesDuBon, type Apport, type BonRapprochable, type FactureRapprochable } from "../domain/croisement";
import { clesFactures } from "./useFactures";

const montantsEnApports = (valeurs: readonly string[]): Apport[] => valeurs.map((valeur) => ({ etiquette: "Montant", valeur }));

export interface Croisement {
  /** Ce qu'une facture apporte à la recherche : ses montants, puis ce que disent ses bons. */
  apportsFacture: (f: FactureRapprochable) => Apport[];
  /** Ce qu'un bon apporte : son montant, puis ce que disent ses factures. */
  apportsBon: (b: BonRapprochable & { montant?: number | null }) => Apport[];
}

/**
 * Le croisement facture ↔ bon (TRV-07) pour les deux listes. Chaque côté
 * n'est lu que si le rôle ouvre son écran : à défaut, la recherche se passe
 * de l'autre côté plutôt que d'échouer. Mêmes clés de cache que les listes.
 */
export function useCroisement(): Croisement {
  const s = useSocieteActive();
  const voitFactures = usePermission("factures");
  const voitBons = usePermission("bons_commande");
  const factures = useQuery({ queryKey: clesFactures.liste(s.id, {}), queryFn: () => listerFactures(s.id, {}), enabled: voitFactures });
  const soldes = useQuery({ queryKey: clesFactures.soldes(s.id), queryFn: () => soldesDesFactures(s.id), enabled: voitFactures });
  const bons = useQuery({ queryKey: clesBons.liste(s.id), queryFn: () => listerBons(s.id), enabled: voitBons });

  return useMemo(() => {
    const index = construireIndex(factures.data ?? [], bons.data ?? []);
    const ttc = new Map((soldes.data ?? []).map((x) => [x.facture_id, x.ttc]));
    const montantsFacture = (id: string) => {
      const t = ttc.get(id);
      return t === undefined ? [] : montantsCherchables(montant(t));
    };
    return {
      apportsFacture: (f) => [...montantsEnApports(montantsFacture(f.id)), ...bonsDeLaFacture(f, index).flatMap(apportsDuBon)],
      apportsBon: (b) => [
        ...(b.montant === null || b.montant === undefined ? [] : montantsEnApports([formatEuros(montant(b.montant)), enDecimal2(montant(b.montant))])),
        ...facturesDuBon(b, index).flatMap((f) => apportsDeLaFacture(f, b, montantsFacture(f.id))),
      ],
    };
  }, [factures.data, soldes.data, bons.data]);
}
