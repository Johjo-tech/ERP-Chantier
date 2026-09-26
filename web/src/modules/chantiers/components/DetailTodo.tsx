import { useId, type FormEvent } from "react";
import { Modale, PiedModale } from "@/components/ui/modale";
import { messageErreur } from "@/lib/erreurs";
import { afficherToast } from "@/lib/toast";
import { useFormulaire } from "@/lib/useFormulaire";
import type { Salarie } from "../api/achats";
import type { Todo } from "../api/todos";
import { schemaDetailTodo } from "../domain/todo";
import { useEnregistrerDetailTodo } from "../hooks/useFiche";

interface Props {
  chantierId: string;
  todo: Todo;
  salaries: readonly Salarie[];
  modifiable: boolean;
  fermer: () => void;
}

/** « Détail de la tâche », la modale de l'ancien (`#todoDetailModal`) : texte, date prévue, salarié, notes. */
export function DetailTodo({ chantierId, todo, salaries, modifiable, fermer }: Props) {
  const ids = { texte: useId(), date: useId(), salarie: useId(), notes: useId() };
  const enregistrer = useEnregistrerDetailTodo(chantierId);
  const { valeurs, changer, valider } = useFormulaire({
    texte: todo.texte,
    date_prevue: todo.date_prevue ?? "",
    salarie_id: todo.salarie_id ?? "",
    notes: todo.notes ?? "",
  });

  function soumettre(e: FormEvent) {
    e.preventDefault();
    if (!valeurs.texte.trim()) return afficherToast("La tâche ne peut pas être vide.");
    const d = valider(schemaDetailTodo);
    if (d) enregistrer.mutate({ id: todo.id, detail: d }, { onSuccess: fermer, onError: (err) => afficherToast(messageErreur(err)) });
  }

  return (
    <Modale titre="Détail de la tâche" onFermer={fermer} largeurMax="480px">
      <form onSubmit={soumettre} noValidate>
        <div className="field">
          <label htmlFor={ids.texte}>Tâche</label>
          <input type="text" id={ids.texte} value={valeurs.texte} readOnly={!modifiable} onChange={(e) => changer("texte", e.target.value)} />
        </div>
        <div className="field-grid">
          <div className="field">
            <label htmlFor={ids.date}>Date de réalisation prévue</label>
            <input type="date" id={ids.date} value={valeurs.date_prevue} readOnly={!modifiable} onChange={(e) => changer("date_prevue", e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor={ids.salarie}>Assigné à</label>
            <select id={ids.salarie} value={valeurs.salarie_id} disabled={!modifiable} onChange={(e) => changer("salarie_id", e.target.value)}>
              <option value="">— Sans conducteur / non renseigné —</option>
              {salaries.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.prenom ?? ""} {s.nom ?? ""}
                </option>
              ))}
              {/* Un salarié devenu illisible (sorti, autre rôle) reste affiché plutôt que perdu. */}
              {todo.salarie_id && !salaries.some((s) => s.id === todo.salarie_id) && <option value={todo.salarie_id}>Salarié non listé</option>}
            </select>
          </div>
        </div>
        <div className="field">
          <label htmlFor={ids.notes}>Notes / commentaires</label>
          <textarea id={ids.notes} rows={4} style={{ width: "100%" }} value={valeurs.notes} readOnly={!modifiable} onChange={(e) => changer("notes", e.target.value)} />
        </div>
        <PiedModale>
          {modifiable && (
            <button type="submit" className="btn primary" disabled={enregistrer.isPending}>
              Enregistrer
            </button>
          )}
          <button type="button" className="btn ghost" onClick={fermer}>
            Annuler
          </button>
        </PiedModale>
      </form>
    </Modale>
  );
}
