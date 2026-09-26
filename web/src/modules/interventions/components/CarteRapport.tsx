import { useState, type MouseEvent } from "react";
import { Link, useNavigate } from "react-router";
import { formatDateFr } from "@/lib/dates";
import { afficherToast } from "@/lib/toast";
import { messageErreur } from "@/lib/erreurs";
import { Can } from "@/modules/auth-roles/components/Can";
import { logementLabel } from "@/modules/documents/impression/gabarit";
import type { RapportDeLaListe } from "../api/rapports";
import { useLierBon, useSupprimerRapport } from "../hooks/useRapports";
import { ActionsTransformation } from "./ActionsTransformation";
import { LienBon } from "./LienBon";

/** `badgeClass` de l'ancien écran, pour les statuts qu'un rapport peut prendre. */
const CLASSE_STATUT: Record<string, string> = { "en cours": "yellow", terminée: "success", brouillon: "gray" };
const CLASSE_LOGEMENT: Record<string, string> = { occupé: "warn", vacant: "success" };
const LIEN: React.CSSProperties = { color: "var(--accent-2)", textDecoration: "underline" };

/** `locataireCardLine` : la ligne du logement sous l'en-tête d'une carte. */
function LigneLocataire({ r }: { r: RapportDeLaListe }) {
  const numero = r.numero_logement ? ` · Log ${r.numero_logement}` : "";
  const complete = [r.adresse_locataire, [r.code_postal, r.ville].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  const suite = complete ? ` — ${complete}` : "";
  if (r.precision_commune) return <div className="card-sub">Partie commune : {r.precision_commune}{suite}</div>;
  if (r.ancien_locataire) return <div className="card-sub">Ancien locataire{numero} : {r.ancien_locataire}{suite}</div>;
  if (!r.adresse_locataire && !r.occupant && !r.numero_logement) return null;
  let ligne = `Locataire${numero}`;
  if (r.occupant) ligne += ` : ${r.occupant}`;
  if (complete) ligne += (r.occupant ? " — " : " : ") + complete;
  return <div className="card-sub">{ligne}</div>;
}

/** Un clic sur la carte ouvre le rapport, sauf s'il vise l'un de ses gestes (`cardRowClick`). */
function horsDesGestes(e: MouseEvent): boolean {
  return !(e.target as HTMLElement).closest("button, a, input, select, textarea");
}

/** Un rapport dans la liste (`renderInterventionsListHTML`), avec ses liens et ses gestes (PLN-20). */
export function CarteRapport({ r, numeroBon }: { r: RapportDeLaListe; numeroBon: string | null }) {
  const navigate = useNavigate();
  const lier = useLierBon();
  const supprimer = useSupprimerRapport();
  const [lien, setLien] = useState(false);
  const echec = (e: unknown) => afficherToast(messageErreur(e));
  // L'ancien écrit `esc(i.statut)` : un rapport sans statut (repris, ou né hors de l'écran) porte une pastille vide, pas « en cours ».
  const statut = r.statut ?? "";
  const photos = r.nbPhotos ? `${r.nbPhotos} photo${r.nbPhotos > 1 ? "s" : ""}` : "";

  return (
    <div className="card" id={`intervention-card-${r.id}`} style={{ cursor: "pointer" }} onClick={(e) => horsDesGestes(e) && void navigate(`/rapports/${r.id}/apercu`)}>
      <div className="card-row">
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="card-title">{r.client_nom}</div>
          <div className="card-sub">
            <span className="numref-lg">{r.numero ?? ""}</span> · {formatDateFr(r.date)}
            {r.heure ? ` à ${r.heure}` : ""}
            {r.interlocuteur ? ` · 👤 ${r.interlocuteur}` : ""}
            {r.conducteur ? ` · 🦺 ${r.conducteur}` : ""}
          </div>
          <div className="card-sub">{photos}</div>
          <LigneLocataire r={r} />
          {r.devis.length > 0 && (
            <div className="card-sub">
              Devis lié{r.devis.length > 1 ? "s" : ""} :{" "}
              {r.devis.map((d, i) => (
                <span key={d.id}>
                  {i > 0 && ", "}
                  <Link to={`/devis/${d.id}`} style={LIEN}>{d.numero ?? ""}</Link>
                </span>
              ))}
            </div>
          )}
          {r.factures.length > 0 && (
            <div className="card-sub">
              Facture{r.factures.length > 1 ? "s" : ""} liée{r.factures.length > 1 ? "s" : ""} :{" "}
              {r.factures.map((f, i) => (
                <span key={f.id}>
                  {i > 0 && ", "}
                  <Link to={`/factures/${f.id}`} style={LIEN}>{f.numero ?? ""}</Link>
                </span>
              ))}
            </div>
          )}
          {r.bon_commande_id && numeroBon !== null && (
            <div className="card-sub">
              Bon de commande lié : <Link to={`/commandes/${r.bon_commande_id}`} style={LIEN}>{numeroBon}</Link>
            </div>
          )}
        </div>
        <div style={{ display: "flex", gap: "6px", alignItems: "center", alignSelf: "center", flexShrink: 0 }}>
          {r.logement_statut && <span className={`badge ${CLASSE_LOGEMENT[r.logement_statut] ?? "info"}`}>{logementLabel(r.logement_statut)}</span>}
          <span className={`badge ${CLASSE_STATUT[statut] ?? "gray"}`}>{statut}</span>
        </div>
      </div>
      {r.constatations && <div style={{ marginTop: "8px", fontSize: "13px", color: "var(--text-dim)" }}>{r.constatations}</div>}
      <div style={{ marginTop: "10px", display: "flex", gap: "8px", flexWrap: "wrap" }}>
        <Can module="rapports" action="modifier">
          <Link className="btn small" to={`/rapports/${r.id}`}>Modifier</Link>
        </Can>
        <ActionsTransformation rapport={r} bonId={r.bon_commande_id} devisPossible={!r.devis.length} facturePossible={!r.factures.length} />
        <Link className="btn small" to={`/rapports/${r.id}/apercu`}>Imprimer / PDF</Link>
        <Can module="rapports" action="modifier">
          {r.bon_commande_id ? (
            <>
              <button type="button" className="btn small ghost" onClick={() => setLien(!lien)}>🔗 Modifier le lien BC</button>
              <button
                type="button"
                className="btn small ghost"
                title="Retirer le lien entre ce rapport et son bon de commande"
                onClick={() => lier.mutate({ rapportId: r.id, bcId: null }, { onSuccess: () => afficherToast("✂️ Lien retiré — vous pouvez maintenant lier à un autre document.", "success", 2500), onError: echec })}
              >
                ✂️ Délier
              </button>
            </>
          ) : (
            <button type="button" className="btn small ghost" onClick={() => setLien(!lien)}>🔗 Lier un bon de commande</button>
          )}
        </Can>
        <Can module="rapports" action="supprimer">
          <button type="button" className="btn small danger" disabled={supprimer.isPending} onClick={() => window.confirm("Supprimer définitivement cet élément ?") && supprimer.mutate(r.id, { onError: echec })}>
            Supprimer
          </button>
        </Can>
      </div>
      {lien && (
        <div style={{ marginTop: "8px" }} onClick={(e) => e.stopPropagation()}>
          <LienBon
            rapportId={r.id}
            clientId={r.client_id}
            clientNom={r.client_nom}
            onAnnuler={() => setLien(false)}
            onChoisir={(bcId) => {
              setLien(false);
              lier.mutate({ rapportId: r.id, bcId }, { onSuccess: () => afficherToast("🔗 Lié avec succès !", "success", 2000), onError: echec });
            }}
          />
        </div>
      )}
    </div>
  );
}
