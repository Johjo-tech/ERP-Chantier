import { useState, type FormEvent } from "react";
import { ChampChoix, ChampTexte } from "@/components/formulaire/Champ";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { BoutonConfirme } from "@/components/ui/confirmation";
import { formatDateFr, todayISO } from "@/lib/dates";
import { messageErreur } from "@/lib/erreurs";
import { useFormulaire } from "@/lib/useFormulaire";
import { demandeJustificatif, nbJoursOuvres, schemaSaisieAbsence, soldeCpRestant, trierAbsences, TYPES_ABSENCE, type Absence } from "../domain/conges";
import { useDroitsRh, useGererDossier } from "../hooks/useRh";
import { BoutonPiece, ChoixFichier } from "./communs";

const formatJours = new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/**
 * Congés et absences (RH-08, RH-20). Le solde restant se calcule sur l'acquis
 * SAISI dans la fiche (enregistré avec elle, plus à chaque frappe) et sur les
 * absences relues de la base — elles ne se perdent plus au rechargement.
 */
export function SectionConges({ salarieId, soldeInitial, absences }: { salarieId: string; soldeInitial: string; absences: readonly Absence[] }) {
  const droits = useDroitsRh();
  const gerer = useGererDossier();
  const restant = soldeCpRestant(soldeInitial.replace(",", "."), absences);
  return (
    <div className="flex flex-col gap-2 text-sm">
      <p>
        Solde restant (calculé) : <strong>{formatJours.format(restant)} jour(s)</strong>
      </p>
      {droits.modifier && <FormulaireAbsence salarieId={salarieId} />}
      {gerer.supprimerAbsence.isError && <Alert variant="erreur">{messageErreur(gerer.supprimerAbsence.error)}</Alert>}
      {absences.length === 0 ? (
        <p className="text-muted-foreground">Aucune absence enregistrée.</p>
      ) : (
        <ul className="divide-y divide-border">
          {trierAbsences(absences).map((a) => (
            <li key={a.id} className="flex flex-wrap items-center gap-2 py-1.5">
              <span className="flex-1">
                🏖️ <strong>{a.type}</strong>
                {a.commentaire && ` — ${a.commentaire}`}
                <span className="block text-xs text-muted-foreground">
                  {formatDateFr(a.dateDebut)} → {formatDateFr(a.dateFin)} · {a.nbJours ?? "?"} jour(s) ouvré(s)
                </span>
              </span>
              {a.justificatifChemin && <BoutonPiece chemin={a.justificatifChemin} libelle="📎 justificatif" />}
              {droits.supprimer && <BoutonConfirme libelle="✕" question={`Retirer cette absence (${a.type}) ?`} onConfirmer={() => gerer.supprimerAbsence.mutate(a)} />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function FormulaireAbsence({ salarieId }: { salarieId: string }) {
  const gerer = useGererDossier();
  const [fichier, setFichier] = useState<File | null>(null);
  const initiales = { type: TYPES_ABSENCE[0] as string, dateDebut: "", dateFin: "", commentaire: "" };
  const { valeurs, erreurs, changer, valider, reinitialiser } = useFormulaire(initiales);
  const justifier = demandeJustificatif(valeurs.type);

  function soumettre(e: FormEvent) {
    e.preventDefault();
    const saisie = valider(schemaSaisieAbsence);
    if (!saisie) return;
    gerer.ajouterAbsence.mutate(
      { salarieId, saisie, nbJours: nbJoursOuvres(saisie.dateDebut, saisie.dateFin), aujourdHui: todayISO(), fichier: justifier ? fichier : null },
      {
        onSuccess: () => {
          reinitialiser(initiales);
          setFichier(null);
        },
      }
    );
  }

  return (
    <form onSubmit={soumettre} noValidate aria-label="Ajouter une absence" className="grid gap-2 rounded-md border border-dashed border-border p-3 sm:grid-cols-4">
      <ChampChoix libelle="Type d'absence" valeur={valeurs.type} onChange={(v) => changer("type", v)} options={TYPES_ABSENCE.map((t) => ({ valeur: t, libelle: t }))} />
      <ChampTexte libelle="Début" type="date" valeur={valeurs.dateDebut} onChange={(v) => changer("dateDebut", v)} erreur={erreurs.dateDebut} />
      <ChampTexte libelle="Fin" type="date" valeur={valeurs.dateFin} onChange={(v) => changer("dateFin", v)} erreur={erreurs.dateFin} />
      <ChampTexte libelle="Commentaire" valeur={valeurs.commentaire} onChange={(v) => changer("commentaire", v)} placeholder="Optionnel" />
      {justifier && (
        <div className="sm:col-span-4">
          <ChoixFichier libelle="Joindre le document du médecin" onFichiers={(f) => setFichier(f[0] ?? null)} nomActuel={fichier?.name} />
        </div>
      )}
      {gerer.ajouterAbsence.isError && <Alert variant="erreur" className="sm:col-span-4">{messageErreur(gerer.ajouterAbsence.error)}</Alert>}
      <div className="sm:col-span-4">
        <Button type="submit" size="sm" disabled={gerer.ajouterAbsence.isPending}>+ Ajouter l'absence</Button>
      </div>
    </form>
  );
}
