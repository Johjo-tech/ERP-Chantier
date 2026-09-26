import { Link } from "react-router";
import { Chargement, Erreur } from "@/components/etats/Etats";
import { dateISO, todayISO } from "@/lib/dates";
import { JOUR_MS } from "@/lib/durees";
import { useSocieteActive } from "@/modules/auth-roles/hooks/useSession";
import { usePlanning } from "@/modules/planning/hooks/usePlanning";
import { mesBonsTechnicien, tableauSousTraitant, tableauTechnicien } from "../domain/ancien/terrain";
import { DESTINATIONS } from "../domain/pilotage";
import { EnTeteTableau, Section, Tuile } from "./Tuile";
import { dateDuJourEnLettres, salutation } from "./format";

/** Un aperçu, pas la journée entière : au-delà, le planning fait mieux le travail (`JOURNEE_VISIBLE`). */
const JOURNEE_VISIBLE = 8;
/** « Les six prochains jours » : `Date.now() + 6 × 24 h`, comme l'ancien. */
const JOURS_A_VENIR = 6;

/**
 * Le technicien (`renderDashboardTechnicien`, au HTML et aux calculs près) :
 * sa journée, jamais un montant. Ses bons sont ceux dont la colonne
 * `technicien` désigne son équipe ; sans équipe connue, tous (D-VIS-09).
 */
export function TableauTerrain({ nom }: { nom: string }) {
  const societe = useSocieteActive();
  const planning = usePlanning();
  if (planning.isPending) return <Chargement />;
  if (planning.isError) return <Erreur erreur={planning.error} reessayer={() => void planning.refetch()} />;
  const jour = todayISO();
  const finSemaine = dateISO(new Date(new Date().getTime() + JOURS_A_VENIR * JOUR_MS));
  const { bons, taches, equipes, monEquipeId } = planning.data;
  const t = tableauTechnicien(mesBonsTechnicien(bons, equipes, monEquipeId), taches, jour, finSemaine);
  return (
    <>
      <EnTeteTableau titre={salutation(nom)} sousTitre={`Votre journée sur le terrain — ${societe.nom}`} date={dateDuJourEnLettres()} />
      <div className="grid-stats grid-stats-4">
        <Tuile libelle="Mes interventions aujourd'hui" valeur={t.duJour.length} ton={t.duJour.length ? "alerte" : "neutre"} icone="planning" vers={DESTINATIONS.maJournee} titre="Ouvrir le planning" />
        <Tuile libelle="Les six prochains jours" valeur={t.laSemaine.length} icone="planning" vers={DESTINATIONS.planning} titre="Ouvrir le planning" />
        <Tuile libelle="Travaux à pointer" valeur={t.aPointer.length} ton={t.aPointer.length ? "danger" : "neutre"} icone="bonsCommande" vers={DESTINATIONS.planning} titre="Ouvrir le planning" />
        <Tuile libelle="Pièces que j’ai signalées" valeur={t.pieces.length} icone="bonsCommande" vers={DESTINATIONS.maJournee} titre="Voir les pièces en commande" />
      </div>
      <Section titre="Aujourd’hui">
        <div className="card traiter-card">
          {!t.duJour.length ? (
            <div className="empty">🎉 Rien de planifié aujourd’hui.</div>
          ) : (
            <>
              {t.duJour.slice(0, JOURNEE_VISIBLE).map((b) => (
                <Link key={b.id} to={DESTINATIONS.maJournee} className="traiter-row cliquable">
                  <span className="traiter-ico" style={{ background: "var(--info-soft)" }} aria-hidden="true">
                    🔧
                  </span>
                  <span className="traiter-label">
                    {b.client_nom || "—"}
                    {b.adresse ? ` — ${b.adresse}` : ""}
                  </span>
                  {b.heure_planifiee && <span className="traiter-count">{b.heure_planifiee}</span>}
                  <span className="traiter-chev" aria-hidden="true">
                    ›
                  </span>
                </Link>
              ))}
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

/**
 * Le sous-traitant (`renderDashboardSousTraitant`, au HTML et aux calculs
 * près) : ses factures à émettre, ses devis, ses factures impayées. Il est
 * reconnu par son compte (l'ancien le faisait choisir dans Réglages) ;
 * factures et devis de sous-traitant n'ont pas de colonne (D-FAC-09,
 * D-FAC-14) : ces deux tuiles valent 0, comme dans l'ancien.
 */
export function TableauSousTraitant() {
  const societe = useSocieteActive();
  const planning = usePlanning();
  if (planning.isPending) return <Chargement />;
  if (planning.isError) return <Erreur erreur={planning.error} reessayer={() => void planning.refetch()} />;
  const { bons, taches, sousTraitants, monSousTraitantId } = planning.data;
  const noms = new Map(sousTraitants.map((s) => [s.id, s.nom]));
  const actuel = (monSousTraitantId && noms.get(monSousTraitantId)) || "";
  const t = tableauSousTraitant(bons, taches, noms, actuel);
  return (
    <>
      <EnTeteTableau titre={`Bonjour 👋 ${actuel || "Sous-traitant"}`} sousTitre={`Votre espace sous-traitant — ${societe.nom}`} date={dateDuJourEnLettres()} />
      {!actuel && (
        <div className="card" role="status" style={{ borderColor: "var(--accent)", background: "var(--accent-soft)", marginBottom: "16px" }}>
          👤 Sélectionnez votre nom dans <b>Réglages</b> pour ne voir que vos documents.
        </div>
      )}
      <div className="grid-stats">
        <Tuile libelle={`Factures ${societe.nom} prêtes`} valeur={t.facturesPretes} ton={t.facturesPretes ? "alerte" : "neutre"} icone="bonsCommande" couleurIcone="accent" vers={DESTINATIONS.planning} titre={`Factures ${societe.nom} prêtes`} />
        <Tuile libelle="Mes devis" valeur={t.devis} icone="devis" couleurIcone="info" vers={DESTINATIONS.planning} titre="Mes devis" />
        <Tuile libelle="Mes factures impayées" valeur={t.impayees} ton={t.impayees ? "danger" : "neutre"} icone="factures" couleurIcone="danger" vers={DESTINATIONS.planning} titre="Mes factures impayées" />
      </div>
    </>
  );
}
