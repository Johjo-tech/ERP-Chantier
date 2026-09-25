import { Link } from "react-router";
import { Chargement, Erreur } from "@/components/etats/Etats";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { todayISO } from "@/lib/dates";
import { useSocieteActive } from "@/modules/auth-roles/hooks/useSession";
import { usePlanning } from "@/modules/planning/hooks/usePlanning";
import { DESTINATIONS } from "../domain/pilotage";
import { JOURNEE_VISIBLE, tableauTerrain } from "../domain/terrain";
import { EnTeteTableau, Tuile } from "./Tuile";
import { dateDuJourEnLettres, salutation } from "./format";

/**
 * Le technicien et le sous-traitant : leur journée, jamais un montant. Tout
 * renvoie à « Ma journée » du planning, où l'on pointe et où l'on déclare.
 */
export function TableauTerrain({ nom }: { nom: string }) {
  const societe = useSocieteActive();
  const planning = usePlanning();
  if (planning.isPending) return <Chargement />;
  if (planning.isError) return <Erreur erreur={planning.error} reessayer={() => void planning.refetch()} />;
  const jour = todayISO();
  const { monEquipeId, monSousTraitantId } = planning.data;
  const t = tableauTerrain(planning.cartes, { monEquipeId, monSousTraitantId }, jour);
  const heure = (c: (typeof t.duJour)[number]) => (c.rdv.datePlanifiee === jour ? c.rdv.heurePlanifiee : c.suppl.find((d) => d.date === jour)?.creneau?.heure) ?? null;
  return (
    <div className="flex flex-col gap-6">
      <EnTeteTableau titre={salutation(nom)} sousTitre={`Votre journée sur le terrain — ${societe.nom}`} date={dateDuJourEnLettres()} />
      {!monEquipeId && !monSousTraitantId ? (
        <Alert>Votre compte n'est rattaché à aucune équipe ni entreprise sous-traitante : demandez au conducteur de vous affecter pour voir vos interventions.</Alert>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Tuile libelle="Mes interventions aujourd'hui" valeur={t.duJour.length} ton={t.duJour.length ? "alerte" : "neutre"} vers={DESTINATIONS.maJournee} titre="Ouvrir Ma journée" />
            <Tuile libelle="Les six prochains jours" valeur={t.aVenir.length} vers={DESTINATIONS.planning} titre="Ouvrir le planning" />
            <Tuile libelle="Travaux à pointer" valeur={t.aPointer.length} sous="rendez-vous passé, pas tout déclaré fait" ton={t.aPointer.length ? "danger" : "neutre"} vers={DESTINATIONS.planning} titre="Ouvrir le planning" />
            <Tuile libelle="Pièces que j'ai signalées" valeur={t.pieces.length} sous="en attente de commande" vers={DESTINATIONS.maJournee} titre="Ouvrir Ma journée" />
          </div>
          <section aria-labelledby="titre-aujourdhui" className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <h2 id="titre-aujourdhui" className="text-lg font-semibold">Aujourd'hui</h2>
              <Button asChild size="sm"><Link to={DESTINATIONS.maJournee}>Ouvrir Ma journée</Link></Button>
            </div>
            <Card>
              {!t.duJour.length ? (
                <p className="p-6 text-center text-sm text-muted-foreground">Rien de planifié aujourd'hui.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {t.duJour.slice(0, JOURNEE_VISIBLE).map((c) => (
                    <li key={c.id}>
                      <Link to={DESTINATIONS.maJournee} className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                        <span className="w-12 font-semibold tabular-nums">{heure(c) ?? "—"}</span>
                        <span className="flex-1">{c.bon.client_nom}{c.bon.adresse ? ` — ${c.bon.adresse}` : ""}{c.metier ? ` · ${c.metier}` : ""}</span>
                        <span aria-hidden="true">›</span>
                      </Link>
                    </li>
                  ))}
                  {t.duJour.length > JOURNEE_VISIBLE && (
                    <li><Link to={DESTINATIONS.maJournee} className="block px-4 py-3 text-sm font-medium hover:bg-muted">Voir les {t.duJour.length - JOURNEE_VISIBLE} autres dans Ma journée ›</Link></li>
                  )}
                </ul>
              )}
            </Card>
          </section>
        </>
      )}
    </div>
  );
}
