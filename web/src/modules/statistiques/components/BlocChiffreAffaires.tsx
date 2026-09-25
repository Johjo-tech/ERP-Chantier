import { useState } from "react";
import { Chargement, Erreur } from "@/components/etats/Etats";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDateFr } from "@/lib/dates";
import { formatEuros } from "@/lib/money";
import { serieComparee, totalDesMois } from "../domain/indicateurs";
import { bornesComparaison, bornesDuMois, moisDeLaPeriode, PERIODES_GRAPHIQUE, refusPlage, type Bornes, type PeriodeGraphique } from "../domain/periodes";
import { useCaParMois } from "../hooks/useStatistiques";
import { GraphiqueCA } from "./GraphiqueCA";
import { pluriel } from "./format";

type Choix = PeriodeGraphique | "plage";

/** « Chiffre d'affaires (HT) » : 6 / 12 mois ou depuis janvier face à N-1, ou le total d'une plage libre. */
export function BlocChiffreAffaires({ jour }: { jour: string }) {
  const [choix, setChoix] = useState<Choix>("6m");
  return (
    <section aria-labelledby="titre-ca" className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="titre-ca" className="text-lg font-semibold">Chiffre d'affaires (HT)</h2>
        <Label className="flex items-center gap-2 text-sm font-normal">
          Période
          <Select className="w-auto" value={choix} onChange={(e) => setChoix(e.target.value as Choix)}>
            {Object.entries(PERIODES_GRAPHIQUE).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            <option value="plage">Sélectionner les dates</option>
          </Select>
        </Label>
      </div>
      <Card className="p-4">{choix === "plage" ? <PlageLibre jour={jour} /> : <Comparaison periode={choix} jour={jour} />}</Card>
    </section>
  );
}

function Comparaison({ periode, jour }: { periode: PeriodeGraphique; jour: string }) {
  const mois = moisDeLaPeriode(periode, jour);
  const ca = useCaParMois(bornesComparaison(mois));
  if (ca.isPending) return <Chargement />;
  if (ca.isError) return <Erreur erreur={ca.error} reessayer={() => void ca.refetch()} />;
  const serie = serieComparee(ca.data, mois);
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm">Total de la période : <b className="tabular-nums">{formatEuros(serie.total)}</b></p>
      <GraphiqueCA serie={serie} />
      <p className="text-xs text-muted-foreground">Factures émises à leur date, avoirs en déduction ; ni brouillons ni factures d'acompte (déjà comprises dans la facture de solde).</p>
    </div>
  );
}

/** `computeCustomRevenue` : le total HT entre deux dates, et le nombre de pièces. */
function PlageLibre({ jour }: { jour: string }) {
  const [saisie, setSaisie] = useState<Bornes>(() => ({ du: bornesDuMois(jour).du, au: jour }));
  const [retenue, setRetenue] = useState<Bornes | null>(null);
  const [refus, setRefus] = useState<string | null>(null);
  const ca = useCaParMois(retenue ?? { du: null, au: null }, !!retenue);
  const calculer = () => {
    const r = refusPlage(saisie.du ?? "", saisie.au ?? "");
    setRefus(r);
    setRetenue(r ? null : { ...saisie });
  };
  return (
    <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); calculer(); }}>
      <div className="flex flex-wrap items-end gap-3">
        <Label className="flex flex-col gap-1 text-sm">Du<Input type="date" value={saisie.du ?? ""} onChange={(e) => setSaisie((s) => ({ ...s, du: e.target.value }))} /></Label>
        <Label className="flex flex-col gap-1 text-sm">Au<Input type="date" value={saisie.au ?? ""} onChange={(e) => setSaisie((s) => ({ ...s, au: e.target.value }))} /></Label>
        <Button type="submit">Calculer</Button>
      </div>
      {refus && <p role="alert" className="text-sm text-destructive">{refus}</p>}
      {retenue && ca.isPending && <Chargement />}
      {retenue && ca.isError && <Erreur erreur={ca.error} reessayer={() => void ca.refetch()} />}
      {retenue && ca.isSuccess && (
        <div aria-live="polite">
          <p className="text-sm text-muted-foreground">Du {formatDateFr(retenue.du)} au {formatDateFr(retenue.au)}</p>
          <p className="text-3xl font-semibold tabular-nums">{formatEuros(totalDesMois(ca.data).ht)}</p>
          <p className="text-sm text-muted-foreground">{pluriel(totalDesMois(ca.data).nb, "facture")}</p>
        </div>
      )}
    </form>
  );
}
