import { todayISO } from "@/lib/dates";
import { useOptionsFeries } from "@/modules/societes/hooks/useFeries";
import { estFerie, estNonOuvre, HEURE_PAUSE, HEURES_PLANNING, joursDeLaSemaine, libelleSemaine, lundiDe, semainesAffichees, type JourDeSemaine } from "../domain/calendrier";
import type { CartePlanning } from "../domain/cartes";
import { cartesDuJour } from "../domain/filtres";
import { heureDeLaCase, placementDuJour } from "../domain/grille";
import { usePlanningContexte } from "./contexte";
import { CartePosee } from "./CartePosee";
import { RANGEE } from "./format";

interface Props {
  cartes: CartePlanning[];
  premierLundi: string;
  glissee: CartePlanning | null;
  onGlisser: (c: CartePlanning | null) => void;
}

const INDICE_PAUSE = (HEURES_PLANNING as readonly number[]).indexOf(HEURE_PAUSE);
const deuxChiffres = (h: number) => String(h).padStart(2, "0");

function ColonneJour({ jour, cartes, glissee, onGlisser }: { jour: JourDeSemaine; cartes: CartePlanning[]; glissee: CartePlanning | null; onGlisser: (c: CartePlanning | null) => void }) {
  const { peutPlanifier, poser } = usePlanningContexte();
  const feries = useOptionsFeries();
  const ferie = estFerie(jour.iso, feries);
  return (
    <div className={`planning-daycol ${estNonOuvre(jour.iso, feries) ? "is-non-ouvre" : ""}`} data-iso={jour.iso}>
      <div className={`planning-day-head ${jour.iso === todayISO() ? "is-today" : ""}`}>
        {jour.libelle}
        <br />
        <b>
          {jour.numero} {jour.mois}
        </b>
        {ferie && (
          <>
            <br />
            <span style={{ fontSize: "9.5px" }}>Férié</span>
          </>
        )}
      </div>
      <div className="planning-day-grid" style={{ height: `calc(${HEURES_PLANNING.length} * ${RANGEE})` }}>
        {HEURES_PLANNING.map((h, i) => (
          <div
            key={h}
            className={`planning-hour-row ${h === HEURE_PAUSE ? "is-pause" : ""}`}
            style={{ top: `calc(${i} * ${RANGEE})`, height: `calc(${RANGEE})` }}
            onDragOver={(e) => {
              if (!peutPlanifier) return;
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              e.currentTarget.classList.add("drag-over");
            }}
            onDragLeave={(e) => e.currentTarget.classList.remove("drag-over")}
            onDrop={(e) => {
              e.preventDefault();
              e.currentTarget.classList.remove("drag-over");
              const id = e.dataTransfer.getData("text/plain");
              const carte = glissee?.id === id || !id ? glissee : (cartes.find((c) => c.id === id) ?? glissee);
              onGlisser(null);
              if (carte) poser(carte, jour.iso, heureDeLaCase(i));
            }}
          />
        ))}
        {cartesDuJour(cartes, jour.iso).map((c) => (
          <CartePosee key={`${c.id}|${jour.iso}`} carte={c} jour={jour.iso} placement={placementDuJour(c, jour.iso)} onGlisser={onGlisser} />
        ))}
        {INDICE_PAUSE >= 0 && <div className="planning-pause-overlay" style={{ top: `calc(${INDICE_PAUSE} * ${RANGEE})`, height: `calc(${RANGEE})` }} />}
      </div>
    </div>
  );
}

/** Une semaine (`renderWeekBlockHTML`) : colonne des heures, puis un jour par colonne. */
function Semaine({ lundi, cartes, glissee, onGlisser }: { lundi: string } & Omit<Props, "premierLundi">) {
  const cetteSemaine = lundi === lundiDe(todayISO());
  return (
    <div className="planning-week-block" data-week={lundi}>
      <div className={`planning-week-label ${cetteSemaine ? "is-current-week" : ""}`}>
        {libelleSemaine(lundi)}
        {cetteSemaine ? " · cette semaine" : ""}
      </div>
      <div className="planning-calendar">
        <div className="planning-hourcol">
          <div className="planning-hourcol-spacer" />
          {HEURES_PLANNING.map((h) => (
            <div key={h} className={`planning-hour-tick ${h === HEURE_PAUSE ? "is-pause" : ""}`} style={{ height: `calc(${RANGEE})` }}>
              {deuxChiffres(h)}:00
            </div>
          ))}
          <div className="planning-hour-tick" style={{ height: 0, borderBottom: "none", paddingTop: 0 }}>
            17:00
          </div>
        </div>
        {joursDeLaSemaine(lundi).map((j) => (
          <ColonneJour key={j.iso} jour={j} cartes={cartes} glissee={glissee} onGlisser={onGlisser} />
        ))}
      </div>
    </div>
  );
}

/** Six semaines de grille, heures 8-16 avec la pause de midi, week-ends et fériés grisés (PLN-02). */
export function Calendrier({ cartes, premierLundi, glissee, onGlisser }: Props) {
  return (
    <div className="planning-week">
      <div className="planning-scroll">
        {semainesAffichees(premierLundi).map((lundi) => (
          <Semaine key={lundi} lundi={lundi} cartes={cartes} glissee={glissee} onGlisser={onGlisser} />
        ))}
      </div>
    </div>
  );
}
