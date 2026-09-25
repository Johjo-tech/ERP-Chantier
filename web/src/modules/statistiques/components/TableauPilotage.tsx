import { useState } from "react";
import { Link } from "react-router";
import { Chargement, Erreur } from "@/components/etats/Etats";
import { Icone } from "@/components/ui/icones";
import { todayISO } from "@/lib/dates";
import { formatEurosEcran, useModeDiscret } from "@/lib/modeDiscret";
import { Can } from "@/modules/auth-roles/components/Can";
import { useBons } from "@/modules/commandes/hooks/useBons";
import { pourcentage, tauxEncaisse, type Indicateurs } from "../domain/indicateurs";
import { aTraiterPilotage, DESTINATIONS, type ATraiterPilotage } from "../domain/pilotage";
import { useIndicateurs } from "../hooks/useStatistiques";
import { ActiviteRecente, TopClients } from "./ListesPilotage";
import { BlocChiffreAffaires } from "./BlocChiffreAffaires";
import { RechercheGlobale, ResultatsRecherche } from "./RechercheGlobale";
import { EnTeteTableau, LigneATraiter, Section, Tuile } from "./Tuile";
import { dateDuJourEnLettres, salutation } from "./format";

/**
 * Le pilotage — administrateur, secrétaire, lecture (`renderDashboard`, app.js
 * l. 2043), au HTML près le sien : la recherche, la salutation, les actions
 * rapides (téléphone seulement), les quatre tuiles, « À traiter », le chiffre
 * d'affaires, puis l'activité, le classement et le résumé du mois. Les
 * montants viennent tous de la base.
 */
export function TableauPilotage({ nom }: { nom: string }) {
  useModeDiscret();
  const [requete, setRequete] = useState("");
  // Les Entrée comptés depuis la dernière frappe : taper autre chose repart du premier résultat.
  const [entree, setEntree] = useState({ requete: "", appuis: 0 });
  const appuis = entree.requete === requete ? entree.appuis : 0;
  const jour = todayISO();
  const cherche = !!requete.trim();
  return (
    <>
      <RechercheGlobale requete={requete} onChange={setRequete} onEntree={() => setEntree({ requete, appuis: appuis + 1 })} />
      <EnTeteTableau titre={salutation(nom)} sousTitre="Voici un aperçu de votre activité aujourd'hui" date={dateDuJourEnLettres()} />
      <div id="globalSearchResults">{cherche && <ResultatsRecherche requete={requete} appuis={appuis} />}</div>
      <div id="dashboardNormalContent" style={{ display: cherche ? "none" : undefined }}>
        {!cherche && (
          <>
            <ActionsRapides />
            <Synthese jour={jour} />
            <BlocChiffreAffaires jour={jour} />
            <div className="dash-columns3">
              <ActiviteRecente />
              <TopClients />
              <ResumeDuMoisBloc jour={jour} />
            </div>
          </>
        )}
      </div>
    </>
  );
}

/**
 * Trois raccourcis (`quickActionsHTML`), chacun sous le droit qui permet de
 * créer. L'ancienne feuille ne les montre que sur téléphone.
 */
function ActionsRapides() {
  useModeDiscret();
  const actions = [
    { module: "rapports", vers: DESTINATIONS.nouveauRapport, titre: "Nouveau rapport", detail: "Rapport, contrôles, photos", icone: "interventions", pastille: { background: "var(--info-soft)", color: "var(--info)" } },
    { module: "devis", vers: DESTINATIONS.nouveauDevis, titre: "Nouveau devis", detail: "Créer un devis rapidement", icone: "devis", pastille: { background: "var(--success-soft)", color: "var(--success)" } },
    { module: "factures", vers: DESTINATIONS.nouvelleFacture, titre: "Nouvelle facture", detail: "Facturer directement", icone: "factures", pastille: { background: "var(--accent-soft)", color: "var(--accent-2)" } },
  ] as const;
  return (
    <nav aria-label="Actions rapides" className="quick-actions">
      {actions.map((a) => (
        <Can key={a.vers} module={a.module} action="creer">
          <Link to={a.vers} className="quick-action">
            <span className="quick-icon" style={a.pastille}>
              <Icone nom={a.icone} />
            </span>
            <span className="quick-text">
              <b>{a.titre}</b>
              <small>{a.detail}</small>
            </span>
            <span className="quick-chevron" aria-hidden="true">
              ›
            </span>
          </Link>
        </Can>
      ))}
    </nav>
  );
}

function Synthese({ jour }: { jour: string }) {
  useModeDiscret();
  const indicateurs = useIndicateurs(jour);
  const bons = useBons();
  if (indicateurs.isPending || bons.isPending) return <Chargement />;
  if (indicateurs.isError) return <Erreur erreur={indicateurs.error} reessayer={() => void indicateurs.refetch()} />;
  if (bons.isError) return <Erreur erreur={bons.error} reessayer={() => void bons.refetch()} />;
  const traiter = aTraiterPilotage(bons.data, jour);
  return (
    <>
      <Tuiles i={indicateurs.data} t={traiter} />
      <div className="dash-workrow">
        <div className="dash-workcol-main">
          <ATraiter i={indicateurs.data} t={traiter} />
        </div>
      </div>
    </>
  );
}

