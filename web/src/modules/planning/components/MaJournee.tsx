import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDateFr, todayISO } from "@/lib/dates";
import { ajouterJours } from "../domain/calendrier";
import { tacheDuJour } from "../domain/cartes";
import { mesCartesDuJour, tachesAReprendre } from "../domain/filtres";
import { LIBELLES_STATUT, statutDe } from "../domain/taches";
import { usePlanningContexte } from "./contexte";
import { adresseDuLieu, numeroDeLaCarte } from "./format";

/**
 * L'écran du terrain : les interventions du jour de MON équipe, dans l'ordre
 * des heures, et ce que le conducteur m'a renvoyé. Un appui ouvre la fiche
 * (constats, pièce, croquis, photos, « Travaux terminés »). Aucun prix.
 */
export function MaJournee() {
  const { cartes, donnees, ouvrirFiche } = usePlanningContexte();
  const [jour, setJour] = useState(todayISO());
  const { monEquipeId, monSousTraitantId } = donnees;
  const duJour = mesCartesDuJour(cartes, jour, monEquipeId, monSousTraitantId);
  const aReprendre = tachesAReprendre(cartes, monEquipeId, monSousTraitantId);

  if (!monEquipeId && !monSousTraitantId) {
    return <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">Votre compte n'est rattaché à aucune équipe ni entreprise sous-traitante : demandez au conducteur de vous affecter pour voir vos interventions.</p>;
  }
  return (
    <section aria-label="Ma journée" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" aria-label="Jour précédent" onClick={() => setJour(ajouterJours(jour, -1))}>←</Button>
        <label className="sr-only" htmlFor="jour-terrain">Jour</label>
        <Input id="jour-terrain" type="date" className="w-40" value={jour} onChange={(e) => e.target.value && setJour(e.target.value)} />
        <Button variant="outline" size="sm" aria-label="Jour suivant" onClick={() => setJour(ajouterJours(jour, 1))}>→</Button>
        {jour !== todayISO() && <Button variant="ghost" size="sm" onClick={() => setJour(todayISO())}>Aujourd'hui</Button>}
      </div>
      <h2 className="text-base font-semibold">Mes interventions du {formatDateFr(jour)} ({duJour.length})</h2>
      {!duJour.length && <p className="text-sm text-muted-foreground">Aucune intervention prévue ce jour-là.</p>}
      <ul className="flex flex-col gap-2">
        {duJour.map((c) => {
          const t = tacheDuJour(c, c.metier, jour);
          const heure = c.rdv.datePlanifiee === jour ? c.rdv.heurePlanifiee : c.suppl.find((d) => d.date === jour)?.creneau?.heure;
          return (
            <li key={c.id}>
              <button type="button" className="flex w-full flex-col gap-0.5 rounded-md border bg-card p-3 text-left text-sm hover:bg-muted" onClick={() => ouvrirFiche(c, jour)}>
                <span className="font-semibold">{heure ?? "—"} · {c.bon.client_nom}</span>
                <span>{numeroDeLaCarte(c)}{c.metier ? ` · ${c.metier}` : ""}</span>
                <span className="text-muted-foreground">📍 {adresseDuLieu(c)}</span>
                <span className="text-xs">{t ? LIBELLES_STATUT[statutDe(t.statut)] : "Fiche à préparer"}</span>
              </button>
            </li>
          );
        })}
      </ul>
      {aReprendre.length > 0 && (
        <>
          <h2 className="text-base font-semibold text-destructive">À reprendre ({aReprendre.length})</h2>
          <ul className="flex flex-col gap-2">
            {aReprendre.map(({ carte, tache }) => (
              <li key={tache.id}>
                <button type="button" className="flex w-full flex-col rounded-md border border-destructive/40 p-3 text-left text-sm" onClick={() => ouvrirFiche(carte, tache.date_tache)}>
                  <span className="font-semibold">{carte.bon.client_nom} — {numeroDeLaCarte(carte)}</span>
                  <span className="text-destructive">↩ {tache.refus_motif ?? "Refusée"}</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
