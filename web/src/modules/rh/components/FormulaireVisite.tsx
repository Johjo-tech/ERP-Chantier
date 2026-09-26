import { useState, type FormEvent } from "react";
import { ChampChoix, ChampTexte } from "@/components/formulaire/Champ";
import { formatDateFr } from "@/lib/dates";
import { messageErreur } from "@/lib/erreurs";
import { afficherToast } from "@/lib/toast";
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
  onEnregistrer: (saisie: SaisieVisite, fichier: File | null) => void;
  onFermer: () => void;
}

/**
 * Enregistrer une visite (RH-07), au HTML de `formVisiteRhHTML` (rh-visites.js
 * l. 365). L'échéance est proposée DÈS L'OUVERTURE et suit la date, le type et
 * le régime tant que personne n'y a touché ; le dépassement du plafond légal
 * s'affiche au rendu, sans bloquer : c'est le médecin du travail qui arrête la date.
 */
export function FormulaireVisite({ titre, initiales, echeanceDecidee, nomFichier, enCours, onEnregistrer, onFermer }: Props) {
  const { valeurs, changer } = useFormulaire(initiales);
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
    const r = schemaSaisieVisite.safeParse(valeurs);
    if (!r.success) {
      afficherToast(r.error.issues[0]?.message ?? messageErreur(r.error));
      return;
    }
    onEnregistrer(r.data, fichier);
  }

  return (
    <form className="form-panel" style={{ marginTop: "12px" }} onSubmit={soumettre} noValidate aria-label={titre}>
      <h3>{titre}</h3>
      <div className="field-grid">
        <ChampTexte libelle="Date de la visite" type="date" valeur={valeurs.dateVisite} onChange={(v) => changerCritere("dateVisite", v)} />
        <ChampChoix libelle="Type de visite" valeur={valeurs.type} onChange={(v) => changerCritere("type", v)} options={TYPES_VISITE.map((t) => ({ valeur: t.code, libelle: `${t.icone} ${t.libelle}` }))} />
        <div className="field">
          <label htmlFor="visRh_suivi">Régime de suivi</label>
          <select id="visRh_suivi" value={valeurs.suivi} onChange={(e) => changerCritere("suivi", e.target.value)}>
            {REGIMES_SUIVI.map((r) => (
              <option key={r.code} value={r.code}>
                {r.libelle}
              </option>
            ))}
          </select>
          <div className="card-sub" style={{ marginTop: "4px" }}>
            {regimeSuivi(valeurs.suivi).reference}
          </div>
        </div>
        <ChampChoix libelle="Avis d'aptitude" valeur={valeurs.avis} onChange={(v) => changer("avis", v)} options={[{ valeur: "", libelle: "— Non rendu —" }, ...AVIS_APTITUDE.map((a) => ({ valeur: a.code, libelle: a.libelle }))]} />
        <ChampTexte libelle="Service de santé au travail" valeur={valeurs.organisme} onChange={(v) => changer("organisme", v)} placeholder="Ex : AIST, APST BTP…" />
        <ChampTexte libelle="Médecin" valeur={valeurs.medecin} onChange={(v) => changer("medecin", v)} />
        <div className="field">
          <label htmlFor="visRh_prochaineVisite">Prochaine visite</label>
          <input
            type="date"
            id="visRh_prochaineVisite"
            value={valeurs.prochaineVisite}
            onChange={(e) => {
              setSaisieMain(true);
              changer("prochaineVisite", e.target.value);
            }}
          />
          <div className="card-sub" style={{ marginTop: "4px", color: verdict?.depasse ? "#a30f22" : undefined }}>
            {verdict?.depasse ? `Au-delà du délai maximal (${formatDateFr(verdict.plafond)}, ${verdict.regime.reference}).` : ""}
          </div>
        </div>
        <ChampTexte className="full" libelle="Réserves et aménagements" valeur={valeurs.reserves} onChange={(v) => changer("reserves", v)} placeholder="Ex : pas de port de charge supérieure à 15 kg" />
        <ChampTexte className="full" libelle="Notes" valeur={valeurs.notes} onChange={(v) => changer("notes", v)} />
      </div>
      <div className="achat-salarie-zone">
        <ChoixFichier libelle={nomFichier ? "Remplacer l'attestation" : "Joindre l'attestation"} onFichiers={(f) => setFichier(f[0] ?? null)} nomActuel={fichier?.name ?? nomFichier} />
      </div>
      <div style={{ display: "flex", gap: "10px", marginTop: "14px" }}>
        <button type="submit" className="btn primary" disabled={enCours}>
          Enregistrer
        </button>
        <button type="button" className="btn ghost" onClick={onFermer}>
          Annuler
        </button>
      </div>
    </form>
  );
}