function Tuiles({ i, t }: { i: Indicateurs; t: ATraiterPilotage }) {
  useModeDiscret();
  return (
    <div className="grid-stats grid-stats-4">
      {/* D-STA-04 : ce qui est entré en caisse, TTC — l'ancien additionnait le HT des factures « payées ». */}
      <Tuile libelle="Encaissé ce mois (TTC)" valeur={formatEurosEcran(i.encaisse_mois)} argent ton="succes" icone="factures" couleurIcone="success" vers={DESTINATIONS.caEncaisse} titre="Voir les règlements" />
      <Tuile libelle="Devis en attente" valeur={i.nb_devis_en_attente} sous={`${formatEurosEcran(i.devis_en_attente_ht)} HT`} icone="devis" couleurIcone="info" vers={DESTINATIONS.devisEnAttente} titre="Voir les devis en attente de réponse" />
      <Tuile libelle="Factures impayées" valeur={i.nb_impayees} sous={`${formatEurosEcran(i.impayes)} restant dû`} ton={i.nb_impayees ? "danger" : "neutre"} icone="factures" couleurIcone="danger" vers={DESTINATIONS.impayees} titre="Voir les factures impayées" />
      <Tuile libelle="À facturer" valeur={t.aFacturer} sous={`${formatEurosEcran(t.aFacturerMontant)} HT`} ton={t.aFacturer ? "alerte" : "neutre"} icone="bonsCommande" couleurIcone="accent" vers={DESTINATIONS.aFacturer} titre="Voir les bons de commande à facturer" />
    </div>
  );
}

function ATraiter({ i, t }: { i: Indicateurs; t: ATraiterPilotage }) {
  useModeDiscret();
  const total = t.enAttenteConducteur + t.aValiderDirecteur + t.aFacturer + t.rappels + i.nb_echues;
  return (
    <Section titre="À traiter" compte={total}>
      <div className="card traiter-card">
        {total === 0 ? (
          <div className="empty">🎉 Rien à traiter — tout est à jour.</div>
        ) : (
          <>
            <LigneATraiter libelle={<>Bons de commande à valider <b>(conducteur)</b></>} nombre={t.enAttenteConducteur} vers={DESTINATIONS.aValiderConducteur} picto="🦺" fond="var(--info-soft)" />
            <LigneATraiter libelle={<>Bons de commande à valider <b>(directeur)</b></>} nombre={t.aValiderDirecteur} vers={DESTINATIONS.aValiderDirecteur} picto="✍️" fond="var(--accent-soft)" />
            <LigneATraiter libelle="Bons de commande à facturer" nombre={t.aFacturer} vers={DESTINATIONS.aFacturer} picto="🧾" fond="var(--success-soft)" />
            <LigneATraiter libelle="Locataires à rappeler" nombre={t.rappels} vers={DESTINATIONS.planning} picto="🔄" fond="#EDE4FF" />
            <LigneATraiter libelle="Factures échues à relancer" nombre={i.nb_echues} vers={DESTINATIONS.echues} picto="⏰" fond="var(--danger-soft)" />
          </>
        )}
      </div>
    </Section>
  );
}

/** Le résumé du mois (`computeMonthSummary`), dans la troisième colonne. */
function ResumeDuMoisBloc({ jour }: { jour: string }) {
  useModeDiscret();
  const indicateurs = useIndicateurs(jour);
  return (
    <div className="dash-col">
      <Section titre="Résumé du mois">
        <div className="card">
          {indicateurs.isPending ? <Chargement /> : indicateurs.isError ? <Erreur erreur={indicateurs.error} reessayer={() => void indicateurs.refetch()} /> : <ResumeDuMois i={indicateurs.data} />}
        </div>
      </Section>
    </div>
  );
}

/**
 * Deux taux et leur jauge. L'ancien résumé répétait en tête « CA encaissé »,
 * que la tuile porte déjà (D-STA-11) ; le détail de chaque taux passe en
 * infobulle.
 */
function ResumeDuMois({ i }: { i: Indicateurs }) {
  useModeDiscret();
  const conversion = pourcentage(i.devis_acceptes_du_mois, i.devis_du_mois);
  const encaissement = tauxEncaisse(i.impayes, i.ttc_emis);
  return (
    <>
      <Jauge libelle="Taux de conversion devis" nom="Taux de conversion des devis" detail={`${i.devis_acceptes_du_mois} accepté(s) sur ${i.devis_du_mois} devis datés du mois`} valeur={conversion} vers={DESTINATIONS.devisEnAttente} couleur="var(--info)" premiere />
      <Jauge libelle="Taux d'encaissement" nom="Taux d'encaissement" detail="Part des factures émises qui n'est plus due" valeur={encaissement} vers={DESTINATIONS.reglements} couleur="var(--accent)" />
    </>
  );
}

function Jauge({ libelle, nom, detail, valeur, vers, couleur, premiere = false }: { libelle: string; nom: string; detail: string; valeur: number; vers: string; couleur: string; premiere?: boolean }) {
  useModeDiscret();
  return (
    <>
      <Link to={vers} className="summary-row cliquable" title={detail} style={premiere ? undefined : { marginTop: "16px" }}>
        <span>{libelle}</span>
        <b>{valeur}%</b>
      </Link>
      <div className="progress-bar" role="meter" aria-label={nom} aria-valuemin={0} aria-valuemax={100} aria-valuenow={valeur}>
        <div className="progress-fill" style={{ width: `${valeur}%`, background: couleur }} />
      </div>
    </>
  );
}
