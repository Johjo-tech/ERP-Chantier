import { useState } from "react";
import { Link } from "react-router";
import { Chargement, Erreur } from "@/components/etats/Etats";
import { Icone } from "@/components/ui/icones";
import { todayISO } from "@/lib/dates";
import { useModeDiscret } from "@/lib/modeDiscret";
import { Can } from "@/modules/auth-roles/components/Can";
import { aTraiterPilotage, resumeDuMois, totalATraiterPilotage, tuilesPilotage, type ATraiterPilotage, type ResumeMois, type TuilesPilotage } from "../domain/ancien/pilotage";
import { moisGlissants, MOIS_RESUME } from "../domain/periodes";
import { DESTINATIONS } from "../domain/pilotage";
import { useDonneesPilotage, type DonneesPilotage } from "../hooks/useStatistiques";
import { ActiviteRecente, TopClients } from "./ListesPilotage";
import { BlocChiffreAffaires } from "./BlocChiffreAffaires";
import { RechercheGlobale, ResultatsRecherche } from "./RechercheGlobale";
import { EnTeteTableau, LigneATraiter, Section, Tuile } from "./Tuile";
import { dateDuJourEnLettres, formatEurosEcranAncien, salutation } from "./format";

/**
 * Le pilotage — administrateur, secrétaire, lecture (`renderDashboard`, app.js
 * l. 2051), au HTML près le sien : la recherche, la salutation, les actions
 * rapides (téléphone seulement), les quatre tuiles, « À traiter », le chiffre
 * d'affaires, puis l'activité, le classement et le résumé du mois. Chaque
 * chiffre est calculé comme l'ancien, défauts compris (D-STA-A-01).
 */
export function TableauPilotage({ nom }: { nom: string }) {
  useModeDiscret();
  const [requete, setRequete] = useState("");
  // Les Entrée comptés depuis la dernière frappe : taper autre chose repart du premier résultat.
  const [entree, setEntree] = useState({ requete: "", appuis: 0 });
  const appuis = entree.requete === requete ? entree.appuis : 0;
  const cherche = !!requete.trim();
  return (
    <>
      <RechercheGlobale requete={requete} onChange={setRequete} onEntree={() => setEntree({ requete, appuis: appuis + 1 })} />
      <EnTeteTableau titre={salutation(nom)} sousTitre="Voici un aperçu de votre activité aujourd'hui" date={dateDuJourEnLettres()} />
      <div id="globalSearchResults">{cherche && <ResultatsRecherche requete={requete} appuis={appuis} />}</div>
      <div id="dashboardNormalContent" style={{ display: cherche ? "none" : undefined }}>
        {!cherche && <Contenu />}
      </div>
    </>
  );
}

function Contenu() {
  useModeDiscret();
  const { donnees, erreur, reessayer } = useDonneesPilotage();
  if (erreur) return <Erreur erreur={erreur} reessayer={reessayer} />;
  if (!donnees) return <Chargement />;
  return <Pilotage d={donnees} jour={todayISO()} />;
}

function Pilotage({ d, jour }: { d: DonneesPilotage; jour: string }) {
  useModeDiscret();
  const resume = resumeDuMois(d.factures, d.devis, d.reglements, jour, moisSurSixMois(jour));
  const traiter = aTraiterPilotage(d.bons, d.factures, jour);
  return (
    <>
      <ActionsRapides />
      <Tuiles t={tuilesPilotage(d.factures, d.devis)} r={resume} a={traiter} />
      <div className="dash-workrow">
        <div className="dash-workcol-main">
          <ATraiter t={traiter} />
        </div>
      </div>
      <BlocChiffreAffaires factures={d.factures} jour={jour} />
      <div className="dash-columns3">
        <ActiviteRecente d={d} />
        <TopClients factures={d.factures} />
        <ResumeDuMois r={resume} />
      </div>
    </>
  );
}

const moisSurSixMois = (jour: string) => moisGlissants(MOIS_RESUME, jour).map((m) => ({ year: m.annee, month: m.mois - 1 }));

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

