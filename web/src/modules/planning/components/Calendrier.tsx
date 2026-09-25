import { useState } from "react";
import { todayISO } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { estFerie, estNonOuvre, HEURE_PAUSE, HEURES_PLANNING, joursDeLaSemaine, libelleSemaine, lundiDe, semainesAffichees, type JourDeSemaine } from "../domain/calendrier";
import type { CartePlanning } from "../domain/cartes";
import { cartesDuJour } from "../domain/filtres";
import { heureDeLaCase, placementDuJour } from "../domain/grille";
import { usePlanningContexte } from "./contexte";
import { CartePosee } from "./CartePosee";
import { HAUTEUR_CASE } from "./Poignee";

interface Props {
  cartes: CartePlanning[];
  premierLundi: string;
  glissee: CartePlanning | null;
  onGlisser: (c: CartePlanning | null) => void;
}

function ColonneJour({ jour, cartes, glissee, onGlisser }: { jour: JourDeSemaine; cartes: CartePlanning[]; glissee: CartePlanning | null; onGlisser: (c: CartePlanning | null) => void }) {
  const { peutPlanifier, poser } = usePlanningContexte();
  const [survol, setSurvol] = useState<number | null>(null);
  const duJour = cartesDuJour(cartes, jour.iso);
  const ferie = estFerie(jour.iso);
  return (
    <div data-jour={jour.iso} className={cn("min-w-32 flex-1 border-l", estNonOuvre(jour.iso) && "bg-muted/60")}>
      <div className={cn("h-12 border-b px-1 text-center text-xs", jour.iso === todayISO() && "bg-primary/10 font-semibold")}>
        {jour.libelle}
        <br />
        <b>{jour.numero} {jour.mois}</b>
        {ferie && <span className="block text-[10px]">Férié</span>}
      </div>
      <div className="relative" style={{ height: HEURES_PLANNING.length * HAUTEUR_CASE }}>
        {HEURES_PLANNING.map((h, i) => (
          <div
            key={h}
            aria-hidden="true"
            className={cn("absolute inset-x-0 border-b border-dashed", h === HEURE_PAUSE && "bg-muted", survol === i && "bg-primary/20")}
            style={{ top: i * HAUTEUR_CASE, height: HAUTEUR_CASE }}
            onDragOver={(e) => {
              if (!peutPlanifier) return;
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              setSurvol(i);
            }}
            onDragLeave={() => setSurvol(null)}
            onDrop={(e) => {
              e.preventDefault();
              setSurvol(null);
              const id = e.dataTransfer.getData("text/plain");
              const carte = glissee?.id === id || !id ? glissee : cartes.find((c) => c.id === id) ?? glissee;
              onGlisser(null);
              if (carte) poser(carte, jour.iso, heureDeLaCase(i));
            }}
          />
        ))}
        {duJour.map((c) => (
          <CartePosee key={`${c.id}|${jour.iso}`} carte={c} jour={jour.iso} placement={placementDuJour(c, jour.iso)} onGlisser={onGlisser} />
        ))}
      </div>
    </div>
  );
}

/** Six semaines de grille, heures 8-16 avec la pause de midi, week-ends et fériés grisés (PLN-02). */
export function Calendrier({ cartes, premierLundi, glissee, onGlisser }: Props) {
  const cetteSemaine = lundiDe(todayISO());
  return (
    <div className="flex flex-col gap-4 overflow-x-auto">
      {semainesAffichees(premierLundi).map((lundi) => (
        <section key={lundi} aria-label={`Semaine du ${libelleSemaine(lundi)}`}>
          <h2 className={cn("mb-1 text-sm font-semibold", lundi === cetteSemaine && "text-primary")}>
            {libelleSemaine(lundi)}
            {lundi === cetteSemaine && " · cette semaine"}
          </h2>
          <div className="flex rounded-md border">
            <div className="w-12 shrink-0 text-[10px] text-muted-foreground">
              <div className="h-12 border-b" />
              {HEURES_PLANNING.map((h) => (
                <div key={h} className={cn("border-b px-1", h === HEURE_PAUSE && "bg-muted")} style={{ height: HAUTEUR_CASE }}>
                  {String(h).padStart(2, "0")}:00
                </div>
              ))}
            </div>
            {joursDeLaSemaine(lundi).map((j) => (
              <ColonneJour key={j.iso} jour={j} cartes={cartes} glissee={glissee} onGlisser={onGlisser} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
