import { Chargement, Erreur } from "@/components/etats/Etats";
import { todayISO } from "@/lib/dates";
import { useSocieteActive } from "@/modules/auth-roles/hooks/useSession";
import { SEUILS_DEFAUT } from "@/modules/societes/domain/reglages-societe";
import { useReglagesSociete } from "@/modules/societes/hooks/useSocieteReglages";
import { CONDUCTEUR, REPERES, statsConducteur, totalATraiter, type StatsConducteur } from "../domain/conducteur";
import { DESTINATIONS, pourLeConducteur } from "../domain/pilotage";
import { useTableauConducteur } from "../hooks/useStatistiques";
import { EnTeteTableau, LigneATraiter, Section, Tuile } from "./Tuile";
import { dateDuJourEnLettres, formatDixieme, formatEntier, pluriel, salutation } from "./format";

/**
 * Le conducteur de travaux (`renderDashboardConducteur`, au HTML près) : ses
 * affaires, liées par `conducteurs.profile_id`. AUCUN MONTANT : ce qu'il
 * arbitre, ce sont des validations, des retards et des pièces qui manquent.
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
    <>
      <EnTeteTableau titre={salutation(nom)} sousTitre={sousTitre} date={dateDuJourEnLettres()} />
      {/* Sans fiche, on montre tout et on le DIT : filtrer en silence ferait croire qu'il n'a rien à valider.
          La marche à suivre n'est plus celle de l'ancien écran (D-STA-10) : c'est l'administrateur qui relie le compte. */}
      {!fiche.data && (
        <div className="card" role="status" style={{ borderColor: "var(--accent)", background: "var(--accent-soft)", marginBottom: "16px" }}>
          👤 Votre compte n'est rattaché à aucune fiche de conducteur : cet écran montre les affaires de <b>toute la société</b>. Demandez à un administrateur de relier votre compte à votre fiche de conducteur.
        </div>
      )}
      <div className="grid-stats grid-stats-4">
        <Tuile libelle="Hors délai" valeur={s.horsDelai.length} sous="fin de travaux dépassée" ton={s.horsDelai.length ? "danger" : "neutre"} icone="planning" vers={DESTINATIONS.planning} titre="Ouvrir le planning" />
        <Tuile libelle="SAV ouverts" valeur={s.sav.length} sous="réclamations en cours" ton={s.sav.length ? "danger" : "neutre"} icone="bonsCommande" vers={pourLeConducteur(DESTINATIONS.sav, fiche.data?.id, "conducteurId")} titre="Voir les SAV" />
        <Tuile libelle="En attente de ma validation" valeur={s.aValider.length} ton={s.aValider.length ? "alerte" : "neutre"} icone="bonsCommande" vers={pourLeConducteur(DESTINATIONS.aValiderConducteur, fiche.data?.nom, "conducteur")} titre="Voir les bons à valider" />
        <Tuile libelle="Sans rendez-vous" valeur={s.sansRdv.length} sous={`reçus depuis plus de ${s.seuilRdv} j`} icone="planning" vers={DESTINATIONS.planning} titre="Ouvrir le planning" />
      </div>
      <ATraiterConducteur s={s} />
      <Mesures s={s} avecFiche={!!fiche.data} />
    </>
  );
}

/** Trois problèmes suffisent à dire la nature des SAV ; la liste entière est au tableau. */
const PROBLEMES_CITES = 3;

function ATraiterConducteur({ s }: { s: StatsConducteur }) {
  const total = totalATraiter(s);
  const problemes = s.sav.map((b) => b.probleme_description).filter(Boolean).slice(0, PROBLEMES_CITES).join(" · ");
  const contact = s.injoignables.length ? `${pluriel(s.injoignables.length, "injoignable")} après ${CONDUCTEUR.tentativesInjoignable} tentatives` : "Rappel prévu aujourd'hui ou dépassé";
  return (
    <Section titre="À traiter" compte={total}>
      <div className="card traiter-card">
        {total === 0 && !s.chezDirecteur.length ? (
          <div className="empty">🎉 Rien à traiter — tout est à jour.</div>
        ) : (
          <>
            <LigneATraiter libelle="SAV ouverts" precision={problemes || "Réclamations en cours"} nombre={s.sav.length} vers={DESTINATIONS.sav} picto="⚠" fond="var(--danger-soft)" teinte="var(--danger)" />
            <LigneATraiter libelle="Travaux hors délai" precision="Fin de travaux dépassée, intervention non terminée" nombre={s.horsDelai.length} vers={DESTINATIONS.planning} picto="⏰" fond="var(--danger-soft)" teinte="var(--danger)" />
            <LigneATraiter libelle="Bons à valider" precision="Le chiffrage attend mon accord" nombre={s.aValider.length} vers={DESTINATIONS.aValiderConducteur} picto="🦺" fond="var(--info-soft)" />
            <LigneATraiter libelle="Sans rendez-vous" precision={`Reçus depuis plus de ${s.seuilRdv} jours, jamais planifiés`} nombre={s.sansRdv.length} vers={DESTINATIONS.planning} picto="📅" fond="var(--accent-soft)" />
            <LigneATraiter libelle="Locataires à contacter" precision={contact} nombre={s.aContacter.length} vers={DESTINATIONS.planning} picto="🔄" fond="#EDE4FF" teinte="#6B46C1" />
            <LigneATraiter libelle="Pièces à commander" precision="Le chantier attend tant qu'elles manquent" nombre={s.pieces.length} vers={DESTINATIONS.pieces} picto="📦" fond="var(--accent-soft)" />
            <LigneATraiter libelle="En attente du directeur" precision="Validés de mon côté — la balle n'est plus chez moi" nombre={s.chezDirecteur.length} vers={DESTINATIONS.aValiderDirecteur} picto="✍️" fond="var(--surface-2)" teinte="var(--text-dim)" />
          </>
        )}
      </div>
    </Section>
  );
}

