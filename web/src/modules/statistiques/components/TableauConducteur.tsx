import { Chargement, Erreur } from "@/components/etats/Etats";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { todayISO } from "@/lib/dates";
import { useSocieteActive } from "@/modules/auth-roles/hooks/useSession";
import { SEUILS_DEFAUT } from "@/modules/societes/domain/reglages-societe";
import { useReglagesSociete } from "@/modules/societes/hooks/useSocieteReglages";
import { CONDUCTEUR, REPERES, statsConducteur, totalATraiter, type StatsConducteur } from "../domain/conducteur";
import { DESTINATIONS, pourLeConducteur } from "../domain/pilotage";
import { useTableauConducteur } from "../hooks/useStatistiques";
import { EnTeteTableau, LigneATraiter, Tuile } from "./Tuile";
import { dateDuJourEnLettres, formatDixieme, formatEntier, pluriel, salutation } from "./format";

/**
 * Le conducteur de travaux (`renderDashboardConducteur`) : ses affaires, liées
 * par `conducteurs.profile_id`. AUCUN MONTANT : ce qu'il arbitre, ce sont des
 * validations, des retards et des pièces qui manquent.
 */
export function TableauConducteur({ nom }: { nom: string }) {
  const societe = useSocieteActive();
  const { fiche, bons } = useTableauConducteur();
  const reglages = useReglagesSociete();
  if (fiche.isPending || bons.isPending) return <Chargement />;
  if (fiche.isError) return <Erreur erreur={fiche.error} reessayer={() => void fiche.refetch()} />;
  if (bons.isError) return <Erreur erreur={bons.error} reessayer={() => void bons.refetch()} />;
  const seuil = reglages.data?.seuils.conducteurSansRdv ?? SEUILS_DEFAUT.conducteurSansRdv;
  const s = statsConducteur(bons.data, todayISO(), seuil);
  const sousTitre = fiche.data ? `Vos chantiers — ${societe.nom} · ${pluriel(bons.data.length, "affaire")}` : `Tous les chantiers — ${societe.nom}`;
  return (
    <div className="flex flex-col gap-6">
      <EnTeteTableau titre={salutation(nom)} sousTitre={sousTitre} date={dateDuJourEnLettres()} />
      {/* Sans fiche, on montre tout et on le DIT : filtrer en silence ferait croire qu'il n'a rien à valider. */}
      {!fiche.data && (
        <Alert>Votre compte n'est rattaché à aucune fiche de conducteur : cet écran montre les affaires de <b>toute la société</b>. Demandez à un administrateur de relier votre compte à votre fiche de conducteur.</Alert>
      )}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Tuile libelle="Hors délai" valeur={s.horsDelai.length} sous="fin de travaux dépassée" ton={s.horsDelai.length ? "danger" : "neutre"} vers={DESTINATIONS.planning} titre="Ouvrir le planning" />
        <Tuile libelle="SAV ouverts" valeur={s.sav.length} sous="réclamations en cours" ton={s.sav.length ? "danger" : "neutre"} vers={pourLeConducteur(DESTINATIONS.sav, fiche.data?.id, "conducteurId")} titre="Voir les bons de commande" />
        <Tuile libelle="En attente de ma validation" valeur={s.aValider.length} ton={s.aValider.length ? "alerte" : "neutre"} vers={pourLeConducteur(DESTINATIONS.aValiderConducteur, fiche.data?.nom, "conducteur")} titre="Ouvrir le planning" />
        <Tuile libelle="Sans rendez-vous" valeur={s.sansRdv.length} sous={`reçus depuis plus de ${s.seuilRdv} j`} vers={DESTINATIONS.planning} titre="Ouvrir le planning" />
      </div>
      <ATraiterConducteur s={s} />
      <Mesures s={s} avecFiche={!!fiche.data} />
    </div>
  );
}

