import { useState } from "react";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { formatDateFr, todayISO } from "@/lib/dates";
import { formatEuros, montant } from "@/lib/money";
import { usePermission } from "@/modules/auth-roles/hooks/useSession";
import type { Reglement } from "../api/factures";
import { libelleDelai } from "../domain/etat";
import { avoirsImputables } from "../domain/lettrage";
import { etatDepuisSolde, type Solde } from "../domain/solde";
import { BadgeEtat } from "./BadgeEtat";
import { FormulaireImputation } from "./FormulaireImputation";
import { ListeReglements } from "./ListeReglements";
import { SaisieReglement } from "./SaisieReglement";

interface Props {
  piece: Solde;
  soldes: readonly Solde[];
  reglements: readonly Reglement[];
  coche: boolean;
  basculer: () => void;
}

/**
 * Une pièce du dossier client (FAC-33, app.js l. 11066). « Payable » : on peut
 * y poser un encaissement ; un avoir a un reste, mais c'est un CRÉDIT — il se
 * coche pour être lettré, jamais ne s'encaisse ni n'est « en retard ».
 */
export function CartePieceDossier({ piece, soldes, reglements, coche, basculer }: Props) {
  const peutCreer = usePermission("reglements", "creer");
  const [saisie, setSaisie] = useState<"reglement" | "avoir" | null>(null);
  const avoir = piece.sens < 0;
  const payable = !avoir && piece.du > 0.01;
  const lettrable = avoir && piece.credit > 0.01;
  const etat = etatDepuisSolde(piece);
  const delai = libelleDelai(etat, piece.echeance || piece.date, todayISO());
  const totalDu = Number(montant(piece.ttc).minus(montant(piece.acomptes)).toString());

  return (
    <li className="flex flex-col gap-2 p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <span className="flex items-start gap-2">
          {payable || lettrable ? (
            <input
              type="checkbox"
              className="mt-1 size-4"
              checked={coche}
              onChange={basculer}
              aria-label={lettrable ? `Cocher l'avoir ${piece.numero} pour le lettrer` : `Cocher la facture ${piece.numero} pour un règlement groupé`}
            />
          ) : (
            <span className="w-4" />
          )}
          <span>
            <Link className="font-medium text-primary hover:underline" to={`/factures/${piece.facture_id}`}>{piece.numero}</Link>
            <span className="block text-sm text-muted-foreground">{formatDateFr(piece.date)}{piece.echeance ? ` · échéance ${formatDateFr(piece.echeance)}` : ""}</span>
          </span>
        </span>
        <span className="flex flex-col items-end gap-1">
          <span className="tabular-nums">{formatEuros(montant(piece.ttc).times(piece.sens))}</span>
          <BadgeEtat etat={etat} />
        </span>
      </div>
      <p className="text-sm text-muted-foreground">
        {avoir ? `Imputé : ${formatEuros(montant(piece.paye))} · Disponible : ${formatEuros(montant(piece.credit))}` : `Réglé : ${formatEuros(montant(piece.paye))} · Reste : ${formatEuros(montant(piece.reste))}`}
        {delai && ` · ${delai}`}
      </p>
      {peutCreer && payable && (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => setSaisie(saisie === "reglement" ? null : "reglement")}>+ Règlement</Button>
          {avoirsImputables(piece, soldes).length > 0 && <Button size="sm" variant="outline" onClick={() => setSaisie(saisie === "avoir" ? null : "avoir")}>Régler par un avoir</Button>}
        </div>
      )}
      {saisie === "reglement" && <SaisieReglement factureId={piece.facture_id} totalDu={totalDu} reglements={reglements} modeParDefaut={null} fini={() => setSaisie(null)} />}
      {saisie === "avoir" && <FormulaireImputation facture={piece} soldes={soldes} fermer={() => setSaisie(null)} />}
      {reglements.length > 0 && <ListeReglements factureId={piece.facture_id} totalDu={totalDu} reglements={reglements} modeParDefaut={null} />}
    </li>
  );
}
