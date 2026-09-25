import { Link } from "react-router";
import { Chargement, Erreur } from "@/components/etats/Etats";
import { todayISO } from "@/lib/dates";
import { useSocieteActive } from "@/modules/auth-roles/hooks/useSession";
import { usePlanning } from "@/modules/planning/hooks/usePlanning";
import { DESTINATIONS } from "../domain/pilotage";
import { JOURNEE_VISIBLE, tableauTerrain } from "../domain/terrain";
import { EnTeteTableau, Section, Tuile } from "./Tuile";
import { dateDuJourEnLettres, salutation } from "./format";

/**
 * Le technicien et le sous-traitant (`renderDashboardTechnicien`, au HTML
 * près) : leur journée, jamais un montant. Tout renvoie à « Ma journée » du
 * planning, où l'on pointe et où l'on déclare.
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
    <>
      <EnTeteTableau titre={salutation(nom)} sousTitre={`Votre journée sur le terrain — ${societe.nom}`} date={dateDuJourEnLettres()} />
      {/* Sans équipe connue, tout ce que la base sert, comme l'ancien (D-VIS-09) : pas d'encadré. */}
      <div className="grid-stats grid-stats-4">
        <Tuile libelle="Mes interventions aujourd'hui" valeur={t.duJour.length} ton={t.duJour.length ? "alerte" : "neutre"} icone="planning" vers={DESTINATIONS.maJournee} titre="Ouvrir le planning" />
        <Tuile libelle="Les six prochains jours" valeur={t.aVenir.length} icone="planning" vers={DESTINATIONS.planning} titre="Ouvrir le planning" />
        <Tuile libelle="Travaux à pointer" valeur={t.aPointer.length} ton={t.aPointer.length ? "danger" : "neutre"} icone="bonsCommande" vers={DESTINATIONS.planning} titre="Ouvrir le planning" />
        <Tuile libelle="Pièces que j’ai signalées" valeur={t.pieces.length} icone="bonsCommande" vers={DESTINATIONS.maJournee} titre="Voir les pièces en commande" />
      </div>
      <Section titre="Aujourd’hui">
        <div className="card traiter-card">
          {!t.duJour.length ? (
            <div className="empty">🎉 Rien de planifié aujourd’hui.</div>
          ) : (
            <>
              {t.duJour.slice(0, JOURNEE_VISIBLE).map((c) => {
                const h = heure(c);
                return (
                  <Link key={c.id} to={DESTINATIONS.maJournee} className="traiter-row cliquable">
                    <span className="traiter-ico" style={{ background: "var(--info-soft)" }} aria-hidden="true">
                      🔧
                    </span>
                    <span className="traiter-label">
                      {c.bon.client_nom || "—"}
                      {c.bon.adresse ? ` — ${c.bon.adresse}` : ""}
                    </span>
                    {h && <span className="traiter-count">{h}</span>}
                    <span className="traiter-chev" aria-hidden="true">
                      ›
                    </span>
                  </Link>
                );
              })}
              {t.duJour.length > JOURNEE_VISIBLE && (
                <Link to={DESTINATIONS.maJournee} className="traiter-row cliquable">
                  <span className="traiter-ico" style={{ background: "var(--accent-soft)" }} aria-hidden="true">
                    →
                  </span>
                  <span className="traiter-label">Voir les {t.duJour.length - JOURNEE_VISIBLE} autres dans le planning</span>
                  <span className="traiter-chev" aria-hidden="true">
                    ›
                  </span>
                </Link>
              )}
            </>
          )}
        </div>
      </Section>
    </>
  );
}
