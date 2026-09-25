import { Link } from "react-router";
import { Chargement, Erreur } from "@/components/etats/Etats";
import { Card } from "@/components/ui/card";
import { formatDateFr } from "@/lib/dates";
import { ZERO } from "@/lib/money";
import { formatEurosEcran } from "@/lib/modeDiscret";
import { partDuMax } from "../domain/indicateurs";
import { ACTIVITE_VISIBLE, LIBELLES_ACTIVITE, lienActivite, lienClient, tempsRelatif, TOP_CLIENTS } from "../domain/pilotage";
import { useActivite, useParClient } from "../hooks/useStatistiques";
import { COULEUR_COURANTE } from "./GraphiqueCA";

const TOUT = { du: null, au: null };

/** Les dernières pièces créées et les derniers paiements reçus (`buildActivityFeed`). */
export function ActiviteRecente() {
  const activite = useActivite(ACTIVITE_VISIBLE);
  return (
    <section aria-labelledby="titre-activite" className="flex flex-col gap-2">
      <h2 id="titre-activite" className="text-lg font-semibold">Activité récente</h2>
      <Card>
        {activite.isPending ? <Chargement /> : activite.isError ? <Erreur erreur={activite.error} reessayer={() => void activite.refetch()} /> : !activite.data.length ? (
          <p className="p-6 text-center text-sm text-muted-foreground">Aucune activité récente.</p>
        ) : (
          <ul className="divide-y divide-border">
            {activite.data.map((a) => (
              <li key={`${a.nature}-${a.id}`}>
                <Link to={lienActivite(a)} className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <span className="flex-1">
                    <span className="block font-medium">{LIBELLES_ACTIVITE[a.nature]}</span>
                    <span className="text-muted-foreground">{[a.client, a.numero].filter(Boolean).join(" · ")}</span>
                  </span>
                  <span className="text-right">
                    {a.montant && <span className="block font-semibold tabular-nums">{formatEurosEcran(a.montant)}</span>}
                    <span className="text-xs text-muted-foreground">{tempsRelatif(a.quand, activite.dataUpdatedAt, formatDateFr)}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </section>
  );
}

/** Les cinq premiers clients par chiffre d'affaires HT, tout l'historique (`computeTopClients`). */
export function TopClients() {
  const clients = useParClient(TOUT, TOP_CLIENTS);
  const lignes = (clients.data ?? []).filter((c) => c.ht.gt(ZERO));
  const max = lignes[0]?.ht ?? ZERO;
  return (
    <section aria-labelledby="titre-top-clients" className="flex flex-col gap-2">
      <h2 id="titre-top-clients" className="text-lg font-semibold">Top clients (HT)</h2>
      <Card>
        {clients.isPending ? <Chargement /> : clients.isError ? <Erreur erreur={clients.error} reessayer={() => void clients.refetch()} /> : !lignes.length ? (
          <p className="p-6 text-center text-sm text-muted-foreground">Pas encore de factures.</p>
        ) : (
          <ol className="divide-y divide-border">
            {lignes.map((c, i) => (
              <li key={c.client_id ?? c.client_nom ?? i}>
                <Link to={lienClient(c)} title={`Ouvrir le dossier de règlements de ${c.client_nom ?? ""}`} className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <span className="w-5 text-muted-foreground tabular-nums">{i + 1}</span>
                  <span className="flex flex-1 flex-col gap-1">
                    <span className="font-medium">{c.client_nom ?? "Client sans nom"}</span>
                    <span aria-hidden="true" className="h-1.5 overflow-hidden rounded-full bg-muted">
                      <span className="block h-full rounded-full" style={{ width: `${partDuMax(c.ht, max)}%`, background: COULEUR_COURANTE }} />
                    </span>
                  </span>
                  <span className="font-semibold tabular-nums">{formatEurosEcran(c.ht)}</span>
                </Link>
              </li>
            ))}
          </ol>
        )}
      </Card>
    </section>
  );
}