function ATraiterConducteur({ s }: { s: StatsConducteur }) {
  const total = totalATraiter(s);
  const problemes = s.sav.map((b) => b.probleme_description).filter(Boolean).slice(0, 3).join(" · ");
  const contact = s.injoignables.length ? `${pluriel(s.injoignables.length, "injoignable")} après ${CONDUCTEUR.tentativesInjoignable} tentatives` : "Rappel prévu aujourd'hui ou dépassé";
  return (
    <section aria-labelledby="titre-traiter-conducteur" className="flex flex-col gap-2">
      <h2 id="titre-traiter-conducteur" className="text-lg font-semibold">À traiter {total > 0 && <span className="ml-1 rounded-full bg-muted px-2 text-sm">{total}</span>}</h2>
      <Card>
        {total === 0 && !s.chezDirecteur.length ? (
          <p className="p-6 text-center text-sm text-muted-foreground">Rien à traiter — tout est à jour.</p>
        ) : (
          <ul className="divide-y divide-border">
            <LigneATraiter libelle="SAV ouverts" precision={problemes || "Réclamations en cours"} nombre={s.sav.length} vers={DESTINATIONS.sav} ton="danger" />
            <LigneATraiter libelle="Travaux hors délai" precision="Fin de travaux dépassée, intervention non terminée" nombre={s.horsDelai.length} vers={DESTINATIONS.planning} ton="danger" />
            <LigneATraiter libelle="Bons à valider" precision="Le chiffrage attend mon accord" nombre={s.aValider.length} vers={DESTINATIONS.aValiderConducteur} />
            <LigneATraiter libelle="Sans rendez-vous" precision={`Reçus depuis plus de ${s.seuilRdv} jours, jamais planifiés`} nombre={s.sansRdv.length} vers={DESTINATIONS.planning} />
            <LigneATraiter libelle="Locataires à contacter" precision={contact} nombre={s.aContacter.length} vers={DESTINATIONS.planning} ton="alerte" />
            <LigneATraiter libelle="Pièces à commander" precision="Le chantier attend tant qu'elles manquent" nombre={s.pieces.length} vers={DESTINATIONS.pieces} />
            <LigneATraiter libelle="En attente du directeur" precision="Validés de mon côté — la balle n'est plus chez moi" nombre={s.chezDirecteur.length} vers={DESTINATIONS.aValiderDirecteur} />
          </ul>
        )}
      </Card>
    </section>
  );
}

/** Une mesure de la période : un chiffre, son unité, une jauge — et un repère dit en toutes lettres. */
function Mesure({ libelle, precision, valeur, unite, part, bon }: { libelle: string; precision: string; valeur: string | null; unite: string; part: number; bon: boolean | null }) {
  const borne = Math.max(0, Math.min(100, part));
  return (
    <Card className="flex flex-col gap-1 p-4">
      <span className="text-sm">{libelle}</span>
      <span className="text-xs text-muted-foreground">{precision}</span>
      <span className="text-2xl font-semibold tabular-nums">{valeur ?? "—"}{valeur && <span className="text-sm font-normal text-muted-foreground"> {unite}</span>}</span>
      <span aria-hidden="true" className="h-1.5 overflow-hidden rounded-full bg-muted">
        <span className={`block h-full rounded-full ${bon === null ? "bg-muted-foreground" : bon ? "bg-success" : "bg-warning"}`} style={{ width: `${valeur === null ? 0 : borne}%` }} />
      </span>
      {bon !== null && valeur !== null && <span className="text-xs">{bon ? "Dans l'objectif" : "À surveiller"}</span>}
    </Card>
  );
}

/** Les jauges de l'ancien écran : une échelle par mesure, pour qu'un bon chiffre ne remplisse pas la barre à tort. */
const ECHELLE = { tauxSav: 5, priseEnCharge: 10, execution: 5 } as const;

function Mesures({ s, avecFiche }: { s: StatsConducteur; avecFiche: boolean }) {
  return (
    <section aria-labelledby="titre-mesures" className="flex flex-col gap-2">
      <h2 id="titre-mesures" className="text-lg font-semibold">Mes chiffres — {CONDUCTEUR.periodeJours} derniers jours</h2>
      {s.terminees === 0 ? (
        <Card><p className="p-6 text-center text-sm text-muted-foreground">Aucune affaire terminée sur la période : rien à mesurer pour l'instant.</p></Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Mesure libelle="Taux de SAV" precision="SAV nés / affaires terminées" valeur={s.tauxSAV === null ? null : formatDixieme(s.tauxSAV)} unite="%" part={(s.tauxSAV ?? 0) * ECHELLE.tauxSav} bon={s.tauxSAV === null ? null : s.tauxSAV < REPERES.tauxSavBon} />
          <Mesure libelle="Délai tenu" precision="terminé avant la fin de travaux" valeur={s.delaiTenu === null ? null : formatEntier(s.delaiTenu)} unite="%" part={s.delaiTenu ?? 0} bon={s.delaiTenu === null ? null : s.delaiTenu >= REPERES.delaiTenuBon} />
          <Mesure libelle="Prise en charge" precision="réception → rendez-vous posé" valeur={s.priseEnCharge === null ? null : formatDixieme(s.priseEnCharge)} unite="j" part={(s.priseEnCharge ?? 0) * ECHELLE.priseEnCharge} bon={s.priseEnCharge === null ? null : s.priseEnCharge <= s.seuilRdv} />
          <Mesure libelle="Exécution" precision="rendez-vous → travaux terminés" valeur={s.execution === null ? null : formatDixieme(s.execution)} unite="j" part={(s.execution ?? 0) * ECHELLE.execution} bon={null} />
        </div>
      )}
      <p className="text-xs text-muted-foreground">Calculé sur {pluriel(s.terminees, "affaire terminée", "affaires terminées")} {avecFiche ? "dont vous êtes le conducteur" : "de la société"}.</p>
    </section>
  );
}
