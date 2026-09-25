import { useState, type FormEvent } from "react";
import { ChampTexte } from "@/components/formulaire/Champ";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { messageErreur } from "@/lib/erreurs";
import { useFormulaire } from "@/lib/useFormulaire";
import { BoutonDepot } from "@/modules/chantiers/components/Fichiers";
import { ACCEPTE_DOCUMENT_VEHICULE } from "../domain/documents";
import { saisieEntretienDepuis, schemaSaisieEntretien, type Entretien, type SaisieEntretien } from "../domain/entretien";

interface Props {
  entretien: Entretien | null;
  kmVehicule: number | null;
  voitLesPrix: boolean;
  enCours: boolean;
  erreur: unknown;
  /** La facture jointe ne se prend qu'à l'ajout, comme dans l'ancien écran. */
  onEnregistrer: (s: SaisieEntretien, fichier: File | null, reussi: () => void) => void;
  onAnnuler?: () => void;
}

/** Ajouter ou corriger un entretien : désignation, kilométrage, montant, date (et facture à l'ajout). */
export function FormulaireEntretien({ entretien, kmVehicule, voitLesPrix, enCours, erreur, onEnregistrer, onAnnuler }: Props) {
  const { valeurs, erreurs, changer, valider, reinitialiser } = useFormulaire(saisieEntretienDepuis(entretien, kmVehicule));
  const [fichier, setFichier] = useState<File | null>(null);

  function soumettre(e: FormEvent) {
    e.preventDefault();
    const s = valider(schemaSaisieEntretien);
    if (!s) return;
    // Le formulaire d'ajout ne se vide qu'une fois l'entretien ENREGISTRÉ : un échec garde la saisie.
    onEnregistrer(s, fichier, () => {
      if (entretien) return;
      setFichier(null);
      reinitialiser(saisieEntretienDepuis(null, s.kilometrage ?? kmVehicule));
    });
  }

  return (
    <form onSubmit={soumettre} noValidate aria-label={entretien ? "Modifier l'entretien" : "Ajouter un entretien"} className="flex flex-col gap-2">
      {!!erreur && <Alert variant="erreur">{messageErreur(erreur)}</Alert>}
      <div className="grid gap-2 sm:grid-cols-4">
        <ChampTexte libelle="Désignation" requis placeholder="Ex : Vidange, plaquettes de frein…" valeur={valeurs.designation} onChange={(v) => changer("designation", v)} erreur={erreurs.designation} />
        <ChampTexte libelle="Kilométrage" inputMode="numeric" valeur={valeurs.kilometrage} onChange={(v) => changer("kilometrage", v)} erreur={erreurs.kilometrage} />
        {voitLesPrix && <ChampTexte libelle="Montant (€)" inputMode="decimal" valeur={valeurs.montant} onChange={(v) => changer("montant", v)} erreur={erreurs.montant} />}
        <ChampTexte libelle="Date" type="date" valeur={valeurs.date_entretien} onChange={(v) => changer("date_entretien", v)} erreur={erreurs.date_entretien} />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {!entretien && <BoutonDepot libelle={fichier ? `Facture : ${fichier.name}` : "Joindre la facture"} accepte={ACCEPTE_DOCUMENT_VEHICULE} onFichier={setFichier} />}
        <Button type="submit" size="sm" disabled={enCours}>
          {entretien ? "Enregistrer" : "Ajouter"}
        </Button>
        {onAnnuler && (
          <Button type="button" size="sm" variant="ghost" onClick={onAnnuler}>
            Annuler
          </Button>
        )}
      </div>
    </form>
  );
}
