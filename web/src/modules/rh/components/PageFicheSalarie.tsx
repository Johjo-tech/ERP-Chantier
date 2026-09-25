import { useCallback, useId, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router";
import { Chargement, Erreur } from "@/components/etats/Etats";
import { EnTetePage } from "@/components/page/EnTetePage";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { messageErreur } from "@/lib/erreurs";
import { useFormulaire } from "@/lib/useFormulaire";
import { useMembres } from "@/modules/comptes/hooks/useComptes";
import { useMetiers } from "@/modules/reglages/hooks/useReglagesEcran";
import { libelleEquipe, planConducteur, roleAProposer } from "../domain/intervenants";
import { nomComplet, schemaSaisieSalarie, valeursFormulaire, type Salarie } from "../domain/salarie";
import { useAbsencesRh, useDocumentsRh, useDroitsRh, useEnregistrerFiche, useEquipes, useFichesConducteurLiees, useSalariesRh, useVisitesRh, type HabilitationEnAttente, type VisiteEnAttente } from "../hooks/useRh";
import { ChampsSalarie } from "./ChampsSalarie";
import { Avertissements } from "./communs";
import { SectionConges } from "./SectionConges";
import { SectionDossier } from "./SectionDossier";
import { SectionHabilitations } from "./SectionHabilitations";
import { SectionVisites } from "./SectionVisites";
import { PropositionRole, ZoneCompte } from "./ZoneCompte";

/** La fiche salarié, en création (`/rh/salaries/nouveau`) ou en modification (`/rh/salaries/:id`). */
export function PageFicheSalarie() {
  const { id } = useParams();
  const salaries = useSalariesRh();
  const metiers = useMetiers();
  if (salaries.isPending || metiers.isPending) return <Chargement />;
  if (salaries.isError) return <Erreur erreur={salaries.error} reessayer={() => void salaries.refetch()} />;
  const salarie = id && id !== "nouveau" ? (salaries.data.find((s) => s.id === id) ?? null) : null;
  // Juste après une création, la liste se relit encore : la fiche n'y est pas « introuvable ».
  if (id && id !== "nouveau" && !salarie && salaries.isFetching) return <Chargement />;
  if (id && id !== "nouveau" && !salarie) return <Alert variant="erreur">Salarié introuvable, ou vous n'y avez pas accès.</Alert>;
  const referentiel = (metiers.data ?? []).map((m) => m.libelle);
  return <FicheSalarie key={salarie?.id ?? "nouveau"} salarie={salarie} referentiel={referentiel} />;
}

function FicheSalarie({ salarie, referentiel }: { salarie: Salarie | null; referentiel: string[] }) {
  const idFormulaire = useId();
  const navigate = useNavigate();
  const cree = (useLocation().state as { cree?: boolean } | null)?.cree === true;
  const droits = useDroitsRh();
  const equipes = useEquipes();
  const fiches = useFichesConducteurLiees();
  const membres = useMembres();
  const documents = useDocumentsRh();
  const visites = useVisitesRh();
  const absences = useAbsencesRh();
  const enregistrer = useEnregistrerFiche();
  const { valeurs, erreurs, changer, valider } = useFormulaire(valeursFormulaire(salarie, referentiel));
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

  function soumettre(e: FormEvent) {
    e.preventDefault();
    if (visiteOuverte) return setAvertissements(["Une visite est en cours de saisie : enregistrez-la ou annulez-la avant la fiche."]);
    const saisie = valider(schemaSaisieSalarie);
    if (!saisie) return;
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
          if (!salarie) navigate(`/rh/salaries/${issue.id}`, { replace: true, state: { cree: true } });
          else if (!issue.avertissements.length) navigate("/rh");
        },
      }
    );
  }

  const idSalarie = salarie?.id ?? null;
  const optionsEquipes = (equipes.data ?? []).map((e) => ({ valeur: e.id, libelle: libelleEquipe(e) }));
  const nom = salarie ? nomComplet(salarie) : "Nouveau salarié";
  return (
    <div className="flex flex-col gap-4">
      <EnTetePage titre={salarie ? `Modifier ${nom}` : "Nouveau salarié"} actions={<Button asChild variant="ghost"><Link to="/rh">← Retour RH</Link></Button>} />
      {cree && <Alert variant="succes">Salarié créé — son dossier documentaire est maintenant ouvert.</Alert>}
      {proposition && salarie && <PropositionRole nom={nom} profileId={proposition.profileId} roleActuel={proposition.roleActuel} onFini={() => navigate("/rh")} />}
      <form id={idFormulaire} onSubmit={soumettre} noValidate aria-label="Fiche salarié" className="flex flex-col gap-3">
        <ChampsSalarie valeurs={valeurs} erreurs={erreurs} changer={changer} referentiel={referentiel} equipes={optionsEquipes} salarie={salarie} />
        <fieldset className="flex flex-col gap-1">
          <legend className="text-sm font-medium">Rôle dans l'entreprise</legend>
          <label className="inline-flex items-center gap-2 text-sm">
            <input type="checkbox" checked={estConducteur} disabled={!droits.conducteur} onChange={(e) => setConducteur(e.target.checked)} />
            Conducteur de travaux — proposé dans les documents
          </label>
          {!droits.conducteur && <p className="text-xs text-muted-foreground">Votre rôle ne permet pas de modifier les fiches de conducteur (administrateur).</p>}
        </fieldset>
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium">Compte utilisateur</span>
          <p className="text-xs text-muted-foreground">Sans compte, ce salarié ne peut pas déclarer ses travaux lui-même.</p>
          <ZoneCompte salarieId={idSalarie} profileId={salarie?.profileId ?? null} email={valeurs.email} rolePropose={estConducteur ? "conducteur" : "technicien"} />
        </div>
      </form>
      <Section titre="⚡ Habilitations & certifications">
        <SectionHabilitations salarieId={idSalarie} documents={(documents.data ?? []).filter((d) => d.salarieId === idSalarie)} enAttente={habilitations} onEnAttente={setHabilitations} />
      </Section>
      <Section titre="📁 Dossier documentaire">
        <SectionDossier salarieId={idSalarie} documents={(documents.data ?? []).filter((d) => d.salarieId === idSalarie)} />
      </Section>
      <Section titre="🩺 Suivi médical">
        <SectionVisites salarieId={idSalarie} visites={(visites.data ?? []).filter((v) => v.salarieId === idSalarie)} prochaine={salarie?.visiteMedicaleProchaine ?? null} enAttente={visitesAttente} onEnAttente={setVisitesAttente} onEdition={suiviVisite} />
      </Section>
      {idSalarie ? (
        <Section titre="🏖️ Congés & absences">
          <SectionConges salarieId={idSalarie} soldeInitial={valeurs.soldeCpInitial} absences={(absences.data ?? []).filter((a) => a.salarieId === idSalarie)} />
        </Section>
      ) : (
        <p className="text-sm text-muted-foreground">💡 Enregistrez d'abord la fiche pour pouvoir ajouter le dossier documentaire et les congés.</p>
      )}
      <Avertissements messages={avertissements} />
      {enregistrer.isError && <Alert variant="erreur">{messageErreur(enregistrer.error)}</Alert>}
      <div className="flex gap-2">
        <Button type="submit" form={idFormulaire} disabled={enregistrer.isPending}>{enregistrer.isPending ? "Enregistrement…" : "Enregistrer"}</Button>
        <Button asChild variant="ghost"><Link to="/rh">Annuler</Link></Button>
      </div>
    </div>
  );
}

function Section({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{titre}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
