import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDateFr } from "@/lib/dates";
import { messageErreur } from "@/lib/erreurs";
import { useSession } from "@/modules/auth-roles/hooks/useSession";
import { actionsTache, ETATS_TACHE, statutDe } from "../domain/circuit";
import { memeMetier, metiersDuBon } from "../domain/metiers";
import type { TacheBon } from "../domain/workflow";
import type { Bon } from "../api/bons";
import { useArbitrerTache, useCreerTaches, useMarquerRealisee } from "../hooks/useBons";

/** Refuser demande un motif, saisi au même endroit : sans lui, le terrain ne sait pas quoi reprendre. */
function Arbitrage({ tache, onResultat }: { tache: TacheBon; onResultat: (m: string, e?: unknown) => void }) {
  const arbitrer = useArbitrerTache();
  const [refus, setRefus] = useState(false);
  const [motif, setMotif] = useState("");
  const nom = tache.metier || tache.libelle || "la tâche";
  const agir = (ok: boolean) =>
    arbitrer.mutate(
      { tacheId: tache.id, ok, motif: ok ? null : motif },
      { onSuccess: () => onResultat(ok ? `Tâche « ${nom} » validée.` : `Tâche « ${nom} » refusée — le terrain doit la reprendre.`), onError: (e) => onResultat("", e) }
    );
  if (!refus) {
    return (
      <span className="flex gap-2">
        <Button size="sm" disabled={arbitrer.isPending} onClick={() => agir(true)}>Valider</Button>
        <Button size="sm" variant="outline" disabled={arbitrer.isPending} onClick={() => setRefus(true)}>Refuser…</Button>
      </span>
    );
  }
  return (
    <form className="flex flex-wrap items-center gap-2" onSubmit={(e) => { e.preventDefault(); agir(false); }}>
      <label htmlFor={`motif-${tache.id}`} className="sr-only">Motif du refus de « {nom} »</label>
      <Input id={`motif-${tache.id}`} className="h-8 w-60" placeholder="Motif du refus (obligatoire)" value={motif} onChange={(e) => setMotif(e.target.value)} autoFocus />
      <Button type="submit" size="sm" variant="destructive" disabled={arbitrer.isPending || !motif.trim()}>Refuser</Button>
      <Button size="sm" variant="ghost" onClick={() => setRefus(false)}>Annuler</Button>
    </form>
  );
}

function LigneTache({ tache, onResultat }: { tache: TacheBon; onResultat: (m: string, e?: unknown) => void }) {
  const { roleEffectif } = useSession();
  const realiser = useMarquerRealisee();
  const a = actionsTache(tache.statut, roleEffectif);
  const etat = ETATS_TACHE[statutDe(tache.statut)];
  const nom = tache.metier || tache.libelle || "Tâche";
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2">
      <span className="flex flex-col">
        <span className="font-medium">{nom}</span>
        <span className="text-xs text-muted-foreground">
          {tache.date_tache ? formatDateFr(tache.date_tache) : "non datée"} · <Badge variant={etat.variante}>{etat.libelle}</Badge>
        </span>
        {tache.refus_motif && <span className="text-xs text-destructive">Refus : {tache.refus_motif}</span>}
        {tache.commentaire && <span className="text-xs italic">« {tache.commentaire} »</span>}
      </span>
      <span className="flex gap-2">
        {a.peutCloturer && (
          <Button
            size="sm"
            variant="secondary"
            disabled={realiser.isPending}
            onClick={() => realiser.mutate({ tacheId: tache.id, commentaire: null }, { onSuccess: () => onResultat(`Travaux « ${nom} » déclarés faits — à arbitrer par le conducteur.`), onError: (e) => onResultat("", e) })}
          >
            Travaux faits
          </Button>
        )}
        {a.peutArbitrer && <Arbitrage tache={tache} onResultat={onResultat} />}
      </span>
    </li>
  );
}

interface Props {
  bon: Bon;
  taches: readonly TacheBon[];
  circuitOuvert: boolean;
  onResultat: (m: string, e?: unknown) => void;
}

/**
 * Les tâches du bon, une par métier et par journée (BC-37) : le terrain les
 * déclare faites, le conducteur les arbitre. Un métier du bon sans tâche peut
 * en recevoir une d'ici ; sa date viendra du planning.
 */
export function TachesDuBon({ bon, taches, circuitOuvert, onResultat }: Props) {
  const { roleEffectif } = useSession();
  const creer = useCreerTaches();
  const encadrement = actionsTache("planifiee", roleEffectif).peutPlanifier;
  const manquants = metiersDuBon(bon).filter((m) => !taches.some((t) => memeMetier(t.metier, m)));
  return (
    <section aria-labelledby="titre-taches" className="flex flex-col gap-2">
      <h3 id="titre-taches" className="text-sm font-semibold">Tâches du terrain ({taches.length})</h3>
      {!taches.length && <p className="text-sm text-muted-foreground">Aucune tâche planifiée : le bon n'est pas encore passé au planning.</p>}
      <ul className="flex flex-col gap-2">{taches.map((t) => <LigneTache key={t.id} tache={t} onResultat={onResultat} />)}</ul>
      {encadrement && circuitOuvert && manquants.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={creer.isPending}
            onClick={() => creer.mutate({ bon, existantes: taches }, { onSuccess: (n) => onResultat(`${n} tâche(s) créée(s), une par métier — à dater au planning.`), onError: (e) => onResultat("", e) })}
          >
            Créer les tâches manquantes ({manquants.join(", ")})
          </Button>
        </div>
      )}
      {creer.isError && <Alert variant="erreur">{messageErreur(creer.error)}</Alert>}
    </section>
  );
}
