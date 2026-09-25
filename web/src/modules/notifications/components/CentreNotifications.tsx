import { useEffect, useId, useRef, useState } from "react";
import { Link } from "react-router";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { messageErreur } from "@/lib/erreurs";
import { cn } from "@/lib/utils";
import { APERCU_NOTIFICATIONS, libelleBadge, type Notification } from "../domain/notifications";
import { useMarquerTraitees, useNotifications } from "../hooks/useNotifications";

function Apercu({ notifs, fermer, deplier }: { notifs: Notification[]; fermer: () => void; deplier: () => void }) {
  return (
    <>
      <ul className="flex flex-col">
        {notifs.slice(0, APERCU_NOTIFICATIONS).map((n) => (
          <li key={n.id}>
            <Link to={n.lien} onClick={fermer} className={cn("flex gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted", n.urgent && "font-medium text-destructive")}>
              <span aria-hidden="true">{n.icone}</span>
              <span>{n.texte}</span>
            </Link>
          </li>
        ))}
      </ul>
      <Button variant="ghost" size="sm" className="justify-start" onClick={deplier}>
        + Liste des notifications à faire ({notifs.length})
      </Button>
    </>
  );
}

/** La liste complète, à cocher : « fait » est mémorisé pour toute la société. */
function ListeACocher({ notifs, retour }: { notifs: Notification[]; retour: () => void }) {
  const [cochees, setCochees] = useState<ReadonlySet<string>>(new Set());
  const [message, setMessage] = useState<string | null>(null);
  const marquer = useMarquerTraitees();
  const basculer = (id: string) =>
    setCochees((c) => {
      const s = new Set(c);
      if (s.has(id)) s.delete(id);
      else s.add(id);
      return s;
    });
  const valider = () => {
    if (!cochees.size) return setMessage("Cochez au moins une alerte.");
    const n = cochees.size;
    marquer.mutate([...cochees], { onSuccess: () => { setCochees(new Set()); setMessage(`${n} alerte(s) marquée(s) comme faite(s).`); } });
  };
  return (
    <>
      <div className="flex items-center justify-between px-2 text-sm font-medium">
        <span>{notifs.length} alerte{notifs.length > 1 ? "s" : ""}</span>
        <Button variant="ghost" size="sm" onClick={retour}>← Retour</Button>
      </div>
      <ul className="flex max-h-80 flex-col overflow-y-auto">
        {notifs.map((n) => (
          <li key={n.id}>
            <label className={cn("flex cursor-pointer items-start gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted", n.urgent && "text-destructive")}>
              <input type="checkbox" className="mt-1" checked={cochees.has(n.id)} onChange={() => basculer(n.id)} />
              <span aria-hidden="true">{n.icone}</span>
              <span>{n.texte}</span>
            </label>
          </li>
        ))}
      </ul>
      {message && <p role="status" className="px-2 text-xs text-muted-foreground">{message}</p>}
      {marquer.isError && <Alert variant="erreur">{messageErreur(marquer.error)}</Alert>}
      <Button size="sm" onClick={valider} disabled={marquer.isPending}>✓ Marquer comme fait</Button>
    </>
  );
}

/**
 * La cloche (TRV-09) : un badge qui compte les alertes, rouge s'il en est
 * d'urgentes ; un panneau des cinq premières, qui se déplie en liste à cocher.
 */
export function CentreNotifications() {
  const { actives, sourcesIllisibles } = useNotifications();
  const [ouvert, setOuvert] = useState(false);
  const [deplie, setDeplie] = useState(false);
  const zone = useRef<HTMLDivElement>(null);
  const idPanneau = useId();
  const urgentes = actives.some((n) => n.urgent);

  useEffect(() => {
    if (!ouvert) return;
    const dehors = (e: MouseEvent) => {
      if (zone.current && !zone.current.contains(e.target as Node)) setOuvert(false);
    };
    document.addEventListener("mousedown", dehors);
    return () => document.removeEventListener("mousedown", dehors);
  }, [ouvert]);

  const fermer = () => setOuvert(false);
  return (
    <div
      ref={zone}
      className="relative"
      onKeyDown={(e) => {
        if (e.key === "Escape") fermer();
      }}
    >
      <Button
        variant="ghost"
        size="sm"
        aria-label={`Notifications : ${actives.length} alerte${actives.length > 1 ? "s" : ""}${urgentes ? ", dont des urgentes" : ""}`}
        aria-expanded={ouvert}
        aria-controls={idPanneau}
        onClick={() => {
          setDeplie(false);
          setOuvert((o) => !o);
        }}
      >
        <span aria-hidden="true">🔔</span>
        {actives.length > 0 && (
          <span aria-hidden="true" className={cn("ml-1 rounded-full px-1.5 text-xs font-semibold text-white", urgentes ? "bg-destructive" : "bg-primary")}>
            {libelleBadge(actives.length)}
          </span>
        )}
      </Button>
      {ouvert && (
        <div id={idPanneau} role="region" aria-label="Notifications" className="absolute right-0 z-30 mt-1 flex w-80 max-w-[90vw] flex-col gap-1 rounded-md border border-border bg-card p-2 shadow-lg">
          {sourcesIllisibles.length > 0 && (
            <Alert variant="info" className="text-xs">Alertes incomplètes : {sourcesIllisibles.join(", ")} n'ont pas pu être lus.</Alert>
          )}
          {!actives.length ? (
            <p className="p-3 text-center text-sm text-muted-foreground">🎉 Aucune alerte en cours</p>
          ) : deplie ? (
            <ListeACocher notifs={actives} retour={() => setDeplie(false)} />
          ) : (
            <Apercu notifs={actives} fermer={fermer} deplier={() => setDeplie(true)} />
          )}
        </div>
      )}
    </div>
  );
}
