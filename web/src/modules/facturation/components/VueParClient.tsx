import { useState } from "react";
import { Link, useSearchParams } from "react-router";
import { Vide } from "@/components/etats/Etats";
import { Badge } from "@/components/ui/badge";
import { Input, Select } from "@/components/ui/input";
import { formatEurosEcran, useModeDiscret } from "@/lib/modeDiscret";
import { correspond } from "@/lib/recherche";
import { dossiersClients, ETATS_REGLEMENT, type EtatFiltre, type Solde } from "../domain/solde";

/**
 * « Par client » (FAC-30) : le total dû de chaque client — sans les avoirs, qui
 * sont des crédits —, le badge Retard, et le filtre d'état partagé avec
 * « Par facture ». La recherche trouve aussi un numéro de facture.
 */
export function VueParClient({ soldes }: { soldes: readonly Solde[] }) {
  useModeDiscret();
  const [params, setParams] = useSearchParams();
  const etat = (params.get("etat") ?? "") as EtatFiltre;
  const [recherche, setRecherche] = useState("");
  const dossiers = dossiersClients(soldes, etat).filter((d) => correspond(recherche, d.client, ...d.pieces.map((p) => p.numero)));
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <label htmlFor="recherche-dossier" className="sr-only">Rechercher un client ou une facture</label>
        <Input id="recherche-dossier" type="search" className="max-w-sm" placeholder="Client, n° de facture…" value={recherche} onChange={(e) => setRecherche(e.target.value)} />
        <label htmlFor="etat-dossier" className="sr-only">Filtrer par état</label>
        <Select id="etat-dossier" className="max-w-56" value={etat} onChange={(e) => setParams(e.target.value ? { etat: e.target.value } : {}, { replace: true })}>
          {ETATS_REGLEMENT.map((x) => <option key={x.valeur} value={x.valeur}>{x.libelle}</option>)}
        </Select>
      </div>
      {dossiers.length === 0 ? (
        <Vide message="Aucun dossier ne correspond." />
      ) : (
        <ul aria-label="Dossiers clients" className="divide-y divide-border rounded-md border border-border">
          {dossiers.map((d) => (
            <li key={d.client}>
              <Link to={`/factures/reglements/dossier?client=${encodeURIComponent(d.client)}`} className="flex items-center justify-between gap-3 p-3 hover:bg-muted">
                <span>
                  <span className="font-medium">{d.client}</span>
                  <span className="block text-xs text-muted-foreground">{d.pieces.length} pièce{d.pieces.length > 1 ? "s" : ""}</span>
                </span>
                <span className="flex items-center gap-2 text-right">
                  <span className="tabular-nums font-semibold">{formatEurosEcran(d.du)}</span>
                  {d.du.gt("0.01") ? d.enRetard ? <Badge variant="danger">Retard</Badge> : <Badge variant="neutre">dû</Badge> : <Badge variant="succes">à jour</Badge>}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
