import { useState, type FormEvent } from "react";
import { ChampChoix, ChampTexte } from "@/components/formulaire/Champ";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { formatDateFr } from "@/lib/dates";
import { useFormulaire } from "@/lib/useFormulaire";
import { AVIS_APTITUDE, depasseLePlafondLegal, prochaineVisiteSuggeree, regimeSuivi, REGIMES_SUIVI, schemaSaisieVisite, TYPES_VISITE, type SaisieVisite } from "../domain/visites";
import { ChoixFichier } from "./communs";

export type ValeursVisite = Record<"dateVisite" | "type" | "suivi" | "organisme" | "medecin" | "avis" | "reserves" | "prochaineVisite" | "notes", string>;

interface Props {
  titre: string;
  initiales: ValeursVisite;
  /** Une échéance déjà enregistrée a été décidée par quelqu'un : la proposition ne la reprend pas. */
  echeanceDecidee: boolean;
  nomFichier: string | null;
  enCours: boolean;
  erreur: string | null;
  onEnregistrer: (saisie: SaisieVisite, fichier: File | null) => void;
  onFermer: () => void;
}

/**
 * Enregistrer une visite (RH-07). L'échéance est proposée DÈS L'OUVERTURE et
 * suit la date, le type et le régime tant que personne n'y a touché ; le
 * dépassement du plafond légal s'affiche au rendu, sans bloquer : c'est le
 * médecin du travail qui arrête la date.
 */
export function FormulaireVisite({ titre, initiales, echeanceDecidee, nomFichier, enCours, erreur, onEnregistrer, onFermer }: Props) {
  const { valeurs, erreurs, changer, valider } = useFormulaire(initiales);
  const [saisieMain, setSaisieMain] = useState(echeanceDecidee);
  const [fichier, setFichier] = useState<File | null>(null);

  function changerCritere(champ: "dateVisite" | "type" | "suivi", v: string) {
    changer(champ, v);
    const suite = { ...valeurs, [champ]: v };
    if (suite.dateVisite && !saisieMain) changer("prochaineVisite", prochaineVisiteSuggeree(suite.dateVisite, suite.suivi, suite.type) ?? "");
  }

  const verdict = valeurs.dateVisite && valeurs.prochaineVisite ? depasseLePlafondLegal(valeurs.dateVisite, valeurs.prochaineVisite, valeurs.suivi) : null;

  function soumettre(e: FormEvent) {
    e.preventDefault();
    const saisie = valider(schemaSaisieVisite);
    if (saisie) onEnregistrer(saisie, fichier);
  }

  return (
    <form onSubmit={soumettre} noValidate aria-label={titre} className="grid gap-3 rounded-md border border-dashed border-border p-3 sm:grid-cols-2">
      <h4 className="font-semibold sm:col-span-2">{titre}</h4>
      <ChampTexte libelle="Date de la visite" type="date" valeur={valeurs.dateVisite} onChange={(v) => changerCritere("dateVisite", v)} erreur={erreurs.dateVisite} requis />
      <ChampChoix libelle="Type de visite" valeur={valeurs.type} onChange={(v) => changerCritere("type", v)} options={TYPES_VISITE.map((t) => ({ valeur: t.code, libelle: `${t.icone} ${t.libelle}` }))} />
      <ChampChoix
        libelle="Régime de suivi"
        valeur={valeurs.suivi}
        onChange={(v) => changerCritere("suivi", v)}
        options={REGIMES_SUIVI.map((r) => ({ valeur: r.code, libelle: r.libelle }))}
        aide={regimeSuivi(valeurs.suivi).reference}
      />
      <ChampChoix libelle="Avis d'aptitude" valeur={valeurs.avis} onChange={(v) => changer("avis", v)} options={[{ valeur: "", libelle: "— Non rendu —" }, ...AVIS_APTITUDE.map((a) => ({ valeur: a.code, libelle: a.libelle }))]} />
      <ChampTexte libelle="Service de santé au travail" valeur={valeurs.organisme} onChange={(v) => changer("organisme", v)} placeholder="Ex : AIST, APST BTP…" />
      <ChampTexte libelle="Médecin" valeur={valeurs.medecin} onChange={(v) => changer("medecin", v)} />
      <ChampTexte
        libelle="Prochaine visite"
        type="date"
        valeur={valeurs.prochaineVisite}
        onChange={(v) => {
          setSaisieMain(true);
          changer("prochaineVisite", v);
        }}
        erreur={erreurs.prochaineVisite}
        aide={verdict?.depasse ? <span className="text-destructive">Au-delà du délai maximal ({formatDateFr(verdict.plafond)}, {verdict.regime.reference}).</span> : undefined}
      />
      <div className="sm:col-span-2">
        <ChampTexte libelle="Réserves et aménagements" valeur={valeurs.reserves} onChange={(v) => changer("reserves", v)} placeholder="Ex : pas de port de charge supérieure à 15 kg" />
      </div>
      <div className="sm:col-span-2">
        <ChampTexte libelle="Notes" valeur={valeurs.notes} onChange={(v) => changer("notes", v)} />
      </div>
      <div className="sm:col-span-2">
        <ChoixFichier libelle={nomFichier ? "Remplacer l'attestation" : "Joindre l'attestation"} onFichiers={(f) => setFichier(f[0] ?? null)} nomActuel={fichier?.name ?? nomFichier} />
      </div>
      {erreur && <Alert variant="erreur" className="sm:col-span-2">{erreur}</Alert>}
      <div className="flex gap-2 sm:col-span-2">
        <Button type="submit" disabled={enCours}>{enCours ? "Enregistrement…" : "Enregistrer la visite"}</Button>
        <Button variant="ghost" onClick={onFermer}>Annuler</Button>
      </div>
    </form>
  );
}
