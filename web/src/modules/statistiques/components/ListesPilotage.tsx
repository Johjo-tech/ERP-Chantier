import { Link } from "react-router";
import { Chargement, Erreur } from "@/components/etats/Etats";
import { Icone, type NomIcone } from "@/components/ui/icones";
import { formatDateFr } from "@/lib/dates";
import { ZERO } from "@/lib/money";
import { formatEurosEcran, useModeDiscret } from "@/lib/modeDiscret";
import { partDuMax } from "../domain/indicateurs";
import { ACTIVITE_VISIBLE, LIBELLES_ACTIVITE, lienActivite, lienClient, tempsRelatif, TOP_CLIENTS, type NatureActivite } from "../domain/pilotage";
import { useActivite, useParClient } from "../hooks/useStatistiques";
import { Section } from "./Tuile";

const TOUT = { du: null, au: null };

/** Le pictogramme et sa pastille par nature (`buildActivityFeed` : devis vert, facture bleue, rapport orangé, paiement vert). */
const APPARENCE: Record<NatureActivite, { icone: NomIcone; couleur: "success" | "info" | "warn" }> = {
  devis: { icone: "devis", couleur: "success" },
  facture: { icone: "factures", couleur: "info" },
  rapport: { icone: "interventions", couleur: "warn" },
  reglement: { icone: "reglements", couleur: "success" },
};

/** Les dernières pièces créées et les derniers paiements reçus (`buildActivityFeed`). */
export function ActiviteRecente() {
  useModeDiscret();
  const activite = useActivite(ACTIVITE_VISIBLE);
  return (
    <div className="dash-col">
      <Section titre="Activité récente">
        <div className="card activity-card">
          {activite.isPending ? (
            <Chargement />
          ) : activite.isError ? (
            <Erreur erreur={activite.error} reessayer={() => void activite.refetch()} />
          ) : !activite.data.length ? (
            <div className="empty">Aucune activité récente.</div>
          ) : (
            activite.data.map((a) => (
              <Link key={`${a.nature}-${a.id}`} to={lienActivite(a)} className="activity-row" style={{ cursor: "pointer" }}>
                <span className={`activity-icon ${APPARENCE[a.nature].couleur}`}>
                  <Icone nom={APPARENCE[a.nature].icone} />
                </span>
                <div className="activity-mid">
                  <div className="activity-label">{LIBELLES_ACTIVITE[a.nature]}</div>
                  <div className="activity-sub">{[a.client, a.numero].filter(Boolean).join(" · ")}</div>
                </div>
                <div className="activity-right">
                  {a.montant && <div className="activity-amount">{formatEurosEcran(a.montant)}</div>}
                  <div className="activity-time">{tempsRelatif(a.quand, activite.dataUpdatedAt, formatDateFr)}</div>
                </div>
              </Link>
            ))
          )}
        </div>
      </Section>
    </div>
  );
}

/** Les cinq premiers clients par chiffre d'affaires HT, tout l'historique (`computeTopClients`). */
export function TopClients() {
  useModeDiscret();
  const clients = useParClient(TOUT, TOP_CLIENTS);
  const lignes = (clients.data ?? []).filter((c) => c.ht.gt(ZERO));
  const max = lignes[0]?.ht ?? ZERO;
  return (
    <div className="dash-col">
      <Section titre="Top clients (HT)">
        <div className="card activity-card topclient-card">
          {clients.isPending ? (
            <Chargement />
          ) : clients.isError ? (
            <Erreur erreur={clients.error} reessayer={() => void clients.refetch()} />
          ) : !lignes.length ? (
            <div className="empty">Pas encore de factures.</div>
          ) : (
            lignes.map((c, i) => (
              <Link key={c.client_id ?? c.client_nom ?? i} to={lienClient(c)} title={`Ouvrir le dossier de règlements de ${c.client_nom ?? ""}`} className="topclient-row cliquable">
                <span className="topclient-rank">{i + 1}</span>
                <div className="topclient-mid">
                  <div className="topclient-name">{c.client_nom ?? "Client sans nom"}</div>
                  <div className="progress-bar" style={{ marginTop: "5px" }}>
                    <div className="progress-fill" style={{ width: `${partDuMax(c.ht, max)}%`, background: "var(--accent)" }} />
                  </div>
                </div>
                <div className="topclient-amount">{formatEurosEcran(c.ht)}</div>
              </Link>
            ))
          )}
        </div>
      </Section>
    </div>
  );
}
