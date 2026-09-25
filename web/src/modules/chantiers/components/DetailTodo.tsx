import { useId, type FormEvent } from "react";
import { ChampChoix, ChampTexte, ChampZone } from "@/components/formulaire/Champ";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { BoutonConfirme } from "@/components/ui/confirmation";
import { messageErreur } from "@/lib/erreurs";
import { useFormulaire } from "@/lib/useFormulaire";
import type { Salarie } from "../api/achats";
import type { Todo } from "../api/todos";
import { schemaDetailTodo } from "../domain/todo";
import { useEnregistrerDetailTodo, useSupprimerTodo } from "../hooks/useFiche";

interface Props {
  chantierId: string;
  todo: Todo;
  salaries: readonly Salarie[];
  modifiable: boolean;
  fermer: () => void;
}

/** Le détail d'un point de to-do : texte, date prévue, salarié, notes ; ou sa suppression. */
export function DetailTodo({ chantierId, todo, salaries, modifiable, fermer }: Props) {
  const titre = useId();
  const enregistrer = useEnregistrerDetailTodo(chantierId);
  const supprimer = useSupprimerTodo(chantierId);
  const { valeurs, erreurs, changer, valider } = useFormulaire({
    texte: todo.texte,
    date_prevue: todo.date_prevue ?? "",
    salarie_id: todo.salarie_id ?? "",
    notes: todo.notes ?? "",
  });

  function soumettre(e: FormEvent) {
    e.preventDefault();
    const d = valider(schemaDetailTodo);
    if (d) enregistrer.mutate({ id: todo.id, detail: d }, { onSuccess: fermer });
  }

  return (
    <form onSubmit={soumettre} noValidate role="dialog" aria-labelledby={titre} className="flex flex-col gap-2 rounded-md border border-primary/40 bg-primary/5 p-3">
      <h3 id={titre} className="text-sm font-semibold">Détail de la tâche</h3>
      <ChampTexte libelle="Tâche" valeur={valeurs.texte} onChange={(v) => changer("texte", v)} erreur={erreurs.texte} desactive={!modifiable} requis />
      <div className="grid gap-2 sm:grid-cols-2">
        <ChampTexte libelle="Date prévue" type="date" valeur={valeurs.date_prevue} onChange={(v) => changer("date_prevue", v)} erreur={erreurs.date_prevue} desactive={!modifiable} />
        <ChampChoix
          libelle="Salarié"
          valeur={valeurs.salarie_id}
          onChange={(v) => changer("salarie_id", v)}
          desactive={!modifiable}
          options={[
            { valeur: "", libelle: "— Non renseigné —" },
            ...salaries.map((s) => ({ valeur: s.id, libelle: [s.prenom, s.nom].filter(Boolean).join(" ") })),
            // Un salarié devenu illisible (sorti, autre rôle) reste affiché plutôt que perdu.
            ...(todo.salarie_id && !salaries.some((s) => s.id === todo.salarie_id) ? [{ valeur: todo.salarie_id, libelle: "Salarié non listé" }] : []),
          ]}
        />
      </div>
      <ChampZone libelle="Notes" valeur={valeurs.notes} onChange={(v) => changer("notes", v)} desactive={!modifiable} />
      {(enregistrer.isError || supprimer.isError) && <Alert variant="erreur">{messageErreur(enregistrer.error ?? supprimer.error)}</Alert>}
      <div className="flex flex-wrap gap-2">
        {modifiable && <Button type="submit" size="sm" disabled={enregistrer.isPending}>Enregistrer</Button>}
        <Button type="button" size="sm" variant="ghost" onClick={fermer}>Fermer</Button>
        {modifiable && (
          <span className="ml-auto">
            <BoutonConfirme libelle="Supprimer" question="Supprimer cette tâche ?" onConfirmer={() => supprimer.mutate(todo.id, { onSuccess: fermer })} />
          </span>
        )}
      </div>
    </form>
  );
}
