import type { ReactNode } from "react";
import { formatDateFr } from "@/lib/dates";
import type { Constats } from "../api/planning";
import type { TachePlanning } from "../domain/cartes";
import { actionsTache, appartenanceDe, LIBELLES_STATUT, motifLectureSeule, prochainActeur, statutDe } from "../domain/taches";
import { useMarquerRealisee, useSauvegarderTerrain, useValiderTache } from "../hooks/usePlanning";
import { usePlanningContexte } from "./contexte";
import { libelleDuMetier } from "./format";

interface Props {
  tache: TachePlanning;
  metier: string | null;
  horsMetier?: boolean;
  /** Les travaux du bon qui reviennent à cette tâche (`travauxTacheHTML`). */
  travaux?: ReactNode;
  /** Les constats saisis plus bas dans la fiche, que chaque bouton emporte. */
  constats: Constats;
}

/**
 * Le circuit d'une tâche (`bandeauTacheHTML`, PLN-08) : son état, à qui elle
 * est confiée, qui a fait quoi, à qui le tour — et les seuls gestes que la base
 * accepterait de ce compte (`actionsTache`). Le motif de lecture seule reprend
 * mot pour mot celui que la base opposerait. Sans le nom des auteurs (D-PLN-18).
 */
export function BandeauTache({ tache, metier, horsMetier = false, travaux, constats }: Props) {
  const { role, donnees, nomEquipe, nomSousTraitant, signaler } = usePlanningContexte();
  const sauver = useSauvegarderTerrain();
  const terminer = useMarquerRealisee();
  const valider = useValiderTache();
  const statut = statutDe(tache.statut);
  const appartenance = appartenanceDe(tache, donnees.monEquipeId, donnees.monSousTraitantId);
  const droits = actionsTache(statut, role, appartenance);
  const lectureSeule = motifLectureSeule(role, appartenance);
  const confiee = nomEquipe(tache.technicien_id) ?? nomSousTraitant(tache.sous_traitant_id);
  const enCours = sauver.isPending || terminer.isPending || valider.isPending;
  const cestMonTour = (statut === "realisee" && droits.peutArbitrer) || ((statut === "planifiee" || statut === "refusee") && droits.peutCloturer);
  const suite = (message: string) => ({ onSuccess: () => signaler(message), onError: (e: unknown) => signaler("", e) });
  const refuser = () => {
    // Un refus non motivé ne dit pas au technicien quoi reprendre.
    const motif = window.prompt("Motif du refus (obligatoire) :");
    if (!motif || !motif.trim()) return;
    valider.mutate({ tacheId: tache.id, ok: false, motif }, suite("Travaux renvoyés au technicien."));
  };
  const histoire = [
    tache.realisee_le && `Déclarés faits le ${formatDateFr(tache.realisee_le)}`,
    tache.validee_le && `Validés le ${formatDateFr(tache.validee_le)}`,
    statut === "refusee" && tache.validee_par && "Refusés",
  ].filter((x): x is string => !!x);

  return (
    <div className="wf-bandeau" role="group" aria-label={`Tâche ${metier ?? "sans métier"}`}>
      {metier && <div className="wf-metier">{libelleDuMetier(metier)}</div>}
      {travaux}
      {horsMetier && <div className="wf-metier wf-hors-metier">Hors métier{metier ? "" : " — tâche sans métier"}</div>}
      <span className={`wf-etat wf-${statut}`}>{LIBELLES_STATUT[statut]}</span>
      {confiee ? <div className="wf-equipe">👷 Confiée à {confiee}</div> : <div className="wf-equipe wf-sans-equipe">👷 Aucune équipe affectée</div>}
      {statut === "refusee" && tache.refus_motif && <div className="wf-motif">↩ {tache.refus_motif}</div>}
      {histoire.length > 0 && (
        <div className="wf-meta">
          {histoire.map((h, i) => (
            <span key={h}>
              {i > 0 && <br />}
              {h}
            </span>
          ))}
        </div>
      )}
      <div className="wf-attente">
        {statut === "validee" ? (
          <span className="wf-clos">✓ Circuit terminé pour cette tâche</span>
        ) : cestMonTour ? (
          <span className="wf-tour wf-tour-moi">⏳ À vous de jouer — {prochainActeur(statut)}</span>
        ) : (
          <span className="wf-tour">⏳ En attente de {prochainActeur(statut)}</span>
        )}
      </div>
      {droits.peutSaisir || droits.peutCloturer || droits.peutArbitrer ? (
        <div className="wf-actions">
          {droits.peutSaisir && (
            <button type="button" className="btn" disabled={enCours} onClick={() => sauver.mutate({ tacheId: tache.id, constats }, suite("Constats enregistrés."))}>
              💾 Enregistrer mes constats
            </button>
          )}
          {droits.peutCloturer && (
            <button type="button" className="btn primary" disabled={enCours} onClick={() => terminer.mutate({ tacheId: tache.id, constats }, suite("Travaux déclarés faits — en attente de validation."))}>
              ✓ Travaux terminés
            </button>
          )}
          {droits.peutArbitrer && (
            <>
              <button type="button" className="btn primary" disabled={enCours} onClick={() => valider.mutate({ tacheId: tache.id, ok: true, motif: null }, suite("Travaux validés."))}>
                ✓ Valider
              </button>
              <button type="button" className="btn ghost" disabled={enCours} onClick={refuser}>
                ✕ Refuser
              </button>
            </>
          )}
        </div>
      ) : (
        <div className="wf-meta">{lectureSeule ?? "Aucune action ouverte à votre rôle à cette étape."}</div>
      )}
    </div>
  );
}
