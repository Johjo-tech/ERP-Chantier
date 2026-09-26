import { useCallback, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { Chargement, Erreur } from "@/components/etats/Etats";
import { messageErreur } from "@/lib/erreurs";
import { afficherToast } from "@/lib/toast";
import { useFormulaire } from "@/lib/useFormulaire";
import { useMembres } from "@/modules/comptes/hooks/useComptes";
import { useDefilerVersFormulaire } from "@/modules/materiel/components/communs";
import { libelleEquipe, planConducteur, roleAProposer } from "../domain/intervenants";
import { nomComplet, schemaSaisieSalarie, valeursFormulaire, type Salarie } from "../domain/salarie";
import { useMetiersRh, useAbsencesRh, useDocumentsRh, useDroitsRh, useEnregistrerFiche, useEquipes, useFichesConducteurLiees, useSalariesRh, useSeuilsRh, useVisitesRh, type HabilitationEnAttente, type VisiteEnAttente } from "../hooks/useRh";
import { ChampsSalarie } from "./ChampsSalarie";
import { Avertissements } from "./communs";
import { ListeSalaries } from "./ListeSalaries";
import { CadreRh } from "./PageRh";
import { SectionConges } from "./SectionConges";
import { SectionDossier } from "./SectionDossier";
import { SectionHabilitations } from "./SectionHabilitations";
import { SectionVisites } from "./SectionVisites";
import { PropositionRole, ZoneCompte } from "./ZoneCompte";

/**
 * La fiche salarié, en création (`/rh/salaries/nouveau`) ou en modification
 * (`/rh/salaries/:id`). Comme l'ancien écran, elle s'ouvre DANS la rubrique
 * Salariés, au-dessus de la liste (`#formZoneSalarie`).
 */
export function PageFicheSalarie() {
  const { id } = useParams();
  const salaries = useSalariesRh();
  const metiers = useMetiersRh();
  const contenu = (() => {
    if (salaries.isPending || metiers.isPending) return <Chargement />;
    if (salaries.isError) return <Erreur erreur={salaries.error} reessayer={() => void salaries.refetch()} />;
    const salarie = id && id !== "nouveau" ? (salaries.data.find((s) => s.id === id) ?? null) : null;
    // Juste après une création, la liste se relit encore : la fiche n'y est pas « introuvable ».
    if (id && id !== "nouveau" && !salarie && salaries.isFetching) return <Chargement />;
    if (id && id !== "nouveau" && !salarie)
      return (
        <div role="alert" className="wf-banner alerte">
          Salarié introuvable, ou vous n&apos;y avez pas accès.
        </div>
      );
    const referentiel = metiers.data;
    return <FicheSalarie key={salarie?.id ?? "nouveau"} salarie={salarie} referentiel={referentiel} />;
  })();
  return (
    <CadreRh vue="salaries">
      <ListeSalaries formulaire={contenu} />
    </CadreRh>
  );
}

function FicheSalarie({ salarie, referentiel }: { salarie: Salarie | null; referentiel: string[] }) {
  const navigate = useNavigate();
  const droits = useDroitsRh();
  const seuils = useSeuilsRh();
  const equipes = useEquipes();
  const fiches = useFichesConducteurLiees();
  const membres = useMembres();
  const documents = useDocumentsRh();
  const visites = useVisitesRh();
  const absences = useAbsencesRh();
  const enregistrer = useEnregistrerFiche();
  const { valeurs, changer } = useFormulaire(valeursFormulaire(salarie, referentiel));
  const existante = salarie ? ((fiches.data ?? []).find((f) => f.salarieId === salarie.id) ?? null) : null;
  // Une fiche RETIRÉE n'est pas cochée : l'ancien écran la cochait et la réactivait au premier enregistrement (D-RH-09).
  const [conducteur, setConducteur] = useState<boolean | null>(null);
  const estConducteur = conducteur ?? !!existante?.actif;
  const [habilitations, setHabilitations] = useState<HabilitationEnAttente[]>([]);
  const [visitesAttente, setVisitesAttente] = useState<VisiteEnAttente[]>([]);
  const [avertissements, setAvertissements] = useState<string[]>([]);
  const [visiteOuverte, setVisiteOuverte] = useState(false);
  const [proposition, setProposition] = useState<{ profileId: string; roleActuel: Parameters<typeof PropositionRole>[0]["roleActuel"] } | null>(null);
  const suiviVisite = useCallback((o: boolean) => setVisiteOuverte(o), []);
  useDefilerVersFormulaire("formZoneSalarie");

  function soumettre() {
    if (visiteOuverte) {
      afficherToast("Une visite est en cours de saisie : enregistrez-la ou annulez-la avant la fiche.");
      return;
    }
    const r = schemaSaisieSalarie.safeParse(valeurs);
    if (!r.success) {
      window.alert(r.error.issues[0]?.message ?? "Saisie invalide.");
      return;
    }
    const saisie = r.data;
    const devientConducteur = estConducteur && !existante?.actif;
    enregistrer.mutate(
      {
        id: salarie?.id ?? null,
        saisie,
        plan: (id) => (droits.conducteur ? planConducteur({ id, nom: saisie.nom, prenom: saisie.prenom, email: saisie.email, telephone: saisie.telephone, profileId: salarie?.profileId ?? null }, existante, estConducteur) : { geste: "rien" }),
        habilitations,
        visites: visitesAttente,
      },
      {
        onSuccess: (issue) => {
          setAvertissements(issue.avertissements);
          setHabilitations(issue.habilitationsRestantes);
          setVisitesAttente(issue.visitesRestantes);
          const aProposer = devientConducteur && droits.conducteur ? roleAProposer(salarie?.profileId ?? null, membres.data ?? []) : null;
          if (aProposer) return setProposition(aProposer);
          if (issue.habilitationsRestantes.length || issue.visitesRestantes.length) return;
          // Une création reste ouverte : dossier et congés n'existent qu'à partir de là.
          if (!salarie) {
            afficherToast("Salarié créé — son dossier documentaire est maintenant ouvert.", "success");
            void navigate(`/rh/salaries/${issue.id}`, { replace: true });
          } else if (!issue.avertissements.length) {
            afficherToast("Salarié modifié.", "success");
            void navigate("/rh");
          }
        },
        onError: (err) => afficherToast(messageErreur(err)),
      }
    );
  }

  const idSalarie = salarie?.id ?? null;
  const optionsEquipes = (equipes.data ?? []).map((e) => ({ valeur: e.id, libelle: libelleEquipe(e) }));
  const nom = salarie ? nomComplet(salarie) : "";
  const documentsDuSalarie = (documents.data ?? []).filter((d) => d.salarieId === idSalarie);
  return (
    // Un `div` et non un `form` : dossier et visites y portent leurs propres formulaires, qu'on ne peut pas imbriquer.
    <div className="form-panel" role="form" aria-label="Fiche salarié">
      <h3>{salarie ? "Modifier le salarié" : "Nouveau salarié"}</h3>
      {proposition && salarie && <PropositionRole nom={nom} profileId={proposition.profileId} roleActuel={proposition.roleActuel} onFini={() => void navigate("/rh")} />}
      <ChampsSalarie
        valeurs={valeurs}
        changer={changer}
        referentiel={referentiel}
        equipes={optionsEquipes}
        salarie={salarie}
        seuilVisite={seuils.visiteMedicale}
        role={
          <div className="field">
            <div className="reglage-titre">Rôle dans l&apos;entreprise</div>
            <label className="bc-tache-row">
              <input type="checkbox" id="sal_estConducteur" checked={estConducteur} disabled={!droits.conducteur} onChange={(e) => setConducteur(e.target.checked)} />
              <span>Conducteur de travaux — proposé dans les documents</span>
            </label>
          </div>
        }
        compte={
          <div className="field">
            <label>Compte utilisateur</label>
            <div className="card-sub">Sans compte, ce salarié ne peut pas déclarer ses travaux lui-même.</div>
            <ZoneCompte salarieId={idSalarie} profileId={salarie?.profileId ?? null} email={valeurs.email} rolePropose={estConducteur ? "conducteur" : "technicien"} />
          </div>
        }
      />
      <div className="section-title" style={{ marginTop: "14px" }}>
        ⚡ Habilitations &amp; certifications
      </div>
      <div id="habilitationsZone">
        <SectionHabilitations salarieId={idSalarie} documents={documentsDuSalarie} enAttente={habilitations} onEnAttente={setHabilitations} />
      </div>
      <div className="section-title" style={{ marginTop: "18px" }}>
        📁 Dossier documentaire
      </div>
      <SectionDossier salarieId={idSalarie} documents={documentsDuSalarie} />
      <div className="section-title" style={{ marginTop: "18px" }}>
        🩺 Suivi médical
      </div>
      <div id="suiviMedicalZone">
        <SectionVisites
          salarieId={idSalarie}
          visites={(visites.data ?? []).filter((v) => v.salarieId === idSalarie)}
          prochaine={salarie?.visiteMedicaleProchaine ?? null}
          enAttente={visitesAttente}
          onEnAttente={setVisitesAttente}
          onEdition={suiviVisite}
        />
      </div>
      {idSalarie ? (
        <SectionConges salarieId={idSalarie} soldeInitial={valeurs.soldeCpInitial} onSoldeInitial={(v) => changer("soldeCpInitial", v)} absences={(absences.data ?? []).filter((a) => a.salarieId === idSalarie)} />
      ) : (
        <div className="card-sub" style={{ marginTop: "14px" }}>
          💡 Enregistrez d&apos;abord la fiche pour pouvoir ajouter le dossier documentaire, le contrat de travail et les congés.
        </div>
      )}
      <Avertissements messages={avertissements} />
      <div style={{ display: "flex", gap: "10px", marginTop: "16px" }}>
        <button type="button" className="btn primary" disabled={enregistrer.isPending} onClick={soumettre}>
          Enregistrer
        </button>
        <Link className="btn ghost" to="/rh">
          Annuler
        </Link>
      </div>
    </div>
  );
}
