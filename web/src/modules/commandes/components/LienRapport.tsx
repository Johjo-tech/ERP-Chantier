import { useState } from "react";
import { messageErreur } from "@/lib/erreurs";
import { correspond } from "@/lib/recherche";
import { afficherToast } from "@/lib/toast";
import { useLierBon, useRapports } from "@/modules/interventions/hooks/useRapports";
import type { EnteteBon } from "../domain/bon";
import { avecVille } from "../domain/carte";

/** Au plus huit propositions, comme `searchLienCandidat` : au-delà, on affine la recherche. */
const PROPOSITIONS_MAX = 8;
/** Le délai de `onblur` de l'ancien : le temps qu'un clic sur une proposition arrive. */
const DELAI_FERMETURE_MS = 180;
/** Les messages brefs de `confirmerLien` et `delierLien`. */
const DUREE_TOAST_LIEN_MS = 2000;
const DUREE_TOAST_DELIER_MS = 2500;

/**
 * Lier un rapport à ce bon (`lienWidgetHTML('bonCommande', …)`) : les rapports
 * du même client qui n'ont pas encore de bon. Un autre rapport déjà lié à ce
 * bon perd son lien (`lierBon`), comme dans l'ancien.
 */
export function LienRapport({ bon, onFermer }: { bon: EnteteBon; onFermer: () => void }) {
  const rapports = useRapports();
  const lier = useLierBon();
  const [q, setQ] = useState("");
  const [ouverte, setOuverte] = useState(false);
  const candidats = (rapports.data ?? [])
    .filter((r) => !r.bon_commande_id && (!bon.client_nom || r.client_nom === bon.client_nom))
    .map((r) => ({ id: r.id, numero: r.numero, client: r.client_nom, adresse: avecVille(r.adresse_locataire || r.adresse, r.code_postal, r.ville), numeroLogement: r.numero_logement }));
  const trouves = candidats.filter((c) => correspond(q, c.numero, c.client, c.adresse, c.numeroLogement)).slice(0, PROPOSITIONS_MAX);
  function choisir(rapportId: string) {
    lier.mutate(
      { rapportId, bcId: bon.id },
      { onSuccess: () => { onFermer(); afficherToast("🔗 Lié avec succès !", "success", DUREE_TOAST_LIEN_MS); }, onError: (e) => afficherToast(messageErreur(e)) }
    );
  }
  return (
    <div onClick={(e) => e.stopPropagation()} style={{ position: "relative" }}>
      <input
        type="text"
        id={`lienSearch-${bon.id}`}
        aria-label="Rechercher un rapport"
        placeholder="Rechercher un rapport : n°, adresse, n° logement…"
        autoComplete="off"
        style={{ width: "100%" }}
        value={q}
        onChange={(e) => { setQ(e.target.value); setOuverte(true); }}
        onFocus={() => setOuverte(true)}
        onBlur={() => setTimeout(() => setOuverte(false), DELAI_FERMETURE_MS)}
      />
      <div id={`lienSuggest-${bon.id}`} className="suggest-box" style={{ display: ouverte ? "block" : "none" }}>
        {trouves.length ? (
          trouves.map((c) => (
            <div key={c.id} className="suggest-item" onMouseDown={() => choisir(c.id)}>
              <b>{c.numero || "—"}</b>
              <small>{c.client}{c.adresse ? ` — ${c.adresse}` : ""}{c.numeroLogement ? ` · N° ${c.numeroLogement}` : ""}</small>
            </div>
          ))
        ) : (
          <div className="suggest-empty">Aucun résultat</div>
        )}
      </div>
      <button type="button" className="btn small ghost" style={{ marginTop: "4px" }} onClick={onFermer}>Annuler</button>
    </div>
  );
}

/** « ✂️ Délier » : retirer le lien entre le bon et son rapport (`delierLien`). */
function Delier({ rapportId }: { rapportId: string }) {
  const lier = useLierBon();
  return (
    <button
      type="button"
      className="btn small ghost"
      title="Retirer le lien entre ce bon de commande et son rapport"
      disabled={lier.isPending}
      onClick={(e) => {
        e.stopPropagation();
        lier.mutate({ rapportId, bcId: null }, { onSuccess: () => afficherToast("✂️ Lien retiré — vous pouvez maintenant lier à un autre document.", "success", DUREE_TOAST_DELIER_MS), onError: (err) => afficherToast(messageErreur(err)) });
      }}
    >
      ✂️ Délier
    </button>
  );
}

LienRapport.Delier = Delier;