/** Les quatre tuiles de l'ancien, libellés compris (« CA encaissé ce mois (HT) »). */
function Tuiles({ t, r, a }: { t: TuilesPilotage; r: ResumeMois; a: ATraiterPilotage }) {
  useModeDiscret();
  return (
    <div className="grid-stats grid-stats-4">
      <Tuile libelle="CA encaissé ce mois (HT)" valeur={formatEurosEcranAncien(r.caMois)} argent ton="succes" icone="factures" couleurIcone="success" vers={DESTINATIONS.caEncaisse} titre="Voir les factures réglées ce mois" />
      <Tuile libelle="Devis en attente" valeur={t.devisEnAttente} sous={`${formatEurosEcranAncien(t.devisEnAttenteMontant)} HT`} icone="devis" couleurIcone="info" vers={DESTINATIONS.devisEnAttente} titre="Voir les devis en attente de réponse" />
      <Tuile libelle="Factures impayées" valeur={t.impayees} sous={`${formatEurosEcranAncien(r.impayeesMontant)} restant dû`} ton={t.impayees ? "danger" : "neutre"} icone="factures" couleurIcone="danger" vers={DESTINATIONS.impayees} titre="Voir les factures impayées" />
      <Tuile libelle="À facturer" valeur={a.aFacturer} sous={`${formatEurosEcranAncien(a.aFacturerMontant)} HT`} ton={a.aFacturer ? "alerte" : "neutre"} icone="bonsCommande" couleurIcone="accent" vers={DESTINATIONS.aFacturer} titre="Voir les bons de commande à facturer" />
    </div>
  );
}

function ATraiter({ t }: { t: ATraiterPilotage }) {
  useModeDiscret();
  const total = totalATraiterPilotage(t);
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
            <LigneATraiter libelle="Locataires à rappeler" nombre={t.rappelsAujourdhui} vers={DESTINATIONS.planning} picto="🔄" fond="#EDE4FF" />
            <LigneATraiter libelle="Factures échues à relancer" nombre={t.facturesEchues} vers={DESTINATIONS.echues} picto="⏰" fond="var(--danger-soft)" />
          </>
        )}
      </div>
    </Section>
  );
}

/** Le résumé du mois (`computeMonthSummary`), dans la troisième colonne : ses trois lignes et leurs jauges. */
function ResumeDuMois({ r }: { r: ResumeMois }) {
  useModeDiscret();
  return (
    <div className="dash-col">
      <Section titre="Résumé du mois">
        <div className="card">
          <Jauge libelle="Chiffre d'affaires encaissé (HT)" valeur={formatEurosEcranAncien(r.caMois)} largeur={r.caMoisPct} vers={DESTINATIONS.caEncaisse} titre="Voir les factures réglées ce mois" couleur="var(--success)" premiere />
          <Jauge libelle="Taux de conversion devis" valeur={`${r.tauxConversion}%`} largeur={r.tauxConversion} vers={DESTINATIONS.devisEnAttente} titre="Voir les devis" couleur="var(--info)" />
          <Jauge libelle="Taux d'encaissement" valeur={`${r.tauxEncaisse}%`} largeur={r.tauxEncaisse} vers={DESTINATIONS.reglements} titre="Voir les règlements" couleur="var(--accent)" />
        </div>
      </Section>
    </div>
  );
}

function Jauge({ libelle, valeur, largeur, vers, titre, couleur, premiere = false }: { libelle: string; valeur: string; largeur: number; vers: string; titre: string; couleur: string; premiere?: boolean }) {
  useModeDiscret();
  return (
    <>
      <Link to={vers} className="summary-row cliquable" title={titre} style={premiere ? undefined : { marginTop: "16px" }}>
        <span>{libelle}</span>
        <b>{valeur}</b>
      </Link>
      <div className="progress-bar" role="meter" aria-label={libelle} aria-valuemin={0} aria-valuemax={100} aria-valuenow={largeur}>
        <div className="progress-fill" style={{ width: `${largeur}%`, background: couleur }} />
      </div>
    </>
  );
}
