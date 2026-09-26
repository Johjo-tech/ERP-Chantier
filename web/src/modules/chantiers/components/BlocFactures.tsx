import { Link } from "react-router";
import { Erreur } from "@/components/etats/Etats";
import { montant } from "@/lib/money";
import { formatEurosEcran, useModeDiscret } from "@/lib/modeDiscret";
import { usePermission } from "@/modules/auth-roles/hooks/useSession";
import { useFacturesDuChantier } from "../hooks/useFiche";

/** Même code couleur que l'ancien badge (app.js l. 14378) : payée = success, impayée = danger, sinon info. */
function classeFacture(statut: string | null): string {
  if (statut === "payée") return "success";
  if (statut === "impayée") return "danger";
  return "info";
}

/**
 * Un avoir se lit en négatif, comme l'ancien (`computeDocTotals` d'un avoir) :
 * la vue le rend en valeur absolue, et « 300,00 € » laisserait croire à une vente.
 */
function ttcSigne(typeDocument: string, ttc: number) {
  const m = montant(ttc);
  return typeDocument === "avoir" ? m.abs().neg() : m;
}

/**
 * « 🧾 Factures » (`chantierFacturesHTML`, CHA-12) : numéro, TTC (vue
 * `v_facture_totaux`), statut. Imprimer et envoyer ne sont proposés qu'à une
 * pièce émise — sans numéro elle ne sort pas (`regles-actions-facture`, D-CHA-12).
 */
export function BlocFactures({ chantierId }: { chantierId: string }) {
  useModeDiscret();
  const autorise = usePermission("factures", "voir");
  const factures = useFacturesDuChantier(chantierId);
  if (!autorise) return null;
  return (
    <div className="chantier-section">
      <div className="section-title" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span>🧾 Factures</span>
      </div>
      {factures.isError && <Erreur erreur={factures.error} reessayer={() => void factures.refetch()} />}
      {factures.isSuccess && factures.data.length === 0 && <div className="empty">Aucune facture pour l'instant.</div>}
      {factures.data?.map((f) => (
        <div key={f.id} className="chantier-file-row" style={{ flexWrap: "wrap" }}>
          <Link to={`/factures/${f.id}`}>
            🧾 {f.numero ? f.numero : "Brouillon — non émise"} — {f.ttc == null ? "—" : formatEurosEcran(ttcSigne(f.type_document, f.ttc))} TTC
          </Link>
          <span className={`badge ${classeFacture(f.statut)}`}>{f.statut || "brouillon"}</span>
          {f.numero && (
            <>
              <Link className="btn small" to={`/factures/${f.id}/apercu`}>
                Imprimer / PDF
              </Link>
              <Link className="btn small" to={`/factures/${f.id}`}>
                Envoyer par email
              </Link>
            </>
          )}
        </div>
      ))}
    </div>
  );
}
