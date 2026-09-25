import { useState, type DragEvent, type FormEvent } from "react";
import { Chargement, Erreur } from "@/components/etats/Etats";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { todayISO } from "@/lib/dates";
import { messageErreur } from "@/lib/erreurs";
import type { Todo } from "../api/todos";
import { progressionTodo, statutTodo, STATUTS_TODO, type StatutTodo } from "../domain/todo";
import { useDroitsChantier } from "../hooks/useDroitsChantier";
import { useAjouterTodo, useChangerStatutTodo, useSalaries, useTodos } from "../hooks/useFiche";
import { CarteTodo } from "./CarteTodo";
import { DetailTodo } from "./DetailTodo";

const TYPE_GLISSE = "application/x-erp-todo";

/**
 * La to-do du chantier (CHA-14) : kanban À faire / En cours / Fait, glisser-
 * déposer entre colonnes — et, pour le clavier, des boutons ← / → sur chaque
 * carte —, barre de progression, détail d'un point (texte, date prévue,
 * salarié, notes), retard signalé.
 */
export function BlocTodo({ chantierId }: { chantierId: string }) {
  const todos = useTodos(chantierId);
  const salaries = useSalaries();
  const droits = useDroitsChantier();
  const ajouter = useAjouterTodo(chantierId);
  const changer = useChangerStatutTodo(chantierId);
  const [texte, setTexte] = useState("");
  const [ouvert, setOuvert] = useState<Todo | null>(null);

  if (todos.isPending) return <Chargement libelle="Chargement de la to-do…" />;
  if (todos.isError) return <Erreur erreur={todos.error} reessayer={() => void todos.refetch()} />;
  const points = todos.data;
  const p = progressionTodo(points);
  const aujourdhui = todayISO();

  function soumettre(e: FormEvent) {
    e.preventDefault();
    const t = texte.trim();
    if (!t) return;
    const position = points.reduce((m, x) => Math.max(m, x.position), -1) + 1;
    ajouter.mutate({ texte: t, position }, { onSuccess: () => setTexte("") });
  }

  function deposer(e: DragEvent, statut: StatutTodo) {
    e.preventDefault();
    const id = e.dataTransfer.getData(TYPE_GLISSE);
    const point = points.find((x) => x.id === id);
    // Un glisser venu d'un autre chantier ou d'ailleurs n'a pas d'identifiant connu ici : ignoré.
    if (point && statutTodo(point) !== statut) changer.mutate({ id, statut });
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>To-do</CardTitle>
        {p.total > 0 && <span className="text-sm text-muted-foreground">{p.faits}/{p.total} {p.pourcentage === 100 ? "— tout est fait !" : "terminées"}</span>}
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {p.total > 0 && (
          <div className="h-2 w-full rounded bg-muted" role="progressbar" aria-label="Avancement de la to-do" aria-valuenow={p.pourcentage} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full rounded bg-success" style={{ width: `${p.pourcentage}%` }} />
          </div>
        )}
        {droits.terrain && (
          <form onSubmit={soumettre} className="flex gap-2">
            <label htmlFor={`todo-${chantierId}`} className="sr-only">Nouvelle tâche</label>
            <Input id={`todo-${chantierId}`} placeholder="Ajouter une tâche…" value={texte} onChange={(e) => setTexte(e.target.value)} />
            <Button type="submit" size="sm" disabled={ajouter.isPending || !texte.trim()}>+ Ajouter</Button>
          </form>
        )}
        {(ajouter.isError || changer.isError) && <Alert variant="erreur">{messageErreur(ajouter.error ?? changer.error)}</Alert>}
        <div className="grid gap-3 md:grid-cols-3">
          {STATUTS_TODO.map((col) => {
            const items = points.filter((t) => statutTodo(t) === col.code);
            return (
              <section
                key={col.code}
                aria-label={col.libelle}
                className="flex min-h-24 flex-col gap-2 rounded-md bg-muted/50 p-2"
                onDragOver={(e) => droits.terrain && e.preventDefault()}
                onDrop={(e) => droits.terrain && deposer(e, col.code)}
              >
                <h3 className="flex justify-between text-sm font-semibold">
                  {col.libelle} <span className="text-muted-foreground">{items.length}</span>
                </h3>
                {items.length === 0 && <p className="text-xs text-muted-foreground">{droits.terrain ? "Glissez une tâche ici" : "Rien ici"}</p>}
                {items.map((t) => (
                  <CarteTodo
                    key={t.id}
                    todo={t}
                    aujourdhui={aujourdhui}
                    salarie={salaries.data?.find((s) => s.id === t.salarie_id)}
                    modifiable={droits.terrain}
                    typeGlisse={TYPE_GLISSE}
                    deplacer={(statut) => changer.mutate({ id: t.id, statut })}
                    ouvrir={() => setOuvert(t)}
                  />
                ))}
              </section>
            );
          })}
        </div>
        {ouvert && <DetailTodo key={ouvert.id} chantierId={chantierId} todo={ouvert} salaries={salaries.data ?? []} modifiable={droits.terrain} fermer={() => setOuvert(null)} />}
      </CardContent>
    </Card>
  );
}
