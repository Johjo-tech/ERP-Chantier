import { Modale } from "@/components/ui/modale";
import { messageErreur } from "@/lib/erreurs";
import { afficherToast } from "@/lib/toast";
import type { Bon } from "../api/bons";
import { blocagesValidationConducteur, messageBlocages } from "../domain/circuit";
import { metiersDuBon } from "../domain/metiers";
import type { TacheBon } from "../domain/workflow";
import { useTaches, useTravaux, useValiderConducteur } from "../hooks/useBons";
import { LigneTache } from "./TachesDuBon";
import { AjoutTravail, ListeTravaux } from "./TravauxSupplementaires";

/** Les tâches réelles, puis le bandeau qui dit ce qui bloque (`renderValidationConducteurTaches`). */
function TachesAValider({ bon, taches }: { bon: Bon; taches: readonly TacheBon[] }) {
  if (!taches.length) return <div className="empty">Aucune tâche planifiée : il n'y a rien à valider sur cette affaire.</div>;
  const blocages = blocagesValidationConducteur(taches, metiersDuBon(bon));
  return (
    <>
      {taches.map((t) => <LigneTache key={t.id} tache={t} />)}
      {blocages.length ? (
        <div className="wf-banner alerte" style={{ marginTop: "10px", whiteSpace: "pre-line" }}>⚠ {messageBlocages(blocages)}</div>
      ) : (
        <div className="wf-banner ok" style={{ marginTop: "10px" }}>✓ Toutes les tâches sont pointées : l'affaire peut être validée.</div>
      )}
    </>
  );
}

/**
 * La fenêtre du conducteur (`#validationConducteurModal`, BC-16, BC-38) : sur
 * les tâches RÉELLES, pas sur la liste des métiers. Le bouton ne s'ouvre
 * qu'une fois tout pointé — et la base redira non si quelque chose a bougé.
 */
export function ModaleValidationConducteur({ bon, onFermer }: { bon: Bon; onFermer: () => void }) {
  const taches = useTaches(bon.id);
  const travaux = useTravaux(bon.id);
  const valider = useValiderConducteur();
  const pret = taches.isSuccess && taches.data.length > 0 && blocagesValidationConducteur(taches.data, metiersDuBon(bon)).length === 0;
  return (
    <Modale titre="Valider ce bon de commande" onFermer={onFermer} largeurMax="560px">
      <p className="card-sub">{`${bon.numero_bc || bon.client_nom} — ${bon.client_nom}`}</p>
      <div className="section-title" style={{ marginTop: "14px" }}>✅ Travaux réalisés</div>
      <div>
        {taches.isPending && <div className="empty">Chargement des tâches…</div>}
        {taches.isError && <div className="empty">Tâches indisponibles : {messageErreur(taches.error)}</div>}
        {taches.isSuccess && <TachesAValider bon={bon} taches={taches.data} />}
      </div>
      <div className="section-title" style={{ marginTop: "16px" }}>➕ Ajouter un travail effectué (sans prix)</div>
      <p className="card-sub">Pour signaler un travail réalisé en plus de ce qui était prévu, sans montant associé — utile pour informer le bureau sans facturer automatiquement.</p>
      <AjoutTravail bonId={bon.id} />
      <div style={{ marginTop: "8px" }}>
        {travaux.isError ? <div className="empty">Liste indisponible.</div> : <ListeTravaux travaux={travaux.data ?? []} ecrit />}
      </div>
      <div style={{ display: "flex", gap: "10px", marginTop: "18px" }}>
        <button
          type="button"
          className="btn primary"
          disabled={!pret || valider.isPending}
          onClick={() =>
            valider.mutate(bon, {
              onSuccess: () => { onFermer(); afficherToast("Affaire validée par le conducteur.", "success"); },
              onError: (e) => afficherToast(messageErreur(e)),
            })
          }
        >
          ✓ Confirmer la validation
        </button>
        <button type="button" className="btn ghost" onClick={onFermer}>Annuler</button>
      </div>
    </Modale>
  );
}
