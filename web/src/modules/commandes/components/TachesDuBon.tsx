import type { CSSProperties, ReactNode } from "react";
import { formatDateFr } from "@/lib/dates";
import { messageErreur } from "@/lib/erreurs";
import { afficherToast } from "@/lib/toast";
import { metierDisplayLabel } from "@/modules/documents/impression/gabarit";
import { useSession } from "@/modules/auth-roles/hooks/useSession";
import { actionsTache, ETATS_TACHE, statutDe } from "../domain/circuit";
import { memeMetier, metiersDuBon } from "../domain/metiers";
import type { TacheBon } from "../domain/workflow";
import type { Bon } from "../api/bons";
import { useArbitrerTache, useCreerTaches, useMarquerRealisee } from "../hooks/useBons";

const echec = (e: unknown) => afficherToast(messageErreur(e));

/**
 * Une tâche réelle en `achat-row` (`renderValidationConducteurTaches`) : icône
 * et couleur de son état, « date · état ». `gestes` porte les boutons du
 * panneau ; la fenêtre du conducteur n'en met pas, comme l'ancienne.
 */
export function LigneTache({ tache, gestes }: { tache: TacheBon; gestes?: ReactNode }) {
  const etat = ETATS_TACHE[statutDe(tache.statut)];
  const titre = metierDisplayLabel(tache.metier ?? "") || tache.libelle || "Tâche";
  const detail = [tache.date_tache ? formatDateFr(tache.date_tache) : "", etat.libelle].filter(Boolean).join(" · ");
  return (
    <div className="achat-row" style={{ "--cat-color": etat.couleur } as CSSProperties}>
      <div className="achat-row-icon" style={{ background: `${etat.couleur}22`, color: etat.couleur }} aria-hidden="true">{etat.icone}</div>
      <div className="achat-row-main">
        <div className="achat-designation">{titre}</div>
        <div className="achat-date">{detail}</div>
        {tache.refus_motif && <div className="achat-date">Refus : {tache.refus_motif}</div>}
        {tache.commentaire && <div className="achat-date">« {tache.commentaire} »</div>}
      </div>
      {gestes}
    </div>
  );
}

/** Les gestes de la fiche d'intervention (`wfMarquerRealisee`, `wfValider`) : mêmes libellés, même `prompt` pour le motif. */
function GestesTache({ tache }: { tache: TacheBon }) {
  const { roleEffectif } = useSession();
  const realiser = useMarquerRealisee();
  const arbitrer = useArbitrerTache();
  const a = actionsTache(tache.statut, roleEffectif);
  function arbitrage(ok: boolean) {
    let motif: string | null = null;
    if (!ok) {
      // Un refus non motivé ne dit pas au technicien quoi reprendre.
      motif = window.prompt("Motif du refus (obligatoire) :");
      if (!motif?.trim()) return;
    }
    arbitrer.mutate({ tacheId: tache.id, ok, motif }, { onSuccess: () => afficherToast(ok ? "Travaux validés." : "Travaux renvoyés au technicien.", "success"), onError: echec });
  }
  return (
    <>
      {a.peutCloturer && (
        <button
          type="button"
          className="btn small primary"
          disabled={realiser.isPending}
          onClick={() => realiser.mutate({ tacheId: tache.id, commentaire: null }, { onSuccess: () => afficherToast("Travaux déclarés faits — en attente de validation.", "success"), onError: echec })}
        >
          ✓ Travaux terminés
        </button>
      )}
      {a.peutArbitrer && (
        <>
          <button type="button" className="btn small primary" disabled={arbitrer.isPending} onClick={() => arbitrage(true)}>✓ Valider</button>
          <button type="button" className="btn small ghost" disabled={arbitrer.isPending} onClick={() => arbitrage(false)}>✕ Refuser</button>
        </>
      )}
    </>
  );
}

interface Props {
  bon: Bon;
  taches: readonly TacheBon[];
  circuitOuvert: boolean;
}

/**
 * Les tâches du bon, une par métier et par journée (BC-37) : le terrain les
 * déclare faites, le conducteur les arbitre. Un métier du bon sans tâche peut
 * en recevoir une d'ici ; sa date viendra du planning.
 */
export function TachesDuBon({ bon, taches, circuitOuvert }: Props) {
  const { roleEffectif } = useSession();
  const creer = useCreerTaches();
  const encadrement = actionsTache("planifiee", roleEffectif).peutPlanifier;
  const manquants = metiersDuBon(bon).filter((m) => !taches.some((t) => memeMetier(t.metier, m)));
  return (
    <section aria-label="Travaux réalisés">
      <div className="section-title" style={{ marginTop: "14px" }}>✅ Travaux réalisés</div>
      {!taches.length && <div className="empty">Aucune tâche planifiée : le bon n'est pas encore passé au planning.</div>}
      {taches.map((t) => <LigneTache key={t.id} tache={t} gestes={<GestesTache tache={t} />} />)}
      {encadrement && circuitOuvert && manquants.length > 0 && (
        <button
          type="button"
          className="btn small"
          style={{ marginTop: "8px" }}
          disabled={creer.isPending}
          onClick={() => creer.mutate({ bon, existantes: taches }, { onSuccess: (n) => afficherToast(`${n} tâche(s) créée(s), une par métier — à dater au planning.`, "success"), onError: echec })}
        >
          Créer les tâches manquantes ({manquants.join(", ")})
        </button>
      )}
    </section>
  );
}
