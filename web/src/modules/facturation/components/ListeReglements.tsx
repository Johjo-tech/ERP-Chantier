import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { BoutonConfirme } from "@/components/ui/confirmation";
import { formatDateFr } from "@/lib/dates";
import { messageErreur } from "@/lib/erreurs";
import { montant } from "@/lib/money";
import { formatEurosEcran, useModeDiscret } from "@/lib/modeDiscret";
import { usePermission } from "@/modules/auth-roles/hooks/useSession";
import type { Reglement } from "../api/factures";
import { libelleModeReglement } from "../domain/reglements";
import { useSupprimerReglement } from "../hooks/useFactures";
import { SaisieReglement } from "./SaisieReglement";

/**
 * L'historique des règlements d'une pièce, avec ✎ (corriger) et ✕ (retirer),
 * comme le dossier client de l'ancienne app (FAC-33). Les ponts d'une
 * imputation (modes « avoir » / « imputation ») se retirent, jamais ne se
 * corrigent : leurs deux moitiés doivent rester égales.
 */
export function ListeReglements({ factureId, totalDu, reglements, modeParDefaut }: { factureId: string; totalDu: number; reglements: readonly Reglement[]; modeParDefaut: string | null }) {
  useModeDiscret();
  const peutModifier = usePermission("reglements", "modifier");
  const peutSupprimer = usePermission("reglements", "supprimer");
  const retirer = useSupprimerReglement();
  const [enCours, setEnCours] = useState<string | null>(null);
  if (reglements.length === 0) return <p className="text-sm text-muted-foreground">Aucun règlement.</p>;
  const tries = [...reglements].sort((a, b) => b.date.localeCompare(a.date));
  return (
    <div className="flex flex-col gap-1">
      {retirer.isError && <Alert variant="erreur">{messageErreur(retirer.error)}</Alert>}
      <ul aria-label="Historique des règlements" className="divide-y divide-border text-sm">
        {tries.map((r) => (
          <li key={r.id} className="py-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span>
                {formatDateFr(r.date)} · {libelleModeReglement(r.mode)} {r.reference && `(${r.reference})`}
              </span>
              <span className="flex items-center gap-2">
                <span className="tabular-nums">{formatEurosEcran(montant(r.montant))}</span>
                {peutModifier && r.mode !== "avoir" && r.mode !== "imputation" && (
                  <Button size="sm" variant="ghost" aria-label={`Modifier le règlement du ${formatDateFr(r.date)}`} onClick={() => setEnCours(enCours === r.id ? null : r.id)}>✎</Button>
                )}
                {peutSupprimer && <BoutonConfirme libelle="Retirer" question="Retirer ce règlement ?" enCours={retirer.isPending} onConfirmer={() => retirer.mutate(r.id)} />}
              </span>
            </div>
            {enCours === r.id && <SaisieReglement factureId={factureId} totalDu={totalDu} reglements={reglements} modeParDefaut={modeParDefaut} enCours={r} fini={() => setEnCours(null)} />}
          </li>
        ))}
      </ul>
    </div>
  );
}