/**
 * Une mesure de la période (`mesureConducteur`) : un chiffre, son unité, une
 * jauge verte si l'objectif est tenu, orange sinon. La couleur ne portant pas
 * seule le sens, le verdict est dit aux lecteurs d'écran.
 */
function Mesure({ libelle, precision, valeur, unite, part, bon }: { libelle: string; precision: string; valeur: string | null; unite: string; part: number; bon: boolean | null }) {
  const borne = Math.max(0, Math.min(100, part));
  const teinte = valeur === null ? "var(--text-dim)" : bon ? "var(--success)" : "var(--accent-2)";
  return (
    <div className="card mesure-conducteur">
      <div className="card-sub" style={{ marginBottom: "6px" }}>
        {libelle}
        <br />
        <span style={{ fontSize: "11px" }}>{precision}</span>
      </div>
      <div className="stat-num" style={{ fontSize: "22px" }}>
        {valeur ?? "—"}
        <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-dim)" }}>{valeur === null ? "" : ` ${unite}`}</span>
        {bon !== null && valeur !== null && <span className="sr-only">{bon ? " — dans l'objectif" : " — à surveiller"}</span>}
      </div>
      <div className="mesure-jauge">
        <i style={{ width: `${valeur === null ? 0 : borne}%`, background: teinte }} />
      </div>
    </div>
  );
}

/** Les jauges de l'ancien écran : une échelle par mesure, pour qu'un bon chiffre ne remplisse pas la barre à tort. */
const ECHELLE = { tauxSav: 5, priseEnCharge: 10, execution: 5 } as const;

function Mesures({ s, avecFiche }: { s: StatsConducteur; avecFiche: boolean }) {
  return (
    <>
      <Section titre={`Mes chiffres — ${CONDUCTEUR.periodeJours} derniers jours`}>
        {s.terminees === 0 ? (
          <div className="card">
            <div className="empty">Aucune affaire terminée sur la période : rien à mesurer pour l'instant.</div>
          </div>
        ) : (
          <div className="grid-stats grid-stats-4">
            <Mesure libelle="Taux de SAV" precision="SAV nés / affaires terminées" valeur={s.tauxSAV === null ? null : formatDixieme(s.tauxSAV)} unite="%" part={(s.tauxSAV ?? 0) * ECHELLE.tauxSav} bon={s.tauxSAV === null ? null : s.tauxSAV < REPERES.tauxSavBon} />
            <Mesure libelle="Délai tenu" precision="terminé avant la fin de travaux" valeur={s.delaiTenu === null ? null : formatEntier(s.delaiTenu)} unite="%" part={s.delaiTenu ?? 0} bon={s.delaiTenu === null ? null : s.delaiTenu >= REPERES.delaiTenuBon} />
            <Mesure libelle="Prise en charge" precision="réception → rendez-vous posé" valeur={s.priseEnCharge === null ? null : formatDixieme(s.priseEnCharge)} unite="j" part={(s.priseEnCharge ?? 0) * ECHELLE.priseEnCharge} bon={s.priseEnCharge === null ? null : s.priseEnCharge <= s.seuilRdv} />
            <Mesure libelle="Exécution" precision="rendez-vous → travaux terminés" valeur={s.execution === null ? null : formatDixieme(s.execution)} unite="j" part={(s.execution ?? 0) * ECHELLE.execution} bon={null} />
          </div>
        )}
      </Section>
      <div className="card-sub" style={{ marginTop: "10px" }}>
        Calculé sur {pluriel(s.terminees, "affaire terminée", "affaires terminées")} {avecFiche ? "dont vous êtes le conducteur" : "de la société"}.
      </div>
    </>
  );
}
