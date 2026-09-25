import { useState } from "react";
import { useClients } from "@/modules/clients/hooks/useClients";
import { useConducteurs } from "@/modules/societes/hooks/useConducteurs";
import type { CartePlanning } from "../domain/cartes";
import { valeursDe, type FiltresPlanning } from "../domain/filtres";
import { planDeplanifier, questionDeplanifier } from "../domain/planification";
import { CarteNonPlanifiee } from "./CarteNonPlanifiee";
import { usePlanningContexte } from "./contexte";

interface Props {
  cartes: CartePlanning[];
  toutes: CartePlanning[];
  filtres: FiltresPlanning;
  onFiltres: (f: FiltresPlanning) => void;
  glissee: CartePlanning | null;
  onGlisser: (c: CartePlanning | null) => void;
}

const parNom = (a: string, b: string) => a.localeCompare(b);

/** `planningLogementFilterOptions` : les trois logements, et « problème » (des tentatives restées sans réponse). */
const LOGEMENTS: [string, string][] = [
  ["", "Tous les logements"],
  ["occupé", "🏠 Logement occupé"],
  ["vacant", "🔑 Logement vacant"],
  ["commune", "🚪 Partie commune"],
  ["probleme", "⚠️ Problème (ne répond pas)"],
];

/**
 * La colonne « Non planifiés » (`.planning-unscheduled`) : filtre conducteur,
 * panneau client / interlocuteur / logement sous la loupe. Y déposer une carte
 * la retire du planning — avec les contrôles de « Retirer du planning », que
 * l'ancien dépôt oubliait (PLN-50).
 */
export function ColonneNonPlanifies({ cartes, toutes, filtres, onFiltres, glissee, onGlisser }: Props) {
  const { peutPlanifier, appliquer, donnees } = usePlanningContexte();
  const conducteurs = useConducteurs();
  const clients = useClients();
  const [panneau, setPanneau] = useState(false);
  // `conducteurFilterOptions` : les fiches actives, plus celle déjà choisie.
  const nomsConducteurs = (conducteurs.data ?? []).filter((c) => c.actif || c.nom === filtres.conducteur).map((c) => c.nom).sort(parNom);
  const nomsClients = (clients.data ?? []).map((c) => c.nom).sort(parNom);
  const interlocuteurs = valeursDe(
    toutes.filter((c) => !filtres.client || c.bon.client_nom === filtres.client),
    (c) => c.bon.interlocuteur
  );
  const maj = (champ: keyof FiltresPlanning, valeur: string) => onFiltres({ ...filtres, [champ]: valeur, ...(champ === "client" ? { interlocuteur: "" } : {}) });

  return (
    <div className="planning-unscheduled">
      <select aria-label="Conducteur" style={{ width: "100%", marginBottom: "10px" }} value={filtres.conducteur} onChange={(e) => maj("conducteur", e.target.value)}>
        <option value="">Tous les conducteurs</option>
        {nomsConducteurs.map((n) => (
          <option key={n} value={n}>{n}</option>
        ))}
      </select>
      <div className="section-title" style={{ marginTop: 0, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span>Non planifiés ({cartes.length})</span>
        <button type="button" className="planning-filter-icon-btn" aria-expanded={panneau} onClick={() => setPanneau(!panneau)} title="Filtrer par client ou interlocuteur">
          🔍
        </button>
      </div>
      <div id="planningUnschedFilterPanel" style={{ display: panneau ? "flex" : "none", flexDirection: "column", gap: "6px", marginBottom: "10px" }}>
        <select aria-label="Client" style={{ width: "100%" }} value={filtres.client} onChange={(e) => maj("client", e.target.value)}>
          <option value="">Tous les clients</option>
          {nomsClients.map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
        <select aria-label="Interlocuteur" style={{ width: "100%" }} value={filtres.interlocuteur} onChange={(e) => maj("interlocuteur", e.target.value)}>
          <option value="">Tous les interlocuteurs</option>
          {interlocuteurs.map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
        <select aria-label="Logement" style={{ width: "100%" }} value={filtres.logement} onChange={(e) => maj("logement", e.target.value)}>
          {LOGEMENTS.map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
      </div>
      <div
        className="planning-unsched-list"
        onDragOver={(e) => peutPlanifier && glissee?.rdv.datePlanifiee && e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const carte = glissee;
          onGlisser(null);
          if (!carte?.rdv.datePlanifiee) return;
          const question = questionDeplanifier(carte);
          if (question && !window.confirm(question)) return;
          appliquer(carte, () => planDeplanifier(carte, new Set(donnees.tachesAvecTravaux)));
        }}
      >
        {cartes.length ? cartes.map((c) => <CarteNonPlanifiee key={c.id} carte={c} onGlisser={onGlisser} />) : <div className="empty">Tout est planifié.</div>}
      </div>
    </div>
  );
}
