import { useState } from "react";
import { correspond } from "@/lib/recherche";
import { useBonsLiables } from "../hooks/useRapports";

const SUGGESTIONS_MAX = 8;
/** Le temps de laisser partir le clic sur une suggestion avant que la perte du focus ne la cache (`onblur` de l'ancien). */
const DELAI_FERMETURE_MS = 180;

/**
 * Chercher un bon à lier : n°, adresse, n° de logement (`lienWidgetHTML`,
 * `searchLienCandidat`). Seuls les bons du client du rapport sont proposés,
 * comme l'ancien écran ; les suggestions s'ouvrent au focus.
 */
export function LienBon({ rapportId, clientId, clientNom, onChoisir, onAnnuler }: { rapportId: string; clientId: string | null; clientNom: string; onChoisir: (bcId: string) => void; onAnnuler: () => void }) {
  const bons = useBonsLiables();
  const [recherche, setRecherche] = useState("");
  const [ouvert, setOuvert] = useState(false);
  const candidats = (bons.data ?? [])
    .filter((b) => (clientId ? b.client_id === clientId : !clientNom || b.client_nom === clientNom))
    .filter((b) => correspond(recherche, b.numero_bc, b.numero_interne, b.client_nom, b.adresse, b.code_postal, b.ville, b.numero_logement))
    .slice(0, SUGGESTIONS_MAX);
  return (
    <div onClick={(e) => e.stopPropagation()} style={{ position: "relative" }}>
      <input
        type="text"
        id={`lienSearch-${rapportId}`}
        aria-label="Rechercher un bon de commande"
        placeholder="Rechercher un bon de commande : n°, adresse, n° logement…"
        autoComplete="off"
        style={{ width: "100%" }}
        value={recherche}
        onChange={(e) => {
          setRecherche(e.target.value);
          setOuvert(true);
        }}
        onFocus={() => setOuvert(true)}
        onBlur={() => window.setTimeout(() => setOuvert(false), DELAI_FERMETURE_MS)}
      />
      <div id={`lienSuggest-${rapportId}`} className="suggest-box" style={{ display: ouvert ? "block" : "none" }}>
        {candidats.length ? (
          candidats.map((b) => (
            <div key={b.id} className="suggest-item" role="option" aria-selected={false} onMouseDown={() => onChoisir(b.id)}>
              <b>{b.numero_bc || b.numero_interne || "—"}</b>
              <small>
                {b.client_nom}
                {b.adresse ? ` — ${b.adresse}` : ""}
                {b.numero_logement ? ` · N° ${b.numero_logement}` : ""}
              </small>
            </div>
          ))
        ) : (
          <div className="suggest-empty">Aucun résultat</div>
        )}
      </div>
      <button type="button" className="btn small ghost" style={{ marginTop: "4px" }} onClick={onAnnuler}>
        Annuler
      </button>
    </div>
  );
}
