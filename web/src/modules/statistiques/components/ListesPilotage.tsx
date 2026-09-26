import type { ReactNode } from "react";
import { Link } from "react-router";
import { Icone, type NomIcone } from "@/components/ui/icones";
import { formatDateFr } from "@/lib/dates";
import { useModeDiscret } from "@/lib/modeDiscret";
import { activiteRecente, topClients, type FacturePilotage, type NatureActivite } from "../domain/ancien/pilotage";
import { lienActivite, lienClient, tempsRelatif } from "../domain/pilotage";
import type { DonneesPilotage } from "../hooks/useStatistiques";
import { Section } from "./Tuile";
import { formatEurosEcranAncien } from "./format";

/** Le pictogramme et sa pastille par nature (`buildActivityFeed` : devis vert, facture bleue, rapport orangé, paiement vert). */
const APPARENCE: Record<NatureActivite, { icone: NomIcone; couleur: "success" | "info" | "warn" }> = {
  devis: { icone: "devis", couleur: "success" },
  facture: { icone: "factures", couleur: "info" },
  rapport: { icone: "interventions", couleur: "warn" },
  reglement: { icone: "reglements", couleur: "success" },
};

/** Une ligne qui ouvre sa pièce ; un paiement dont la facture est introuvable ne s'ouvre pas (comme l'ancien). */
function LigneActivite({ vers, children }: { vers: string | null; children: ReactNode }) {
  useModeDiscret();
  return vers ? (
    <Link to={vers} className="activity-row" style={{ cursor: "pointer" }}>
      {children}
    </Link>
  ) : (
    <div className="activity-row">{children}</div>
  );
}

/** Les dernières pièces créées et les derniers paiements reçus (`buildActivityFeed`). */
export function ActiviteRecente({ d }: { d: DonneesPilotage }) {
  useModeDiscret();
  const lignes = activiteRecente(d.devis, d.factures, d.rapports, d.reglements);
  const maintenant = new Date().getTime();
  return (
    <div className="dash-col">
      <Section titre="Activité récente">
        <div className="card activity-card">
          {!lignes.length ? (
            <div className="empty">Aucune activité récente.</div>
          ) : (
            lignes.map((a) => (
              <LigneActivite key={`${a.nature}-${a.id}`} vers={lienActivite(a)}>
                <span className={`activity-icon ${APPARENCE[a.nature].couleur}`}>
                  <Icone nom={APPARENCE[a.nature].icone} />
                </span>
                <div className="activity-mid">
                  <div className="activity-label">{a.libelle}</div>
                  <div className="activity-sub">{a.sous}</div>
                </div>
                <div className="activity-right">
                  {a.montant !== null && <div className="activity-amount">{formatEurosEcranAncien(a.montant)}</div>}
                  <div className="activity-time">{tempsRelatif(a.quand, maintenant, formatDateFr)}</div>
                </div>
              </LigneActivite>
            ))
          )}
        </div>
      </Section>
    </div>
  );
}

/** Les cinq premiers clients par chiffre d'affaires HT, toutes factures, par le nom porté sur la pièce (`computeTopClients`). */
export function TopClients({ factures }: { factures: readonly FacturePilotage[] }) {
  useModeDiscret();
  const lignes = topClients(factures);
  return (
    <div className="dash-col">
      <Section titre="Top clients (HT)">
        <div className="card activity-card topclient-card">
          {!lignes.length ? (
            <div className="empty">Pas encore de factures.</div>
          ) : (
            lignes.map((c, i) => (
              <Link key={`${i}-${c.client}`} to={lienClient(c.client)} title={`Ouvrir le dossier de règlements de ${c.client}`} className="topclient-row cliquable">
                <span className="topclient-rank">{i + 1}</span>
                <div className="topclient-mid">
                  <div className="topclient-name">{c.client}</div>
                  <div className="progress-bar" style={{ marginTop: "5px" }}>
                    <div className="progress-fill" style={{ width: `${c.largeur}%`, background: "var(--accent)" }} />
                  </div>
                </div>
                <div className="topclient-amount">{formatEurosEcranAncien(c.total)}</div>
              </Link>
            ))
          )}
        </div>
      </Section>
    </div>
  );
}
