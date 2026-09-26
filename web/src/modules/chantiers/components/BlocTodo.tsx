import { useState, type DragEvent, type KeyboardEvent } from "react";
import { Erreur } from "@/components/etats/Etats";
import { formatDateFr, todayISO } from "@/lib/dates";
import { messageErreur } from "@/lib/erreurs";
import { afficherToast } from "@/lib/toast";
import type { Salarie } from "../api/achats";
import type { Todo } from "../api/todos";
import { estEnRetard, progressionTodo, statutTodo, statutVoisin, type StatutTodo } from "../domain/todo";
import { useDroitsChantier } from "../hooks/useDroitsChantier";
import { useAjouterTodo, useChangerStatutTodo, useSalaries, useSupprimerTodo, useTodos } from "../hooks/useFiche";
import { DetailTodo } from "./DetailTodo";

const TYPE_GLISSE = "application/x-erp-todo";
const signaler = (err: unknown) => afficherToast(messageErreur(err));

/** Les colonnes de l'ancien kanban, pictogrammes compris. */
const COLONNES: readonly { code: StatutTodo; libelle: string; icone: string }[] = [
  { code: "a_faire", libelle: "À faire", icone: "📋" },
  { code: "en_cours", libelle: "En cours", icone: "🔧" },
  { code: "fait", libelle: "Fait", icone: "✅" },
];

/**
 * « 🗂️ To do liste » (`chantierTodoHTML`, CHA-14) : progression, ajout, kanban
 * À faire / En cours / Fait où l'on glisse les cartes. Au clavier, une carte
 * a le focus et ← → la changent de colonne ; Entrée ouvre son détail.
 */
