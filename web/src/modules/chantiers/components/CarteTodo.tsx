import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDateFr } from "@/lib/dates";
import type { Salarie } from "../api/achats";
import type { Todo } from "../api/todos";
import { estEnRetard, statutTodo, statutVoisin, STATUTS_TODO, type StatutTodo } from "../domain/todo";

interface Props {
  todo: Todo;
  aujourdhui: string;
  salarie: Salarie | undefined;
  modifiable: boolean;
  typeGlisse: string;
  deplacer: (s: StatutTodo) => void;
  ouvrir: () => void;
}

const libelle = (s: StatutTodo) => STATUTS_TODO.find((x) => x.code === s)?.libelle ?? s;

/** Une carte du kanban : glissable à la souris, déplaçable au clavier (← →), ouvrable pour le détail. */
export function CarteTodo({ todo, aujourdhui, salarie, modifiable, typeGlisse, deplacer, ouvrir }: Props) {
  const statut = statutTodo(todo);
  const retard = estEnRetard(todo, aujourdhui);
  const initiales = salarie ? `${(salarie.prenom ?? "?")[0] ?? "?"}${(salarie.nom ?? "?")[0] ?? "?"}` : "";
  const gauche = statutVoisin(statut, -1);
  const droite = statutVoisin(statut, 1);
  return (
    <article
      draggable={modifiable}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData(typeGlisse, todo.id);
      }}
      className="flex flex-col gap-1 rounded-md border border-border bg-card p-2 text-sm shadow-sm"
    >
      <Button variant="link" className="h-auto justify-start whitespace-normal p-0 text-left text-foreground" onClick={ouvrir}>
        {todo.texte}
      </Button>
      {(todo.date_prevue || salarie) && (
        <div className="flex flex-wrap gap-1">
          {todo.date_prevue && (
            <Badge variant={retard ? "danger" : "neutre"}>
              {retard ? "En retard — " : ""}
              {formatDateFr(todo.date_prevue)}
            </Badge>
          )}
          {salarie && (
            <Badge variant="neutre" title={[salarie.prenom, salarie.nom].filter(Boolean).join(" ")}>
              {initiales}
            </Badge>
          )}
        </div>
      )}
      {modifiable && (
        <div className="flex justify-end gap-1">
          {gauche !== statut && (
            <Button size="sm" variant="ghost" aria-label={`Passer « ${todo.texte} » en ${libelle(gauche)}`} onClick={() => deplacer(gauche)}>←</Button>
          )}
          {droite !== statut && (
            <Button size="sm" variant="ghost" aria-label={`Passer « ${todo.texte} » en ${libelle(droite)}`} onClick={() => deplacer(droite)}>→</Button>
          )}
        </div>
      )}
    </article>
  );
}
