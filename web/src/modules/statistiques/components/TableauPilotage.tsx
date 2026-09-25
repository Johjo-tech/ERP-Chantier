import { useState } from "react";
import { Link } from "react-router";
import { Chargement, Erreur } from "@/components/etats/Etats";
import { Card } from "@/components/ui/card";
import { todayISO } from "@/lib/dates";
import { formatEurosEcran, useModeDiscret } from "@/lib/modeDiscret";
import { Can } from "@/modules/auth-roles/components/Can";
import { useBons } from "@/modules/commandes/hooks/useBons";
import { pourcentage, tauxEncaisse, type Indicateurs } from "../domain/indicateurs";
import { aTraiterPilotage, DESTINATIONS, type ATraiterPilotage } from "../domain/pilotage";
import { useIndicateurs } from "../hooks/useStatistiques";
import { ActiviteRecente, TopClients } from "./ListesPilotage";
import { BlocChiffreAffaires } from "./BlocChiffreAffaires";
import { RechercheGlobale } from "./RechercheGlobale";
import { EnTeteTableau, LigneATraiter, Tuile } from "./Tuile";
import { dateDuJourEnLettres, salutation } from "./format";

/**
 * Le pilotage — administrateur, secrétaire, lecture (`renderDashboard`, app.js
 * l. 2043) : ce qu'ils ont à surveiller, chiffre d'affaires, impayés et ce qui
 * attend quelqu'un. Les montants viennent tous de la base.
 */
export function TableauPilotage({ nom }: { nom: string }) {
  useModeDiscret();
  const [requete, setRequete] = useState("");
  const jour = todayISO();
  return (
    <div className="flex flex-col gap-6">
      <RechercheGlobale requete={requete} onChange={setRequete} />
      {!requete.trim() && (
        <>
          <EnTeteTableau titre={salutation(nom)} sousTitre="Voici un aperçu de votre activité aujourd'hui" date={dateDuJourEnLettres()} />
          <ActionsRapides />
          <Synthese jour={jour} />
          <BlocChiffreAffaires jour={jour} />
          <div className="grid gap-6 lg:grid-cols-2">
            <ActiviteRecente />
            <TopClients />
          </div>
        </>
      )}
    </div>
  );
}

