import { useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { CartePlanning } from "../domain/cartes";
import { dureeDesCases, type Placement } from "../domain/grille";
import { planCreneauJournee, planDernierJour, planEtirer, planRetirerDate } from "../domain/planification";
import { DUREE_DEFAUT_H, HEURE_DEFAUT } from "../domain/taches";
import { usePlanningContexte } from "./contexte";
import { ControlesOrigine, SelectDuree } from "./ControlesCarte";
import { numeroDeLaCarte, positionCarte } from "./format";
import { BarreSav, LignesCarte, MontantCarte, PieceJointeCarte, TitreCarte } from "./InfosCarte";
import { MontantSousTraitant } from "./MontantSousTraitant";
import { Poignee } from "./Poignee";
import { ZoneContacts } from "./ZoneContacts";

interface Props {
  carte: CartePlanning;
  jour: string;
  placement: Placement;
  onGlisser: (carte: CartePlanning) => void;
}

const arreter = (e: { stopPropagation: () => void }) => e.stopPropagation();

/**
 * Une carte posée sur la colonne d'un jour, à sa hauteur
 * (`planningScheduledCardHTML`) : le jour du rendez-vous porte les réglages ;
 * les jours suivants d'une plage n'en portent qu'un rappel (« suite ») ; le
 * dernier jour son heure propre ; une journée supplémentaire son créneau.
 */
export function CartePosee({ carte, jour, placement, onGlisser }: Props) {
  const { peutPlanifier, ouvrirFiche, appliquer, couleurMetier, donnees, role } = usePlanningContexte();
  const [apercu, setApercu] = useState<number | null>(null);
  // Le clic qui suit le lâcher de la poignée ne doit pas ouvrir la fiche.
  const redimensionnee = useRef(false);
  const couleur = couleurMetier(carte.metier);
  const style: CSSProperties = { ...positionCarte(placement.indiceDebut, apercu ?? placement.cases), ...(couleur ? { borderRight: `5px solid ${couleur}` } : {}) };
  const avecTravaux = new Set(donnees.tachesAvecTravaux);
  const sousTraitant = role === "sous_traitant";
  const ouvrir = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (redimensionnee.current) {
      redimensionnee.current = false;
      return;
    }
    ouvrirFiche(carte, jour);
  };
  const poignee = (dernierJour: boolean, journeeSeule: boolean) => (
    <Poignee
      casesDepart={placement.cases}
      indiceDebut={placement.indiceDebut}
      horizontal={placement.variante === "origine"}
      journeeSeule={journeeSeule}
      onApercu={setApercu}
      onFin={(n, fin) => {
        redimensionnee.current = true;
        window.setTimeout(() => (redimensionnee.current = false), 0);
        if (journeeSeule) appliquer(carte, () => planCreneauJournee(carte, jour, { duree: dureeDesCases(placement.indiceDebut, n) }));
        else appliquer(carte, () => planEtirer(carte, { cases: n, indiceDebut: placement.indiceDebut, fin, dernierJour }));
      }}
    />
  );
  const cadre = (classes: string, contenu: ReactNode, supplement: CSSProperties = {}) => (
    <div role="group" aria-label={`${carte.bon.client_nom} ${numeroDeLaCarte(carte)}`.trim()} className={classes} draggable={false} onClick={ouvrir} style={{ ...style, ...supplement }}>
      {contenu}
    </div>
  );

  if (placement.variante === "suppl") {
    const journee = placement.journee;
    const libre = !!journee && !journee.fait;
    return cadre(
      `planning-card planning-card-scheduled planning-card-suppl ${carte.faite ? "planning-card-fait" : ""}`,
      <>
        {peutPlanifier && (
          <button type="button" className="planning-unschedule" onClick={(e) => (e.stopPropagation(), appliquer(carte, () => planRetirerDate(carte, jour, avecTravaux)))} title="Retirer cette date">
            ✕
          </button>
        )}
        <div className="planning-card-title">
          {carte.bon.client_nom}
          <span className="planning-suppl-badge" title="Date supplémentaire ajoutée pour ce même bon de commande">📅 Suppl.</span>
        </div>
        <div className="planning-card-sub">{numeroDeLaCarte(carte)}</div>
        {/* Une journée déjà pointée par le terrain raconte ce qui s'est passé : son horaire ne se réécrit plus d'ici. */}
        {libre && peutPlanifier && (
          <div className="planning-card-controls" onClick={arreter}>
            <input type="time" className="planning-time" aria-label="Heure de cette journée" value={journee.creneau?.heure ?? HEURE_DEFAUT} onChange={(e) => e.target.value && appliquer(carte, () => planCreneauJournee(carte, jour, { heure: e.target.value }))} />
            <SelectDuree valeur={journee.creneau?.duree ?? DUREE_DEFAUT_H} onChange={(d) => appliquer(carte, () => planCreneauJournee(carte, jour, { duree: d }))} />
          </div>
        )}
        <BarreSav carte={carte} />
        {libre && peutPlanifier && poignee(false, true)}
      </>
    );
  }

  if (placement.variante === "dernier" || placement.variante === "suite") {
    const dernier = placement.variante === "dernier";
    return cadre(
      "planning-card planning-card-scheduled planning-card-continuation",
      <>
        <TitreCarte carte={carte} />
        <div className="planning-card-sub">
          {numeroDeLaCarte(carte)} · {dernier ? "suite, dernier jour" : "suite"}
        </div>
        {dernier && peutPlanifier && (
          <input type="time" className="planning-time" aria-label="Heure de début ce jour-là" value={carte.rdv.heureDernierJour ?? HEURE_DEFAUT} onChange={(e) => e.target.value && appliquer(carte, () => planDernierJour(carte, { heure: e.target.value }))} onClick={arreter} title="Heure de début ce jour-là" />
        )}
        <BarreSav carte={carte} />
        {dernier && peutPlanifier && poignee(true, false)}
      </>,
      { cursor: "pointer" }
    );
  }

  return (
    <div
      role="group"
      aria-label={`${carte.bon.client_nom} ${numeroDeLaCarte(carte)}`.trim()}
      className={`planning-card planning-card-scheduled ${carte.faite ? "planning-card-fait" : ""}`}
      draggable={peutPlanifier && !carte.faite}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", carte.id);
        onGlisser(carte);
      }}
      onClick={ouvrir}
      style={style}
    >
      <ControlesOrigine carte={carte} partie="retirer" />
      <TitreCarte carte={carte} />
      <ZoneContacts carte={carte} lectureSeule />
      <LignesCarte carte={carte} avecPiece={false} />
      {sousTraitant ? (
        <>
          {carte.suppl.length > 0 && (
            <div className="planning-extra-dates">
              {carte.suppl.map((d) => (
                <span key={d.date} className="planning-extra-date-tag">
                  📅 {d.date.split("-").reverse().join("/")} {d.creneau?.heure ?? HEURE_DEFAUT}
                </span>
              ))}
            </div>
          )}
          <div className="planning-card-controls">
            <span className="planning-jour-heure" style={{ fontSize: "11px" }}>
              {carte.rdv.heurePlanifiee || "—"}
              {carte.rdv.dureeHeures ? ` · ${carte.rdv.dureeHeures}h` : ""}
            </span>
          </div>
        </>
      ) : (
        <ControlesOrigine carte={carte} partie="reglages" />
      )}
      <MontantCarte carte={carte} />
      <MontantSousTraitant carte={carte} />
      <PieceJointeCarte carte={carte} avecNom={false} />
      <BarreSav carte={carte} />
      <ControlesOrigine carte={carte} partie="avancer" />
      {peutPlanifier && !sousTraitant && poignee(false, false)}
    </div>
  );
}