export function BlocTodo({ chantierId }: { chantierId: string }) {
  const todos = useTodos(chantierId);
  const salaries = useSalaries();
  const droits = useDroitsChantier();
  const ajouter = useAjouterTodo(chantierId);
  const changer = useChangerStatutTodo(chantierId);
  const supprimer = useSupprimerTodo(chantierId);
  const [texte, setTexte] = useState("");
  const [ouvert, setOuvert] = useState<Todo | null>(null);
  const points = todos.data ?? [];
  const p = progressionTodo(points);
  const aujourdhui = todayISO();

  function ajouterPoint() {
    const t = texte.trim();
    if (!t) return;
    const position = points.reduce((m, x) => Math.max(m, x.position), -1) + 1;
    ajouter.mutate({ texte: t, position }, { onSuccess: () => setTexte(""), onError: signaler });
  }

  function deposer(e: DragEvent, statut: StatutTodo) {
    e.preventDefault();
    const id = e.dataTransfer.getData(TYPE_GLISSE);
    const point = points.find((x) => x.id === id);
    // Un glisser venu d'un autre chantier ou d'ailleurs n'a pas d'identifiant connu ici : ignoré.
    if (point && statutTodo(point) !== statut) changer.mutate({ id, statut }, { onError: signaler });
  }

  function clavier(e: KeyboardEvent, t: Todo) {
    if (e.target !== e.currentTarget) return;
    if (e.key === "Enter") return setOuvert(t);
    const sens = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!sens || !droits.terrain) return;
    e.preventDefault();
    const statut = statutTodo(t);
    const cible = statutVoisin(statut, sens);
    if (cible !== statut) changer.mutate({ id: t.id, statut: cible }, { onError: signaler });
  }

  return (
    <div className="chantier-section" style={{ gridColumn: "1/-1" }}>
      <div className="section-title" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span>🗂️ To do liste</span>
        {p.total > 0 && (
          <span className="todo-progress-label">
            {p.faits}/{p.total} {p.pourcentage === 100 ? "🎉 Tout est fait !" : "terminées"}
          </span>
        )}
      </div>
      {todos.isError && <Erreur erreur={todos.error} reessayer={() => void todos.refetch()} />}
      {p.total > 0 && (
        <div className="todo-progress-wrap">
          <div className="todo-progress-bar" role="progressbar" aria-label="Avancement de la to-do" aria-valuenow={p.pourcentage} aria-valuemin={0} aria-valuemax={100}>
            <div className="todo-progress-fill" style={{ width: `${p.pourcentage}%` }} />
          </div>
        </div>
      )}
      {droits.terrain && (
        <div className="todo-add-row">
          <input
            type="text"
            aria-label="Nouvelle tâche"
            placeholder="Ajouter une tâche…"
            value={texte}
            onChange={(e) => setTexte(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") ajouterPoint();
            }}
          />
          <button type="button" className="btn small primary" disabled={ajouter.isPending} onClick={ajouterPoint}>
            + Ajouter
          </button>
        </div>
      )}
      <div className="todo-kanban">
        {COLONNES.map((col) => {
          const items = points.filter((t) => statutTodo(t) === col.code);
          return (
            <div
              key={col.code}
              className="todo-kanban-col"
              role="group"
              aria-label={col.libelle}
              onDragOver={(e) => {
                if (!droits.terrain) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
              }}
              onDrop={(e) => droits.terrain && deposer(e, col.code)}
            >
              <div className={`todo-kanban-col-header todo-kanban-col-${col.code}`}>
                <span>
                  {col.icone} {col.libelle}
                </span>
                <span className="todo-kanban-count">{items.length}</span>
              </div>
              <div className="todo-kanban-col-body">
                {items.length ? (
                  items.map((t) => (
                    <Carte
                      key={t.id}
                      t={t}
                      enRetard={estEnRetard(t, aujourdhui)}
                      salarie={salaries.data?.find((s) => s.id === t.salarie_id)}
                      modifiable={droits.terrain}
                      ouvrir={() => setOuvert(t)}
                      clavier={(e) => clavier(e, t)}
                      retirer={() => supprimer.mutate(t.id, { onError: signaler })}
                    />
                  ))
                ) : (
                  <div className="todo-kanban-empty">Glissez une tâche ici</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {ouvert && <DetailTodo key={ouvert.id} chantierId={chantierId} todo={ouvert} salaries={salaries.data ?? []} modifiable={droits.terrain} fermer={() => setOuvert(null)} />}
    </div>
  );
}

interface PropsCarte {
  t: Todo;
  enRetard: boolean;
  salarie: Salarie | undefined;
  modifiable: boolean;
  ouvrir: () => void;
  clavier: (e: KeyboardEvent) => void;
  retirer: () => void;
}

/** Une carte du kanban (`todo-kanban-card`) : texte, date prévue (rouge si en retard), initiales du salarié, ✕. */
function Carte({ t, enRetard, salarie, modifiable, ouvrir, clavier, retirer }: PropsCarte) {
  const initiales = salarie ? `${(salarie.prenom || "?")[0] ?? "?"}${(salarie.nom || "?")[0] ?? "?"}` : "";
  return (
    <div
      className="todo-kanban-card"
      role="button"
      tabIndex={0}
      draggable={modifiable}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData(TYPE_GLISSE, t.id);
      }}
      onClick={ouvrir}
      onKeyDown={clavier}
    >
      <span className="todo-kanban-card-text">{t.texte}</span>
      {(t.date_prevue || salarie) && (
        <div className="todo-kanban-card-meta">
          {t.date_prevue && <span className={`todo-meta-badge${enRetard ? " is-late" : ""}`}>📅 {formatDateFr(t.date_prevue)}</span>}
          {salarie && (
            <span className="todo-meta-badge" title={`${salarie.prenom ?? ""} ${salarie.nom ?? ""}`}>
              👤 {initiales}
            </span>
          )}
        </div>
      )}
      {modifiable && (
        <button
          type="button"
          className="todo-remove"
          title="Supprimer"
          aria-label={`Supprimer « ${t.texte} »`}
          onClick={(e) => {
            e.stopPropagation();
            retirer();
          }}
        >
          ✕
        </button>
      )}
    </div>
  );
}
