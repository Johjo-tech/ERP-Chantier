import { useEffect, useId, useState } from "react";
import { formatDateFr } from "@/lib/dates";
import { tacheDuJour, type CartePlanning } from "../domain/cartes";
import { actionsTache, appartenanceDe, statutDe } from "../domain/taches";
import { useMarquerRealisee, useSauvegarderTerrain } from "../hooks/usePlanning";
import { usePlanningContexte } from "./contexte";
import { autresDates, constatsInitiaux, journeeSupplementaire } from "./fiche";
import { avecVille } from "./format";
import { PhotosTerrain } from "./PhotosTerrain";
import { TravauxSupplementaires } from "./TravauxSupplementaires";

interface Props {
  carte: CartePlanning;
  jour: string | null;
  onFermer: () => void;
}

/**
 * « Valider les travaux » du sous-traitant (`stValidationModal`). La case
 * « Travaux de cette date réalisés » écrivait un champ sans colonne : elle
 * déclare désormais la tâche faite, par la même voie que « ✓ Travaux
 * terminés » du technicien (D-PLN-05, D-ECR-PLN-07). Aucun prix.
 */
export function FicheSousTraitant({ carte, jour, onFermer }: Props) {
  const { role, donnees, signaler } = usePlanningContexte();
  const sauver = useSauvegarderTerrain();
  const terminer = useMarquerRealisee();
  const idTitre = useId();
  const suppl = journeeSupplementaire(carte, jour);
  const jourVise = suppl ?? carte.rdv.datePlanifiee;
  const tache = tacheDuJour(carte, carte.metier, jourVise) ?? carte.taches.find((t) => t.date_tache === jourVise) ?? null;
  const statut = statutDe(tache?.statut ?? null);
  const droits = tache ? actionsTache(statut, role, appartenanceDe(tache, donnees.monEquipeId, donnees.monSousTraitantId)) : null;
  const dejaFaite = statut === "realisee" || statut === "validee";
  const [faite, setFaite] = useState(dejaFaite);
  const [commentaire, setCommentaire] = useState(tache?.commentaire ?? "");
  const b = carte.bon;
  const lieu = avecVille(b.adresse_locataire || b.adresse, b.code_postal, b.ville);

  useEffect(() => {
    const echap = (e: KeyboardEvent) => e.key === "Escape" && onFermer();
    document.addEventListener("keydown", echap);
    return () => document.removeEventListener("keydown", echap);
  }, [onFermer]);

  const enregistrer = () => {
    if (!tache || !droits?.peutSaisir) return onFermer();
    const constats = { ...constatsInitiaux(tache), commentaire };
    const fin = { onSuccess: () => (onFermer(), signaler("✓ Travaux validés — merci !")), onError: (e: unknown) => signaler("", e) };
    if (faite && !dejaFaite && droits.peutCloturer) terminer.mutate({ tacheId: tache.id, constats }, fin);
    else sauver.mutate({ tacheId: tache.id, constats }, fin);
  };

  return (
    <div className="view-modal open" role="dialog" aria-modal="true" aria-labelledby={idTitre} onClick={(e) => e.target === e.currentTarget && onFermer()}>
      <div className="view-modal-panel" style={{ maxWidth: "440px", padding: "24px" }}>
        <h3 id={idTitre} style={{ marginTop: 0 }}>
          Valider les travaux — {b.numero_bc || b.client_nom}
          {suppl ? ` — ${formatDateFr(suppl)}` : ""}
        </h3>
        <div className="card-sub" style={{ marginBottom: "12px" }}>
          {b.client_nom} — {lieu}
          {b.numero_logement ? ` · N° ${b.numero_logement}` : ""}
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 600, cursor: "pointer" }}>
          <input type="checkbox" style={{ width: "18px", height: "18px" }} checked={faite} disabled={dejaFaite || !droits?.peutCloturer} onChange={(e) => setFaite(e.target.checked)} /> Travaux de cette date réalisés
        </label>
        <div className="card-sub" style={{ marginTop: "8px" }}>
          {autresDates(carte, jourVise)}
        </div>
        <div className="field" style={{ marginTop: "12px" }}>
          <label htmlFor={`${idTitre}-commentaire`}>Commentaire (facultatif)</label>
          <textarea id={`${idTitre}-commentaire`} rows={3} placeholder="Remarques sur les travaux réalisés…" value={commentaire} onChange={(e) => setCommentaire(e.target.value)} />
        </div>
        <div className="field" style={{ marginTop: "12px" }}>
          <label>➕ Travaux supplémentaires (non prévus)</label>
          <TravauxSupplementaires bcId={carte.bcId} tacheId={tache?.id ?? null} compacte />
        </div>
        <div className="field" style={{ marginTop: "12px" }}>
          <label>📷 Photos</label>
          <PhotosTerrain bcId={carte.bcId} grilleStyle={{ marginTop: "8px" }} />
        </div>
        <div style={{ display: "flex", gap: "10px", marginTop: "14px" }}>
          <button type="button" className="btn primary" disabled={sauver.isPending || terminer.isPending} onClick={enregistrer}>
            ✓ Enregistrer
          </button>
          <button type="button" className="btn ghost" onClick={onFermer}>
            Annuler
          </button>
        </div>
      </div>
    </div>
  );
}
