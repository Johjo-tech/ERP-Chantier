import { useState } from "react";
import { Link } from "react-router";
import { Chargement, Erreur, Vide } from "@/components/etats/Etats";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BoutonConfirme } from "@/components/ui/confirmation";
import { Input, Select } from "@/components/ui/input";
import { formatDateFr, todayISO } from "@/lib/dates";
import { messageErreur } from "@/lib/erreurs";
import { montant } from "@/lib/money";
import { formatEurosEcran, useModeDiscret } from "@/lib/modeDiscret";
import { useMetiers } from "@/modules/reglages/hooks/useReglagesEcran";
import { absenceEnCours, type Absence } from "../domain/conges";
import { aVerifier, conformiteRh, motifIncomplet, type SeuilsRh } from "../domain/conformite";
import type { DocumentRh } from "../domain/documents";
import { filtrerSalaries, metiersDuFiltre, nomComplet, type Salarie } from "../domain/salarie";
import { useAbsencesRh, useDocumentsRh, useDroitsRh, useGererSalaries, useSalariesRh, useSeuilsRh, useVisitesRh } from "../hooks/useRh";
import { BadgeVisite } from "./BadgeVisite";

/** La liste des salariés (RH-01) : recherche, filtre métier, badges, coûts pour qui tient les dossiers. */
export function ListeSalaries() {
  useModeDiscret();
  const salaries = useSalariesRh();
  const metiers = useMetiers();
  const [recherche, setRecherche] = useState("");
  const [metier, setMetier] = useState("");
  const gerer = useGererSalaries();

  if (salaries.isPending) return <Chargement />;
  if (salaries.isError) return <Erreur erreur={salaries.error} reessayer={() => void salaries.refetch()} />;
  const referentiel = (metiers.data ?? []).map((m) => m.libelle);
  const liste = filtrerSalaries(salaries.data, recherche, metier);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <Input aria-label="Rechercher un salarié" className="min-w-56 flex-1" placeholder="Rechercher : nom, prénom, poste…" value={recherche} onChange={(e) => setRecherche(e.target.value)} />
        <Select aria-label="Filtrer par métier" className="w-auto min-w-44" value={metier} onChange={(e) => setMetier(e.target.value)}>
          <option value="">Tous les métiers</option>
          {metiersDuFiltre(referentiel, salaries.data).map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </Select>
      </div>
      {gerer.supprimer.isError && <Alert variant="erreur">{messageErreur(gerer.supprimer.error)}</Alert>}
      {liste.length === 0 ? <Vide message="Aucun salarié pour cette société." /> : <Cartes liste={liste} supprimer={(id) => gerer.supprimer.mutate(id)} />}
    </div>
  );
}

function Cartes({ liste, supprimer }: { liste: readonly Salarie[]; supprimer: (id: string) => void }) {
  useModeDiscret();
  const droits = useDroitsRh();
  const documents = useDocumentsRh();
  const visites = useVisitesRh();
  const absences = useAbsencesRh();
  const seuils = useSeuilsRh();
  // Tant que les dossiers ne sont pas lus, pas de badge : « incomplet » sur un dossier non lu serait un mensonge.
  const dossiersLus = droits.sensible && documents.isSuccess && visites.isSuccess;
  return (
    <ul className="flex flex-col gap-2">
      {liste.map((s) => (
        <CarteSalarie
          key={s.id}
          s={s}
          documents={(documents.data ?? []).filter((d) => d.salarieId === s.id)}
          absences={(absences.data ?? []).filter((a) => a.salarieId === s.id)}
          dossiersLus={dossiersLus}
          seuils={seuils}
          supprimer={() => supprimer(s.id)}
        />
      ))}
    </ul>
  );
}

interface PropsCarte {
  s: Salarie;
  documents: DocumentRh[];
  absences: Absence[];
  dossiersLus: boolean;
  seuils: SeuilsRh;
  supprimer: () => void;
}

function CarteSalarie({ s, documents, absences, dossiersLus, seuils, supprimer }: PropsCarte) {
  useModeDiscret();
  const droits = useDroitsRh();
  const aujourdHui = todayISO();
  const verifier = aVerifier(s.carteBtpValidite, documents, aujourdHui, seuils);
  const absent = absenceEnCours(absences, aujourdHui);
  const bilan = dossiersLus ? conformiteRh(documents, s.visiteMedicaleProchaine, aujourdHui, seuils) : null;
  return (
    <li className="rounded-md border border-border p-3">
      <div className="flex flex-wrap justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-1.5 font-medium">
            {nomComplet(s)}
            {!s.actif && <Badge variant="neutre">sorti</Badge>}
            {verifier.length > 0 && <Badge variant="alerte" title={verifier.join(", ")}>⚠ à vérifier</Badge>}
            {droits.sensible && <BadgeVisite prochaine={s.visiteMedicaleProchaine} seuil={seuils.visiteMedicale} />}
            {absent && <Badge variant="danger">🏖️ Absent ({absent.type}, retour {formatDateFr(absent.dateFin)})</Badge>}
            {bilan && !bilan.complet && <Badge variant="danger" title={motifIncomplet(bilan)}>📁 dossier incomplet</Badge>}
            {!s.profileId && <Badge variant="alerte" title="Sans compte, ce salarié ne peut pas déclarer ses travaux lui-même">⚠ sans compte</Badge>}
          </p>
          <p className="text-sm text-muted-foreground">{[s.poste, s.typeContrat, s.technicienId ? "🔧 équipe liée" : null].filter(Boolean).join(" · ")}</p>
          <p className="text-sm text-muted-foreground">{[s.telephone && `📞 ${s.telephone}`, s.email && `✉ ${s.email}`].filter(Boolean).join(" · ")}</p>
        </div>
        {droits.sensible && (
          <dl className="text-right text-sm">
            <dt className="text-xs text-muted-foreground">coût chargé</dt>
            <dd className="font-semibold">{s.coutHoraireCharge != null ? `${formatEurosEcran(montant(s.coutHoraireCharge))}/h` : "—"}</dd>
            <dt className="text-xs text-muted-foreground">salaire net/mois</dt>
            <dd className="font-semibold">{s.salaireMensuelNet != null ? formatEurosEcran(montant(s.salaireMensuelNet)) : "—"}</dd>
          </dl>
        )}
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {droits.modifier && (
          <Button asChild size="sm" variant="outline">
            <Link to={`/rh/salaries/${s.id}`}>Modifier</Link>
          </Button>
        )}
        {droits.sensible && (
          <Button asChild size="sm" variant="outline">
            <Link to={`/rh?vue=documents&salarie=${s.id}`}>📁 Dossier</Link>
          </Button>
        )}
        {droits.supprimer && <BoutonConfirme libelle="Supprimer" question={`Supprimer ${nomComplet(s)} et tout son dossier ?`} onConfirmer={supprimer} />}
      </div>
    </li>
  );
}
