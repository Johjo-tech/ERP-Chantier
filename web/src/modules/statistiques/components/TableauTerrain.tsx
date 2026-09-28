import { Link } from "react-router";
import { Chargement, Erreur } from "@/components/etats/Etats";
import { todayISO } from "@/lib/dates";
import { useSocieteActive } from "@/modules/auth-roles/hooks/useSession";
import type { CartePlanning } from "@/modules/planning/domain/cartes";
import { usePlanning } from "@/modules/planning/hooks/usePlanning";
import { DESTINATIONS } from "../domain/pilotage";
import { JOURNEE_VISIBLE, tableauTerrain, type Affectation } from "../domain/terrain";
import { EnTeteTableau, Section, Tuile } from "./Tuile";
import { dateDuJourEnLettres, salutation } from "./format";

/**
 * Le technicien (`renderDashboardTechnicien`, au HTML près) : sa journée,
 * jamais un montant. Ses interventions sont les CARTES du planning confiées à
 * son équipe — sur le bon ou sur l'une de ses tâches, rendez-vous ou journée
 * supplémentaire —, comme « Ma journée » (DEF-STA-13) ; sans équipe connue,
 * tout ce que la base lui sert (D-VIS-09).
 */
export function TableauTerrain({ nom }: { nom: string }) {
  const societe = useSocieteActive();
  return <Journee titre={() => salutation(nom)} sousTitre={`Votre journée sur le terrain — ${societe.nom}`} />;
}

/**
 * Le sous-traitant : reconnu par son COMPTE (`mon_sous_traitant`, comme le
 * planning), salué au nom de son entreprise, sans le bandeau qui l'envoyait
 * choisir son nom dans Réglages à chaque ouverture (DEF-STA-19). Ses trois
 * tuiles de l'ancien — factures à émettre, devis, impayés — comptaient des
 * pièces que rien ne permet d'établir (D-FAC-09, D-FAC-14) : il reçoit à la
 * place le tableau de sa journée, ses tâches par son entreprise (DEF-STA-14,
 * D-STA-09).
 */
export function TableauSousTraitant({ nom }: { nom: string }) {
  const societe = useSocieteActive();
  return <Journee titre={(nomEntreprise) => salutation(nomEntreprise ?? nom)} sousTitre={`Votre espace sous-traitant — ${societe.nom}`} />;
}

/** L'heure de la carte ce jour-là : celle du rendez-vous, ou celle de la journée supplémentaire. */
function heureDuJour(c: CartePlanning, jour: string): string | null {
  return (c.rdv.datePlanifiee === jour ? c.rdv.heurePlanifiee : c.suppl.find((d) => d.date === jour)?.creneau?.heure) ?? null;
}

function Journee({ titre, sousTitre }: { titre: (nomEntreprise: string | null) => string; sousTitre: string }) {
  const planning = usePlanning();
  if (planning.isPending) return <Chargement />;
  if (planning.isError) return <Erreur erreur={planning.error} reessayer={() => void planning.refetch()} />;
  const jour = todayISO();
  const { monEquipeId, monSousTraitantId, sousTraitants } = planning.data;
  const affectation: Affectation = { monEquipeId, monSousTraitantId };
  const t = tableauTerrain(planning.cartes, affectation, jour);
  const nomEntreprise = sousTraitants.find((s) => s.id === monSousTraitantId)?.nom ?? null;
  return (
    <>
      <EnTeteTableau titre={titre(nomEntreprise)} sousTitre={sousTitre} date={dateDuJourEnLettres()} />
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
                const h = heureDuJour(c, jour);
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
