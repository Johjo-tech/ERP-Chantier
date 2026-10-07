import { useNavigate } from "react-router";
import { todayISO } from "@/lib/dates";
import { messageErreur } from "@/lib/erreurs";
import { afficherToast } from "@/lib/toast";
import { useFournisseurs } from "@/modules/reglages/hooks/useReglagesEcran";
import type { BonDeLaListe } from "../api/bons";
import { optionsFournisseurs } from "../domain/pieces";
import { useModifierCommandePiece, usePieceRecue } from "../hooks/useBons";

/** Les durées des messages de `marquerPieceCommandee` et `replanifierApresPiece`. */
const DUREE_TOAST_COMMANDE_MS = 2500;
const DUREE_TOAST_RECUE_MS = 5000;

/**
 * Commander la pièce, puis la recevoir, depuis la carte dépliée de « Pièces en
 * commande » (la `piece-replanifier-zone` de l'ancien). Chaque champ s'écrit à
 * son changement ; le fournisseur se choisit dans l'annuaire, augmenté du nom
 * déjà écrit — deux graphies feraient deux dossiers.
 */
export function ZonePieceCarte({ bon, employes }: { bon: BonDeLaListe; employes: readonly string[] }) {
  const navigate = useNavigate();
  const fournisseurs = useFournisseurs();
  const modifier = useModifierCommandePiece();
  const recue = usePieceRecue();
  const piece = bon.circuit.piece;
  const echec = (e: unknown) => afficherToast(messageErreur(e));
  const options = optionsFournisseurs(fournisseurs.data ?? [], employes, piece.fournisseur);
  function commander() {
    modifier.mutate(
      { bonId: bon.id, champs: { piece_date_commande: todayISO() } },
      { onSuccess: () => afficherToast(`📦 Pièce commandée — classée dans le dossier ${piece.fournisseur || "fournisseur"}`, "success", DUREE_TOAST_COMMANDE_MS), onError: echec }
    );
  }
  function arrivee() {
    recue.mutate(bon.id, {
      onSuccess: () => {
        void navigate("/planning");
        afficherToast('Pièce reçue — le bon de commande est de retour dans Planning (colonne "Non planifiés"), prêt à être replanifié.', "success", DUREE_TOAST_RECUE_MS);
      },
      onError: echec,
    });
  }
  return (
    <div className="piece-replanifier-zone">
      <label className="card-sub" style={{ margin: 0 }}>
        Commandée le
        <input type="date" id={`dateCommandePiece_${bon.id}`} value={piece.dateCommande} onChange={(e) => modifier.mutate({ bonId: bon.id, champs: { piece_date_commande: e.target.value || null } }, { onError: echec })} />
      </label>
      <select id={`fournisseurPiece_${bon.id}`} aria-label="Fournisseur" style={{ minWidth: "180px" }} value={piece.fournisseur} onChange={(e) => modifier.mutate({ bonId: bon.id, champs: { piece_fournisseur: e.target.value || null } }, { onError: echec })}>
        <option value="">— Non précisé —</option>
        {options.map((n) => <option key={n} value={n}>{n}</option>)}
      </select>
      {!piece.dateCommande && <button type="button" className="btn small primary" disabled={modifier.isPending} onClick={commander}>📦 Commandé</button>}
      <button type="button" className={`btn small${piece.dateCommande ? " primary" : ""}`} disabled={recue.isPending} onClick={arrivee}>✓ Pièce arrivée — Renvoyer au planning</button>
    </div>
  );
}
