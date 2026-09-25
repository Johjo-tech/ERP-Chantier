import { useState, type CSSProperties } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { CartePlanning } from "../domain/cartes";
import { dureeDesCases, type Placement } from "../domain/grille";
import { planCreneauJournee, planDernierJour, planEtirer, planRetirerDate } from "../domain/planification";
import { DUREE_DEFAUT_H, HEURE_DEFAUT } from "../domain/taches";
import { usePlanningContexte } from "./contexte";
import { ControlesOrigine, SelectDuree } from "./ControlesCarte";
import { numeroDeLaCarte } from "./format";
import { EtapeCarte, InfosCarte, MontantCarte } from "./InfosCarte";
import { HAUTEUR_CASE, Poignee } from "./Poignee";
import { TraceContacts } from "./ZoneContacts";

interface Props {
  carte: CartePlanning;
  jour: string;
  placement: Placement;
  onGlisser: (carte: CartePlanning) => void;
}

const arreter = (e: { stopPropagation: () => void }) => e.stopPropagation();

/** Une carte posée sur la colonne d'un jour, à sa hauteur : origine, suite d'une plage, dernier jour ou journée supplémentaire. */
export function CartePosee({ carte, jour, placement, onGlisser }: Props) {
  const { peutPlanifier, ouvrirFiche, appliquer, couleurMetier, donnees } = usePlanningContexte();
  const [apercu, setApercu] = useState<number | null>(null);
  const cases = apercu ?? placement.cases;
  const couleur = couleurMetier(carte.metier);
  const style: CSSProperties = { top: placement.indiceDebut * HAUTEUR_CASE + 2, height: cases * HAUTEUR_CASE - 4, ...(couleur ? { borderRightColor: couleur, borderRightWidth: 5 } : {}) };
  const deplacable = peutPlanifier && placement.variante === "origine" && !carte.faite;
  const avecTravaux = new Set(donnees.tachesAvecTravaux);
  const journee = placement.journee;
  const libelle = `${carte.bon.client_nom}, ${numeroDeLaCarte(carte)}${placement.variante === "suite" ? " (suite)" : ""}`;

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={libelle}
      draggable={deplacable}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", carte.id);
        onGlisser(carte);
      }}
      onClick={() => ouvrirFiche(carte, jour)}
      onKeyDown={(e) => e.key === "Enter" && e.target === e.currentTarget && ouvrirFiche(carte, jour)}
      style={style}
      className={cn(
        "absolute inset-x-0.5 overflow-hidden rounded-md border bg-card p-1 text-left shadow-sm hover:z-10 hover:overflow-visible hover:shadow-md focus-visible:z-10 focus-visible:outline-2",
        carte.faite && "bg-emerald-50",
        placement.variante === "suppl" && "border-dashed",
        carte.isSav && "border-l-4 border-l-destructive"
      )}
    >
      {placement.variante === "origine" && (
        <>
          <InfosCarte carte={carte} compacte />
          <TraceContacts carte={carte} />
          {peutPlanifier ? <ControlesOrigine carte={carte} /> : <p className="text-[11px] text-muted-foreground">{carte.rdv.heurePlanifiee ?? "—"}{carte.rdv.dureeHeures ? ` · ${carte.rdv.dureeHeures} h` : ""}</p>}
          <MontantCarte carte={carte} />
        </>
      )}
      {placement.variante !== "origine" && (
        <>
          <p className="text-sm font-semibold leading-tight">
            {carte.bon.client_nom}
            {placement.variante === "suppl" && <span className="ml-1 rounded bg-muted px-1 text-[10px]" title="Journée supplémentaire de ce même bon">📅 Suppl.</span>}
          </p>
          <p className="text-xs">{numeroDeLaCarte(carte)}{placement.variante === "suite" ? " · suite" : placement.variante === "dernier" ? " · suite, dernier jour" : ""}</p>
          <EtapeCarte carte={carte} />
        </>
      )}
      {placement.variante === "dernier" && peutPlanifier && (
        <Input aria-label="Heure de début ce jour-là" type="time" className="mt-1 h-7 w-24 px-1 text-xs" value={carte.rdv.heureDernierJour ?? HEURE_DEFAUT} onClick={arreter} onChange={(e) => e.target.value && appliquer(carte, () => planDernierJour(carte, { heure: e.target.value }))} />
      )}
      {placement.variante === "suppl" && journee && peutPlanifier && !journee.fait && (
        <div className="mt-1 flex flex-wrap items-center gap-1" onClick={arreter}>
          <Input aria-label="Heure de cette journée" type="time" className="h-7 w-24 px-1 text-xs" value={journee.creneau?.heure ?? HEURE_DEFAUT} onChange={(e) => e.target.value && appliquer(carte, () => planCreneauJournee(carte, jour, { heure: e.target.value }))} />
          <SelectDuree libelle="Durée de cette journée" valeur={journee.creneau?.duree ?? DUREE_DEFAUT_H} onChange={(d) => appliquer(carte, () => planCreneauJournee(carte, jour, { duree: d }))} />
          <button type="button" className="text-xs" aria-label="Retirer cette journée" onClick={() => appliquer(carte, () => planRetirerDate(carte, jour, avecTravaux), "Journée retirée.")}>✕</button>
        </div>
      )}
      {peutPlanifier && placement.variante !== "suite" && !(placement.variante === "suppl" && journee?.fait) && (
        <Poignee
          casesDepart={placement.cases}
          indiceDebut={placement.indiceDebut}
          horizontal={placement.variante === "origine"}
          onApercu={setApercu}
          onFin={(n, fin) => {
            if (placement.variante === "suppl") appliquer(carte, () => planCreneauJournee(carte, jour, { duree: dureeDesCases(placement.indiceDebut, n) }));
            else appliquer(carte, () => planEtirer(carte, { cases: n, indiceDebut: placement.indiceDebut, fin, dernierJour: placement.variante === "dernier" }));
          }}
        />
      )}
    </div>
  );
}
