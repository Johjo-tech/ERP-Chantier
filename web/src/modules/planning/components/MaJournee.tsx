import { useState } from "react";
import { formatDateFr, todayISO } from "@/lib/dates";
import { ajouterJours } from "../domain/calendrier";
import { tacheDuJour } from "../domain/cartes";
import { mesCartesDuJour, tachesAReprendre } from "../domain/filtres";
import { LIBELLES_STATUT, statutDe } from "../domain/taches";
import { usePlanningContexte } from "./contexte";
import { adresseDuLieu, libelleDuMetier, numeroDeLaCarte } from "./format";

/**
 * L'écran du terrain (D-PLN-19, ajout de web/) : les interventions du jour de
 * MON équipe, dans l'ordre des heures, et ce que le conducteur m'a renvoyé.
 * Un appui ouvre la fiche. Aucun prix. Dans les habits de l'ancien écran
 * (`.card`, `.section-title`, `.empty`), faute d'équivalent à reprendre.
 */
export function MaJournee() {
  const { cartes, donnees, ouvrirFiche } = usePlanningContexte();
  const [jour, setJour] = useState(todayISO());
  const { monEquipeId, monSousTraitantId } = donnees;
  const duJour = mesCartesDuJour(cartes, jour, monEquipeId, monSousTraitantId);
  const aReprendre = tachesAReprendre(cartes, monEquipeId, monSousTraitantId);

  if (!monEquipeId && !monSousTraitantId) {
    return <div className="empty">Votre compte n'est rattaché à aucune équipe ni entreprise sous-traitante : demandez au conducteur de vous affecter pour voir vos interventions.</div>;
  }
  return (
    <section aria-label="Ma journée">
      <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap", marginBottom: "12px" }}>
        <button type="button" className="btn small" aria-label="Jour précédent" onClick={() => setJour(ajouterJours(jour, -1))}>←</button>
        <input type="date" aria-label="Jour" style={{ width: "auto" }} value={jour} onChange={(e) => e.target.value && setJour(e.target.value)} />
        <button type="button" className="btn small" aria-label="Jour suivant" onClick={() => setJour(ajouterJours(jour, 1))}>→</button>
        {jour !== todayISO() && <button type="button" className="btn small ghost" onClick={() => setJour(todayISO())}>Aujourd'hui</button>}
      </div>
      <div className="section-title">Mes interventions du {formatDateFr(jour)} ({duJour.length})</div>
      {!duJour.length && <div className="empty">Aucune intervention prévue ce jour-là.</div>}
      {duJour.map((c) => {
        const t = tacheDuJour(c, c.metier, jour);
        const heure = c.rdv.datePlanifiee === jour ? c.rdv.heurePlanifiee : c.suppl.find((d) => d.date === jour)?.creneau?.heure;
        return (
          <button key={c.id} type="button" className="card" style={{ display: "block", width: "100%", textAlign: "left", cursor: "pointer", font: "inherit" }} onClick={() => ouvrirFiche(c, jour)}>
            <div className="card-title">{heure ?? "—"} · {c.bon.client_nom}</div>
            <div className="card-sub">{numeroDeLaCarte(c)}{c.metier ? ` · 🔧 ${libelleDuMetier(c.metier)}` : ""}</div>
            <div className="card-sub">📍 {adresseDuLieu(c)}</div>
            <div className="card-sub">{t ? LIBELLES_STATUT[statutDe(t.statut)] : "Fiche à préparer"}</div>
          </button>
        );
      })}
      {aReprendre.length > 0 && (
        <>
          <div className="section-title" style={{ color: "var(--danger)" }}>À reprendre ({aReprendre.length})</div>
          {aReprendre.map(({ carte, tache }) => (
            <button key={tache.id} type="button" className="card" style={{ display: "block", width: "100%", textAlign: "left", cursor: "pointer", font: "inherit" }} onClick={() => ouvrirFiche(carte, tache.date_tache)}>
              <div className="card-title">{carte.bon.client_nom} — {numeroDeLaCarte(carte)}</div>
              <div className="card-sub" style={{ color: "var(--danger)" }}>↩ {tache.refus_motif ?? "Refusée"}</div>
            </button>
          ))}
        </>
      )}
    </section>
  );
}
