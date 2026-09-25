import { useEffect, useId, useRef, useState } from "react";
import { Link } from "react-router";
import { messageErreur } from "@/lib/erreurs";
import { afficherToast } from "@/lib/toast";
import { APERCU_NOTIFICATIONS, libelleBadge, type Notification } from "../domain/notifications";
import { useMarquerTraitees, useNotifications } from "../hooks/useNotifications";

/** La cloche de l'ancien écran (index.html l. 35) — son tracé, recopié tel quel. */
const TRACE_CLOCHE = '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>';

function Apercu({ notifs, fermer, deplier }: { notifs: Notification[]; fermer: () => void; deplier: () => void }) {
  return (
    <>
      {notifs.slice(0, APERCU_NOTIFICATIONS).map((n) => (
        <Link key={n.id} to={n.lien} onClick={fermer} className={n.urgent ? "notif-item is-urgent" : "notif-item"}>
          <span className="notif-item-icon" aria-hidden="true">{n.icone}</span>
          <span className="notif-item-texte">{n.texte}</span>
        </Link>
      ))}
      <button type="button" className="notif-see-all" onClick={deplier}>
        <span className="notif-see-all-plus">+</span> Liste des notifications à faire ({notifs.length})
      </button>
    </>
  );
}

/** La liste complète, à cocher : « fait » est mémorisé pour toute la société. */
function ListeACocher({ notifs, retour }: { notifs: Notification[]; retour: () => void }) {
  const [cochees, setCochees] = useState<ReadonlySet<string>>(new Set());
  const marquer = useMarquerTraitees();
  const basculer = (id: string) =>
    setCochees((c) => {
      const s = new Set(c);
      if (s.has(id)) s.delete(id);
      else s.add(id);
      return s;
    });
  const valider = () => {
    if (!cochees.size) return afficherToast("Cochez au moins une alerte.");
    const n = cochees.size;
    marquer.mutate([...cochees], {
      onSuccess: () => {
        setCochees(new Set());
        afficherToast(`${n} alerte(s) marquée(s) comme faite(s).`, "success");
      },
      onError: (e) => afficherToast(messageErreur(e)),
    });
  };
  return (
    <>
      <div className="notif-panel-header">
        <span>
          {notifs.length} alerte{notifs.length > 1 ? "s" : ""}
        </span>
        <button type="button" className="btn small ghost" onClick={retour}>
          ← Retour
        </button>
      </div>
      <div className="notif-list-check">
        {notifs.map((n) => (
          <label key={n.id} className={n.urgent ? "notif-item-check is-urgent" : "notif-item-check"}>
            <input type="checkbox" className="notif-checkbox" checked={cochees.has(n.id)} onChange={() => basculer(n.id)} />
            <span className="notif-item-icon" aria-hidden="true">{n.icone}</span>
            <span className="notif-item-texte">{n.texte}</span>
          </label>
        ))}
      </div>
      <div className="notif-panel-footer">
        <button type="button" className="btn small primary" onClick={valider} disabled={marquer.isPending}>
          ✓ Marquer comme fait
        </button>
      </div>
    </>
  );
}

/**
 * La cloche (TRV-09) : un badge qui compte les alertes, clignotant s'il en est
 * d'urgentes ; un panneau des cinq premières, qui se déplie en liste à cocher.
 * Même HTML que l'ancien (`.notif-wrap`, `renderNotifPanelContent`).
 */
export function CentreNotifications({ place = "Desktop" }: { place?: "Desktop" | "Mobile" }) {
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
      className="notif-wrap"
      onKeyDown={(e) => {
        if (e.key === "Escape") fermer();
      }}
    >
      <button
        type="button"
        className="notif-bell-btn"
        title="Notifications"
        aria-label={`Notifications : ${actives.length} alerte${actives.length > 1 ? "s" : ""}${urgentes ? ", dont des urgentes" : ""}`}
        aria-expanded={ouvert}
        aria-controls={idPanneau}
        onClick={() => {
          setDeplie(false);
          setOuvert((o) => !o);
        }}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" dangerouslySetInnerHTML={{ __html: TRACE_CLOCHE }} />
        <span className={urgentes ? "notif-badge is-urgent" : "notif-badge"} id={`notifBadge${place}`} aria-hidden="true" style={{ display: actives.length ? "flex" : "none" }}>
          {libelleBadge(actives.length)}
        </span>
      </button>
      <div id={idPanneau} className="notif-panel" role="region" aria-label="Notifications" style={{ display: ouvert ? "block" : "none" }}>
        {ouvert && (
          <>
            {sourcesIllisibles.length > 0 && (
              <div className="notif-panel-header">Alertes incomplètes : {sourcesIllisibles.join(", ")} n'ont pas pu être lus.</div>
            )}
            {!actives.length ? (
              <div className="notif-empty">🎉 Aucune alerte en cours</div>
            ) : deplie ? (
              <ListeACocher notifs={actives} retour={() => setDeplie(false)} />
            ) : (
              <Apercu notifs={actives} fermer={fermer} deplier={() => setDeplie(true)} />
            )}
          </>
        )}
      </div>
    </div>
  );
}
