import { formatDateFr } from "@/lib/dates";
import type { CartePlanning } from "../domain/cartes";
import { planAffectation, planAvancer, planCreneau, planDateFin, planDeplanifier, planRetirerDate, questionDeplanifier, type AffectationChoisie } from "../domain/planification";
import { DUREE_DEFAUT_H, HEURE_DEFAUT } from "../domain/taches";
import { usePlanningContexte } from "./contexte";
import { DUREES } from "./format";

const arreter = (e: { stopPropagation: () => void }) => e.stopPropagation();

/** La durée d'un créneau (`.planning-duree`), de 1 à 8 h. */
export function SelectDuree({ valeur, onChange, libelle = "Durée" }: { valeur: number; onChange: (d: number) => void; libelle?: string }) {
  return (
    <select className="planning-duree" aria-label={libelle} title="Durée" value={valeur} onClick={arreter} onChange={(e) => onChange(Number(e.target.value))}>
      {DUREES.map((n) => (
        <option key={n} value={n}>{n} h</option>
      ))}
    </select>
  );
}

/** Équipe ou sous-traitant selon la vue ; « — Non attribué — » retire l'affectation. */
function SelectAffecte({ carte }: { carte: CartePlanning }) {
  const { donnees, affectation, appliquer } = usePlanningContexte();
  const st = affectation === "sous_traitant";
  const liste = st ? donnees.sousTraitants : donnees.equipes;
  const choisir = (id: string) => {
    const a: AffectationChoisie = st ? { type: "sous_traitant", sousTraitant: donnees.sousTraitants.find((s) => s.id === id) ?? null } : { type: "equipe", equipe: donnees.equipes.find((e) => e.id === id) ?? null };
    appliquer(carte, () => planAffectation(carte, a));
  };
  return (
    <select className="planning-technicien-select" value={(st ? carte.sousTraitantId : carte.equipeId) ?? ""} onClick={arreter} onChange={(e) => choisir(e.target.value)} title={st ? "Sous-traitant assigné" : "Équipe assignée"} aria-label={st ? "Sous-traitant assigné" : "Équipe assignée"}>
      <option value="">— Non attribué —</option>
      {liste.map((x) => (
        <option key={x.id} value={x.id}>{x.nom}</option>
      ))}
    </select>
  );
}

/**
 * Les réglages d'une carte posée, au jour de son rendez-vous (PLN-05), dans
 * l'ordre de l'ancienne carte : ✕ en haut, puis journées en plus, heure et
 * durée, équipe, date de fin — et ← en bas à gauche. Rien pour qui ne peut pas
 * planifier (D-ECR-PLN-03), ni pour le sous-traitant.
 */
export function ControlesOrigine({ carte, partie }: { carte: CartePlanning; partie: "retirer" | "reglages" | "avancer" }) {
  const { appliquer, demanderDate, donnees, peutPlanifier, role } = usePlanningContexte();
  if (!peutPlanifier || role === "sous_traitant") return null;
  const avecTravaux = new Set(donnees.tachesAvecTravaux);

  if (partie === "retirer") {
    const deplanifier = (e: React.MouseEvent) => {
      e.stopPropagation();
      const question = questionDeplanifier(carte);
      if (question && !window.confirm(question)) return;
      appliquer(carte, () => planDeplanifier(carte, avecTravaux));
    };
    return (
      <button type="button" className="planning-unschedule" onClick={deplanifier} title="Retirer du planning">
        ✕
      </button>
    );
  }

  if (partie === "avancer") {
    return (
      <button type="button" className="planning-shift-left" onClick={(e) => (e.stopPropagation(), appliquer(carte, () => planAvancer(carte, avecTravaux), carte.rdv.datePlanifieeFin && carte.rdv.datePlanifieeFin !== carte.rdv.datePlanifiee ? undefined : 'Chantier renvoyé dans "Non planifiés".'))} title="Annuler l'étirement (puis déplanifier au clic suivant)">
        ←
      </button>
    );
  }

  return (
    <>
      <div className="planning-extra-dates" onClick={arreter}>
        {carte.suppl.map((d) => (
          <span key={d.date} className="planning-extra-date-tag">
            📅 {formatDateFr(d.date)} {d.creneau?.heure ?? HEURE_DEFAUT} ({d.creneau?.duree ?? DUREE_DEFAUT_H}h){" "}
            <button type="button" onClick={() => appliquer(carte, () => planRetirerDate(carte, d.date, avecTravaux))} title="Retirer">
              ✕
            </button>
          </span>
        ))}
        <button type="button" className="btn small ghost" onClick={(e) => (e.stopPropagation(), demanderDate(carte))} title="Planifier ce même bon de commande sur une autre date, en plus">
          + Autre date
        </button>
      </div>
      <div className="planning-card-controls">
        <input type="time" className="planning-time" aria-label="Heure de début" value={carte.rdv.heurePlanifiee ?? ""} onChange={(e) => e.target.value && appliquer(carte, () => planCreneau(carte, { heure: e.target.value }))} onClick={arreter} />
        <SelectDuree valeur={carte.rdv.dureeHeures || DUREE_DEFAUT_H} onChange={(d) => appliquer(carte, () => planCreneau(carte, { duree: d }))} />
      </div>
      <SelectAffecte carte={carte} />
      <input
        type="date"
        className="planning-enddate"
        aria-label="Étirer jusqu'à cette date"
        value={carte.rdv.datePlanifieeFin ?? carte.rdv.datePlanifiee ?? ""}
        min={carte.rdv.datePlanifiee ?? undefined}
        onChange={(e) => appliquer(carte, () => planDateFin(carte, e.target.value))}
        onClick={arreter}
        title="Étirer jusqu'à cette date"
      />
    </>
  );
}
