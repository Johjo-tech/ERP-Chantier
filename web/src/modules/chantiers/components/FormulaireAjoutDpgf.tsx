import { type FormEvent } from "react";
import { ChampChoix, ChampTexte } from "@/components/formulaire/Champ";
import { Button } from "@/components/ui/button";
import { messageErreur } from "@/lib/erreurs";
import { useFormulaire } from "@/lib/useFormulaire";
import { schemaNouvelleLigneDpgf } from "../domain/saisie-dpgf";
import { useAjouterLigneDpgf } from "../hooks/useChantiers";

const VIDE = { type: "ligne", designation: "", quantite: "1", prix_unitaire: "", unite: "u" };

/**
 * « + Ligne / + Chapitre » : la nouvelle ligne part en base tout de suite, et
 * les saisies en cours dans le tableau restent (elles sont tenues à part —
 * l'ancien bouton les effaçait, CHA-53).
 */
export function FormulaireAjoutDpgf({ chantierId, positionSuivante }: { chantierId: string; positionSuivante: number }) {
  const ajouter = useAjouterLigneDpgf(chantierId);
  const { valeurs, erreurs, changer, valider, reinitialiser } = useFormulaire(VIDE);

  function soumettre(e: FormEvent) {
    e.preventDefault();
    const l = valider(schemaNouvelleLigneDpgf);
    if (l) ajouter.mutate({ position: positionSuivante, ligne: l }, { onSuccess: () => reinitialiser(VIDE) });
  }

  const chapitre = valeurs.type === "chapitre";
  return (
    <form onSubmit={soumettre} noValidate aria-label="Ajouter au DPGF" className="grid gap-2 border-t border-border pt-3 sm:grid-cols-7">
      <ChampChoix libelle="Type" valeur={valeurs.type} onChange={(v) => changer("type", v)} options={[{ valeur: "ligne", libelle: "Ligne" }, { valeur: "chapitre", libelle: "Chapitre" }]} />
      <div className="sm:col-span-2">
        <ChampTexte libelle="Désignation" valeur={valeurs.designation} onChange={(v) => changer("designation", v)} erreur={erreurs.designation} />
      </div>
      <ChampTexte libelle="Quantité" inputMode="decimal" valeur={valeurs.quantite} onChange={(v) => changer("quantite", v)} erreur={erreurs.quantite} desactive={chapitre} />
      <ChampTexte libelle="Unité" valeur={valeurs.unite} onChange={(v) => changer("unite", v)} desactive={chapitre} />
      <ChampTexte libelle="PU HT" inputMode="decimal" valeur={valeurs.prix_unitaire} onChange={(v) => changer("prix_unitaire", v)} erreur={erreurs.prix_unitaire} desactive={chapitre} />
      <div className="flex items-end">
        <Button type="submit" variant="secondary" disabled={ajouter.isPending}>
          {chapitre ? "+ Chapitre" : "+ Ligne"}
        </Button>
      </div>
      {ajouter.isError && <p role="alert" className="text-sm text-destructive sm:col-span-7">{messageErreur(ajouter.error)}</p>}
    </form>
  );
}