/** Trois raccourcis, chacun sous le droit qui permet de créer (`quickActionsHTML`). */
function ActionsRapides() {
  useModeDiscret();
  const actions = [
    { module: "rapports", vers: DESTINATIONS.nouveauRapport, titre: "Nouveau rapport", detail: "Rapport, contrôles, photos" },
    { module: "devis", vers: DESTINATIONS.nouveauDevis, titre: "Nouveau devis", detail: "Créer un devis rapidement" },
    { module: "factures", vers: DESTINATIONS.nouvelleFacture, titre: "Nouvelle facture", detail: "Facturer directement" },
  ] as const;
  return (
    <nav aria-label="Actions rapides" className="grid gap-3 sm:grid-cols-3">
      {actions.map((a) => (
        <Can key={a.vers} module={a.module} action="creer">
          <Link to={a.vers} className="flex items-center justify-between rounded-md border bg-card p-3 text-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <span><b className="block">{a.titre}</b><span className="text-muted-foreground">{a.detail}</span></span>
            <span aria-hidden="true">›</span>
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
      <div className="grid gap-6 lg:grid-cols-2">
        <ATraiter i={indicateurs.data} t={traiter} />
        <ResumeDuMois i={indicateurs.data} />
      </div>
    </>
  );
}

function Tuiles({ i, t }: { i: Indicateurs; t: ATraiterPilotage }) {
  useModeDiscret();
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Tuile libelle="Encaissé ce mois (TTC)" valeur={formatEurosEcran(i.encaisse_mois)} sous="règlements reçus depuis le 1er" ton="succes" vers={DESTINATIONS.caEncaisse} titre="Voir les règlements" />
      <Tuile libelle="Devis en attente" valeur={i.nb_devis_en_attente} sous={`${formatEurosEcran(i.devis_en_attente_ht)} HT`} vers={DESTINATIONS.devisEnAttente} titre="Voir les devis en attente de réponse" />
      <Tuile libelle="Factures impayées" valeur={i.nb_impayees} sous={`${formatEurosEcran(i.impayes)} restant dû`} ton={i.nb_impayees ? "danger" : "neutre"} vers={DESTINATIONS.impayees} titre="Voir les factures impayées" />
      <Tuile libelle="À facturer" valeur={t.aFacturer} sous={`${formatEurosEcran(t.aFacturerMontant)} HT`} ton={t.aFacturer ? "alerte" : "neutre"} vers={DESTINATIONS.aFacturer} titre="Voir les bons de commande à facturer" />
    </div>
  );
}

function ATraiter({ i, t }: { i: Indicateurs; t: ATraiterPilotage }) {
  useModeDiscret();
  const total = t.enAttenteConducteur + t.aValiderDirecteur + t.aFacturer + t.rappels + i.nb_echues;
  return (
    <section aria-labelledby="titre-a-traiter" className="flex flex-col gap-2">
      <h2 id="titre-a-traiter" className="text-lg font-semibold">À traiter {total > 0 && <span className="ml-1 rounded-full bg-muted px-2 text-sm">{total}</span>}</h2>
      <Card>
        {total === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">Rien à traiter — tout est à jour.</p>
        ) : (
          <ul className="divide-y divide-border">
            <LigneATraiter libelle="Bons de commande à valider (conducteur)" nombre={t.enAttenteConducteur} vers={DESTINATIONS.aValiderConducteur} />
            <LigneATraiter libelle="Bons de commande à valider (directeur)" nombre={t.aValiderDirecteur} vers={DESTINATIONS.aValiderDirecteur} />
            <LigneATraiter libelle="Bons de commande à facturer" nombre={t.aFacturer} vers={DESTINATIONS.aFacturer} />
            <LigneATraiter libelle="Locataires à rappeler" precision="Rappel prévu aujourd'hui ou dépassé" nombre={t.rappels} vers={DESTINATIONS.planning} />
            <LigneATraiter libelle="Factures échues à relancer" nombre={i.nb_echues} vers={DESTINATIONS.echues} ton="danger" />
          </ul>
        )}
      </Card>
    </section>
  );
}

/** Le résumé du mois : trois taux et leur jauge (`computeMonthSummary`). */
function ResumeDuMois({ i }: { i: Indicateurs }) {
  useModeDiscret();
  const conversion = pourcentage(i.devis_acceptes_du_mois, i.devis_du_mois);
  const encaissement = tauxEncaisse(i.impayes, i.ttc_emis);
  return (
    <section aria-labelledby="titre-resume" className="flex flex-col gap-2">
      <h2 id="titre-resume" className="text-lg font-semibold">Résumé du mois</h2>
      <Card className="flex flex-col gap-4 p-4">
        <Jauge libelle="Taux de conversion des devis" detail={`${i.devis_acceptes_du_mois} accepté(s) sur ${i.devis_du_mois} devis datés du mois`} valeur={conversion} vers={DESTINATIONS.devisEnAttente} />
        <Jauge libelle="Taux d'encaissement" detail="Part des factures émises qui n'est plus due" valeur={encaissement} vers={DESTINATIONS.reglements} />
      </Card>
    </section>
  );
}

function Jauge({ libelle, detail, valeur, vers }: { libelle: string; detail: string; valeur: number; vers: string }) {
  useModeDiscret();
  return (
    <Link to={vers} className="flex flex-col gap-1 rounded-md p-1 text-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <span className="flex justify-between"><span>{libelle}</span><b className="tabular-nums">{valeur} %</b></span>
      <span role="meter" aria-label={libelle} aria-valuemin={0} aria-valuemax={100} aria-valuenow={valeur} className="h-2 overflow-hidden rounded-full bg-muted">
        <span className="block h-full rounded-full" style={{ width: `${valeur}%`, background: "var(--color-accent-societe, var(--color-primary))" }} />
      </span>
      <span className="text-xs text-muted-foreground">{detail}</span>
    </Link>
  );
}
