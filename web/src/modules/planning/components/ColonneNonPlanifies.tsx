import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import type { CartePlanning } from "../domain/cartes";
import { valeursDe, type FiltresPlanning } from "../domain/filtres";
import { planDeplanifier, questionDeplanifier } from "../domain/planification";
import { CarteNonPlanifiee } from "./CarteNonPlanifiee";
import { usePlanningContexte } from "./contexte";
import { LIBELLES_LOGEMENT } from "./format";

interface Props {
  cartes: CartePlanning[];
  toutes: CartePlanning[];
  filtres: FiltresPlanning;
  onFiltres: (f: FiltresPlanning) => void;
  glissee: CartePlanning | null;
  onGlisser: (c: CartePlanning | null) => void;
}

/**
 * La colonne « Non planifiés » : filtre conducteur, et un panneau client /
 * interlocuteur / logement (dont « problème » : des tentatives restées sans
 * réponse). Y déposer une carte la retire du planning — avec les contrôles de
 * « Retirer du planning », que l'ancien dépôt oubliait (PLN-50).
 */
export function ColonneNonPlanifies({ cartes, toutes, filtres, onFiltres, glissee, onGlisser }: Props) {
  const { peutPlanifier, appliquer, donnees } = usePlanningContexte();
  const [panneau, setPanneau] = useState(false);
  const clients = valeursDe(toutes, (c) => c.bon.client_nom);
  const interlocuteurs = valeursDe(
    toutes.filter((c) => !filtres.client || c.bon.client_nom === filtres.client),
    (c) => c.bon.interlocuteur
  );
  const maj = (champ: keyof FiltresPlanning, valeur: string) => onFiltres({ ...filtres, [champ]: valeur, ...(champ === "client" ? { interlocuteur: "" } : {}) });

  return (
    <aside
      aria-label="Non planifiés"
      className="flex w-full shrink-0 flex-col gap-2 lg:w-72 print:hidden"
      onDragOver={(e) => peutPlanifier && glissee?.rdv.datePlanifiee && e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        const carte = glissee;
        onGlisser(null);
        if (!carte?.rdv.datePlanifiee) return;
        const question = questionDeplanifier(carte);
        if (question && !window.confirm(question)) return;
        appliquer(carte, () => planDeplanifier(carte, new Set(donnees.tachesAvecTravaux)), "Carte renvoyée dans « Non planifiés ».");
      }}
    >
      <label className="sr-only" htmlFor="filtre-conducteur">Conducteur</label>
      <Select id="filtre-conducteur" value={filtres.conducteur} onChange={(e) => maj("conducteur", e.target.value)}>
        <option value="">Tous les conducteurs</option>
        {valeursDe(toutes, (c) => c.bon.conducteur).map((n) => (
          <option key={n} value={n}>{n}</option>
        ))}
      </Select>
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Non planifiés ({cartes.length})</h2>
        <Button variant="ghost" size="sm" aria-expanded={panneau} onClick={() => setPanneau(!panneau)}>🔍 Filtrer</Button>
      </div>
      {panneau && (
        <div className="flex flex-col gap-1.5">
          <Select aria-label="Client" value={filtres.client} onChange={(e) => maj("client", e.target.value)}>
            <option value="">Tous les clients</option>
            {clients.map((n) => <option key={n} value={n}>{n}</option>)}
          </Select>
          <Select aria-label="Interlocuteur" value={filtres.interlocuteur} onChange={(e) => maj("interlocuteur", e.target.value)}>
            <option value="">Tous les interlocuteurs</option>
            {interlocuteurs.map((n) => <option key={n} value={n}>{n}</option>)}
          </Select>
          <Select aria-label="Logement" value={filtres.logement} onChange={(e) => maj("logement", e.target.value)}>
            <option value="">Tous les logements</option>
            {Object.entries(LIBELLES_LOGEMENT).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            <option value="probleme">⚠️ Problème (ne répond pas)</option>
          </Select>
        </div>
      )}
      {cartes.length ? (
        <ul className="flex max-h-[70vh] flex-col gap-2 overflow-y-auto">
          {cartes.map((c) => <CarteNonPlanifiee key={c.id} carte={c} onGlisser={onGlisser} />)}
        </ul>
      ) : (
        <p className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">Tout est planifié.</p>
      )}
    </aside>
  );
}
