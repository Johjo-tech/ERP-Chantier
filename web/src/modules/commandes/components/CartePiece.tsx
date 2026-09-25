import { useState } from "react";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { dateISO, formatDateFr, todayISO } from "@/lib/dates";
import { Can } from "@/modules/auth-roles/components/Can";
import type { PieceDuBon } from "../domain/pieces";
import { useMarquerCommandee, usePieceRecue } from "../hooks/useBons";

interface Props {
  piece: PieceDuBon;
  onResultat: (message: string, erreur?: unknown) => void;
}

/** Date et fournisseur, puis « commandée » : le geste que l'ancien écran faisait en deux temps (BC-19). */
function FormulaireCommande({ piece, onResultat }: Props) {
  const [date, setDate] = useState(piece.dateCommande || todayISO());
  const [fournisseur, setFournisseur] = useState(piece.fournisseur);
  const commander = useMarquerCommandee();
  const id = piece.bon.id;
  return (
    <div className="flex flex-wrap items-end gap-2">
      <label className="flex flex-col text-xs">
        Commandée le
        <Input type="date" className="h-8 w-40" value={date} onChange={(e) => setDate(e.target.value)} />
      </label>
      <label className="flex flex-col text-xs">
        Fournisseur
        <Input className="h-8 w-48" value={fournisseur} onChange={(e) => setFournisseur(e.target.value)} />
      </label>
      <Button
        size="sm"
        disabled={commander.isPending || !date}
        onClick={() =>
          commander.mutate(
            { bonId: id, date, fournisseur: fournisseur.trim() || null },
            {
              onSuccess: () => onResultat(`Pièce commandée — classée dans le dossier ${fournisseur.trim() || "fournisseur"}.`),
              onError: (e) => onResultat("", e),
            }
          )
        }
      >
        {piece.dateCommande ? "Mettre à jour" : "Marquer commandée"}
      </Button>
    </div>
  );
}

export function CartePiece({ piece, onResultat }: Props) {
  const recue = usePieceRecue();
  const b = piece.bon;
  return (
    <li className="flex flex-col gap-2 rounded-md border p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span>
          <Link to={`/commandes/${b.id}`} className="font-medium text-primary hover:underline">{b.numero_interne ?? "Bon sans numéro"}</Link>
          {" — "}{b.client_nom}
          {(b.adresse || b.ville) && <span className="text-sm text-muted-foreground"> · {[b.adresse, b.ville].filter(Boolean).join(", ")}</span>}
        </span>
        {piece.recueLe && <span className="text-xs text-muted-foreground">reçue le {formatDateFr(dateISO(new Date(piece.recueLe)))}</span>}
      </div>
      <p className="text-sm">{piece.description || "Pièce sans description"}</p>
      {piece.pieceACommander && (
        <Can module="planning" action="modifier">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <FormulaireCommande piece={piece} onResultat={onResultat} />
            <Button
              size="sm"
              variant="secondary"
              disabled={recue.isPending}
              onClick={() =>
                recue.mutate(b.id, {
                  onSuccess: () => onResultat("Pièce reçue — le bon retourne au planning, prêt à être replanifié."),
                  onError: (e) => onResultat("", e),
                })
              }
            >
              Pièce reçue
            </Button>
          </div>
        </Can>
      )}
    </li>
  );
}
