import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { formatDateFr } from "@/lib/dates";
import type { Constats } from "../api/planning";
import type { TachePlanning } from "../domain/cartes";
import { actionsTache, appartenanceDe, LIBELLES_STATUT, motifLectureSeule, prochainActeur, statutDe } from "../domain/taches";
import { useMarquerRealisee, useSauvegarderTerrain, useValiderTache } from "../hooks/usePlanning";
import { usePlanningContexte } from "./contexte";

const VARIANTE: Record<string, "default" | "succes" | "alerte" | "danger"> = { planifiee: "default", realisee: "alerte", validee: "succes", refusee: "danger" };

interface Props {
  tache: TachePlanning;
  metier: string | null;
  horsMetier?: boolean;
  constats: Constats;
}

/**
 * Le circuit d'une tâche (PLN-08) : son état, à qui elle est confiée, qui a
 * fait quoi, à qui le tour — et les seuls gestes que la base accepterait de ce
 * compte (`actionsTache`). Le motif de lecture seule reprend mot pour mot
 * celui que la base opposerait.
 */
export function BandeauTache({ tache, metier, horsMetier = false, constats }: Props) {
  const { role, donnees, nomEquipe, nomSousTraitant, signaler } = usePlanningContexte();
  const sauver = useSauvegarderTerrain();
  const terminer = useMarquerRealisee();
  const valider = useValiderTache();
  const [refus, setRefus] = useState<string | null>(null);
  const statut = statutDe(tache.statut);
  const appartenance = appartenanceDe(tache, donnees.monEquipeId, donnees.monSousTraitantId);
  const droits = actionsTache(statut, role, appartenance);
  const lectureSeule = motifLectureSeule(role, appartenance);
  const confiee = nomEquipe(tache.technicien_id) ?? nomSousTraitant(tache.sous_traitant_id);
  const enCours = sauver.isPending || terminer.isPending || valider.isPending;
  const cestMonTour = (statut === "realisee" && droits.peutArbitrer) || ((statut === "planifiee" || statut === "refusee") && droits.peutCloturer);
  const suite = (message: string) => ({ onSuccess: () => signaler(message), onError: (e: unknown) => signaler("", e) });

  return (
    <section aria-label={`Tâche ${metier ?? "sans métier"}`} className="flex flex-col gap-1.5 rounded-md border p-2 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        {metier && <span className="font-semibold">{metier}</span>}
        {horsMetier && <span className="text-xs text-muted-foreground">Hors métier{metier ? "" : " — tâche sans métier"}</span>}
        <Badge variant={VARIANTE[statut] ?? "default"}>{LIBELLES_STATUT[statut]}</Badge>
        {tache.date_tache && <span className="text-xs text-muted-foreground">{formatDateFr(tache.date_tache)}{tache.heure_debut ? ` · ${tache.heure_debut}–${tache.heure_fin ?? ""}` : ""}</span>}
      </div>
      <p className="text-xs">{confiee ? `👷 Confiée à ${confiee}` : "👷 Aucune équipe affectée"}</p>
      {statut === "refusee" && tache.refus_motif && <p className="text-xs text-destructive">↩ {tache.refus_motif}</p>}
      {tache.realisee_le && <p className="text-xs text-muted-foreground">Déclarés faits le {formatDateFr(tache.realisee_le)}</p>}
      {tache.validee_le && <p className="text-xs text-muted-foreground">Validés le {formatDateFr(tache.validee_le)}</p>}
      <p className="text-xs">{statut === "validee" ? "✓ Circuit terminé pour cette tâche" : cestMonTour ? `⏳ À vous de jouer — ${prochainActeur(statut)}` : `⏳ En attente : ${prochainActeur(statut)}`}</p>
      <div className="flex flex-wrap gap-2">
        {droits.peutSaisir && <Button size="sm" variant="outline" disabled={enCours} onClick={() => sauver.mutate({ tacheId: tache.id, constats }, suite("Constats enregistrés."))}>💾 Enregistrer mes constats</Button>}
        {droits.peutCloturer && <Button size="sm" disabled={enCours} onClick={() => terminer.mutate({ tacheId: tache.id, constats }, suite("Travaux déclarés faits — en attente de validation."))}>✓ Travaux terminés</Button>}
        {droits.peutArbitrer && refus === null && (
          <>
            <Button size="sm" disabled={enCours} onClick={() => valider.mutate({ tacheId: tache.id, ok: true, motif: null }, suite("Travaux validés."))}>✓ Valider</Button>
            <Button size="sm" variant="outline" disabled={enCours} onClick={() => setRefus("")}>✕ Refuser</Button>
          </>
        )}
      </div>
      {refus !== null && (
        <div className="flex flex-col gap-1">
          <label htmlFor={`motif-${tache.id}`} className="text-xs font-medium">Motif du refus (obligatoire)</label>
          <Textarea id={`motif-${tache.id}`} value={refus} onChange={(e) => setRefus(e.target.value)} />
          <div className="flex gap-2">
            <Button size="sm" variant="destructive" disabled={!refus.trim() || enCours} onClick={() => valider.mutate({ tacheId: tache.id, ok: false, motif: refus }, { ...suite("Travaux renvoyés au technicien."), onSettled: () => setRefus(null) })}>Confirmer le refus</Button>
            <Button size="sm" variant="ghost" onClick={() => setRefus(null)}>Annuler</Button>
          </div>
        </div>
      )}
      {!droits.peutSaisir && !droits.peutCloturer && !droits.peutArbitrer && <p className="text-xs text-muted-foreground">{lectureSeule ?? "Aucune action ouverte à votre rôle à cette étape."}</p>}
    </section>
  );
}
