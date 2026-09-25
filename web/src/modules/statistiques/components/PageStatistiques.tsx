import { useState } from "react";
import { EnTetePage } from "@/components/page/EnTetePage";
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { todayISO } from "@/lib/dates";
import { bornesStats, PERIODES_STATS, refusPlage, type Bornes, type PeriodeStats } from "../domain/periodes";
import { StatsClients, StatsConducteurs, StatsEquipes, StatsMetiers } from "./SectionsStatistiques";

type Onglet = "conducteurs" | "metiers" | "clients" | "equipes";

const ONGLETS: Record<Onglet, string> = {
  conducteurs: "Par conducteur",
  metiers: "Par métier",
  clients: "Par client",
  equipes: "Par équipe et par mois",
};

/**
 * Statistiques (`renderStatistiques`) : admin, secrétaire, conducteur, lecture
 * (matrice « statistiques / voir »). Toujours par la RÉFÉRENCE du conducteur,
 * jamais par son nom (STA-22).
 */
export function PageStatistiques() {
  const jour = todayISO();
  const [periode, setPeriode] = useState<PeriodeStats>("tout");
  const [plage, setPlage] = useState<Bornes>({ du: null, au: null });
  const [onglet, setOnglet] = useState<Onglet>("conducteurs");
  const refus = periode === "plage" ? refusPlage(plage.du ?? "", plage.au ?? "") : null;
  const bornes = bornesStats(periode, jour, plage);

  return (
    <div className="flex flex-col gap-4">
      <EnTetePage
        titre="Statistiques"
        sousTitre={`Période : ${PERIODES_STATS[periode].toLowerCase()}. Bons de commande comptés à leur création, devis et factures à leur date.`}
        actions={
          <div className="flex flex-wrap items-end gap-2">
            <Label className="flex flex-col gap-1 text-sm">Période
              <Select className="w-auto" value={periode} onChange={(e) => setPeriode(e.target.value as PeriodeStats)}>
                {Object.entries(PERIODES_STATS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </Select>
            </Label>
            {periode === "plage" && (
              <>
                <Label className="flex flex-col gap-1 text-sm">Du<Input type="date" value={plage.du ?? ""} onChange={(e) => setPlage((p) => ({ ...p, du: e.target.value || null }))} /></Label>
                <Label className="flex flex-col gap-1 text-sm">Au<Input type="date" value={plage.au ?? ""} onChange={(e) => setPlage((p) => ({ ...p, au: e.target.value || null }))} /></Label>
              </>
            )}
          </div>
        }
      />
      <div role="tablist" aria-label="Axes des statistiques" className="flex flex-wrap gap-1 border-b border-border">
        {(Object.keys(ONGLETS) as Onglet[]).map((o) => (
          <button
            key={o}
            type="button"
            role="tab"
            id={`onglet-${o}`}
            aria-selected={onglet === o}
            aria-controls="panneau-statistiques"
            onClick={() => setOnglet(o)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm ${onglet === o ? "border-primary font-semibold text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            {ONGLETS[o]}
          </button>
        ))}
      </div>
      <div role="tabpanel" id="panneau-statistiques" aria-labelledby={`onglet-${onglet}`}>
        {refus ? (
          <Card className="p-4 text-sm text-muted-foreground">{refus}</Card>
        ) : onglet === "conducteurs" ? (
          <StatsConducteurs bornes={bornes} jour={jour} />
        ) : onglet === "metiers" ? (
          <StatsMetiers bornes={bornes} jour={jour} />
        ) : onglet === "clients" ? (
          <StatsClients bornes={bornes} />
        ) : (
          <StatsEquipes bornes={bornes} />
        )}
      </div>
    </div>
  );
}
