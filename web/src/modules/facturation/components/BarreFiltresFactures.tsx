import type { KeyboardEvent } from "react";
import { useClients } from "@/modules/clients/hooks/useClients";
import { useMetiers } from "@/modules/reglages/hooks/useReglagesEcran";
import { useConducteurs } from "@/modules/societes/hooks/useConducteurs";
import { aideRecherche, criteresDeLaVue, FILTRES_PAR_VUE, filtrageActif, placeholderRecherche, type CleFiltre, type EtatFiltres, type Periode, type VueFacturation } from "../domain/filtresEcran";
import { useInterlocuteursSociete } from "../hooks/useEcranFactures";

const parNom = (a: string, b: string) => a.localeCompare(b);

/**
 * La barre de recherche et de filtres des vues de Facturation
 * (`barreFiltresFactures`, app.js l. 5578) : mêmes champs, même ordre, mêmes
 * largeurs minimales, mêmes libellés, emoji compris. Les listes déroulantes
 * nomment ce qu'elles filtrent par son NOM, comme l'ancien.
 */
export function BarreFiltresFactures({ vue, filtres, changer, saisie, onSaisie, onEntree }: {
  vue: VueFacturation;
  filtres: EtatFiltres;
  changer: (maj: Partial<EtatFiltres> | null) => void;
  /** Le texte tapé, affiché tout de suite ; le filtrage suit après le délai de frappe. */
  saisie: string;
  onSaisie: (v: string) => void;
  onEntree?: (e: KeyboardEvent<HTMLInputElement>) => void;
}) {
  const clients = useClients();
  const interlocuteurs = useInterlocuteursSociete();
  const conducteurs = useConducteurs();
  const metiers = useMetiers();

  const champ = (cle: CleFiltre) => {
    switch (cle) {
      case "recherche":
        return (
          <input key={cle} type="text" id="factureSearchInput" aria-label="Rechercher" style={{ flex: 1, minWidth: "240px" }} value={saisie} placeholder={placeholderRecherche(vue)} title={aideRecherche(vue)} onChange={(e) => onSaisie(e.target.value)} onKeyDown={onEntree} />
        );
      case "client": {
        const noms = (clients.data ?? []).map((c) => c.nom).sort(parNom);
        return (
          <select key={cle} aria-label="Client" style={{ width: "auto", minWidth: "170px" }} value={filtres.client} onChange={(e) => changer({ client: e.target.value, interlocuteur: "" })}>
            <option value="">Tous les clients</option>
            {noms.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        );
      }
      case "interlocuteur": {
        // Ceux du client choisi, sinon tous ceux de la société (`planningUnschedInterlocuteurOptions`).
        const client = filtres.client ? (clients.data ?? []).find((c) => c.nom === filtres.client) : null;
        const liste = (interlocuteurs.data ?? []).filter((i) => !filtres.client || (client && i.client_id === client.id));
        return (
          <select key={cle} id="factureInterlocuteurSelect" aria-label="Interlocuteur" style={{ width: "auto", minWidth: "190px" }} value={filtres.interlocuteur} onChange={(e) => changer({ interlocuteur: e.target.value })}>
            <option value="">Tous les interlocuteurs</option>
            {liste.map((i) => i.nom).sort(parNom).map((n, k) => <option key={`${n}-${k}`} value={n}>{n}</option>)}
          </select>
        );
      }
      case "conducteur": {
        // Les actifs, plus celui déjà choisi : un conducteur retiré garde des affaires à son nom.
        const liste = (conducteurs.data ?? []).filter((c) => c.actif || c.nom === filtres.conducteur).map((c) => c.nom).sort(parNom);
        return (
          <select key={cle} aria-label="Conducteur" style={{ width: "auto", minWidth: "180px" }} value={filtres.conducteur} onChange={(e) => changer({ conducteur: e.target.value })}>
            <option value="">Tous les conducteurs</option>
            {liste.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        );
      }
      case "logement":
        return (
          <select key={cle} aria-label="Logement" style={{ width: "auto", minWidth: "170px" }} value={filtres.logement} onChange={(e) => changer({ logement: e.target.value })}>
            <option value="">Tous les logements</option>
            <option value="occupé">🏠 Logement occupé</option>
            <option value="vacant">🔑 Logement vacant</option>
            <option value="commune">🚪 Partie commune</option>
          </select>
        );
      case "metier": {
        const liste = (metiers.data ?? []).map((m) => m.libelle).sort(parNom);
        return (
          <select key={cle} aria-label="Métier" style={{ width: "auto", minWidth: "160px" }} value={filtres.metier} onChange={(e) => changer({ metier: e.target.value })}>
            <option value="">Tous les métiers</option>
            {liste.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        );
      }
      case "reglement":
        return (
          <select key={cle} aria-label="Règlement" style={{ width: "auto", minWidth: "170px" }} value={filtres.reglement} onChange={(e) => changer({ reglement: e.target.value })}>
            <option value="">Tous les règlements</option>
            <option value="payee">✅ Payées</option>
            <option value="partiel">🟡 Partielles</option>
            <option value="impayee">🔴 Impayées</option>
            <option value="retard">⏰ En retard</option>
          </select>
        );
      case "periode":
        return (
          <span key={cle} style={{ display: "contents" }}>
            <select aria-label="Période" style={{ width: "auto", minWidth: "170px" }} value={filtres.periode} onChange={(e) => changer({ periode: e.target.value as Periode })}>
              <option value="tout">Toute la période</option>
              <option value="mois">Ce mois-ci</option>
              <option value="annee">Cette année</option>
              <option value="plage">Période personnalisée…</option>
            </select>
            {filtres.periode === "plage" && (
              <>
                <input type="date" aria-label="Du" style={{ width: "auto" }} value={filtres.du} onChange={(e) => changer({ du: e.target.value })} title="Du" />
                <input type="date" aria-label="Au" style={{ width: "auto" }} value={filtres.au} onChange={(e) => changer({ au: e.target.value })} title="Au" />
              </>
            )}
          </span>
        );
    }
  };

  return (
    <div style={{ display: "flex", gap: "10px", marginBottom: "16px", flexWrap: "wrap", alignItems: "center" }}>
      {FILTRES_PAR_VUE[vue].map(champ)}
      {filtrageActif(criteresDeLaVue({ ...filtres, recherche: saisie }, vue)) && (
        <button type="button" className="btn small ghost" onClick={() => { onSaisie(""); changer(null); }} title="Tout réafficher">✕ Effacer</button>
      )}
    </div>
  );
}
