import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { formatDateFr } from "@/lib/dates";
import type { CartePlanning } from "../domain/cartes";
import { planAffectation, planAvancer, planCreneau, planDateFin, planDeplanifier, planRetirerDate, questionDeplanifier, type AffectationChoisie } from "../domain/planification";
import { DUREE_DEFAUT_H, HEURE_DEFAUT } from "../domain/taches";
import { DUREES } from "./format";
import { usePlanningContexte } from "./contexte";
import { MontantSousTraitant } from "./MontantSousTraitant";

const arreter = (e: { stopPropagation: () => void }) => e.stopPropagation();

export function SelectDuree({ valeur, onChange, libelle }: { valeur: number; onChange: (d: number) => void; libelle: string }) {
  return (
    <Select aria-label={libelle} className="h-7 w-16 px-1 text-xs" value={valeur} onClick={arreter} onChange={(e) => onChange(Number(e.target.value))}>
      {DUREES.map((n) => (
        <option key={n} value={n}>{n} h</option>
      ))}
    </Select>
  );
}

/** Équipe ou sous-traitant selon la vue ; « Non attribué » retire l'affectation. */
function SelectAffecte({ carte }: { carte: CartePlanning }) {
  const { donnees, affectation, appliquer } = usePlanningContexte();
  const st = affectation === "sous_traitant";
  const liste = st ? donnees.sousTraitants : donnees.equipes;
  const choisir = (id: string) => {
    const a: AffectationChoisie = st ? { type: "sous_traitant", sousTraitant: donnees.sousTraitants.find((s) => s.id === id) ?? null } : { type: "equipe", equipe: donnees.equipes.find((e) => e.id === id) ?? null };
    appliquer(carte, () => planAffectation(carte, a), st ? "Sous-traitant mis à jour." : "Équipe mise à jour.");
  };
  return (
    <Select aria-label={st ? "Sous-traitant assigné" : "Équipe assignée"} className="h-7 px-1 text-xs" value={(st ? carte.sousTraitantId : carte.equipeId) ?? ""} onClick={arreter} onChange={(e) => choisir(e.target.value)}>
      <option value="">— Non attribué —</option>
      {liste.map((x) => (
        <option key={x.id} value={x.id}>{x.nom}</option>
      ))}
    </Select>
  );
}

/** Les réglages d'une carte posée, au jour de son rendez-vous (PLN-05). */
export function ControlesOrigine({ carte }: { carte: CartePlanning }) {
  const { appliquer, demanderDate, donnees } = usePlanningContexte();
  const avecTravaux = new Set(donnees.tachesAvecTravaux);
  const deplanifier = () => {
    const question = questionDeplanifier(carte);
    if (question && !window.confirm(question)) return;
    appliquer(carte, () => planDeplanifier(carte, avecTravaux), "Carte renvoyée dans « Non planifiés ».");
  };
  return (
    <div className="mt-1 flex flex-col gap-1" onClick={arreter}>
      <div className="flex flex-wrap items-center gap-1">
        {carte.suppl.map((d) => (
          <span key={d.date} className="inline-flex items-center gap-1 rounded bg-muted px-1 text-[11px]">
            📅 {formatDateFr(d.date)} {d.creneau?.heure ?? HEURE_DEFAUT} ({d.creneau?.duree ?? DUREE_DEFAUT_H} h)
            <button type="button" aria-label={`Retirer la journée du ${formatDateFr(d.date)}`} onClick={() => appliquer(carte, () => planRetirerDate(carte, d.date, avecTravaux), "Journée retirée.")}>✕</button>
          </span>
        ))}
        <Button size="sm" variant="ghost" className="h-6 px-1 text-[11px]" onClick={() => demanderDate(carte)}>+ Autre date</Button>
      </div>
      <div className="flex flex-wrap items-center gap-1">
        <Input aria-label="Heure de début" type="time" className="h-7 w-24 px-1 text-xs" value={carte.rdv.heurePlanifiee ?? ""} onChange={(e) => e.target.value && appliquer(carte, () => planCreneau(carte, { heure: e.target.value }))} />
        <SelectDuree libelle="Durée" valeur={carte.rdv.dureeHeures || DUREE_DEFAUT_H} onChange={(d) => appliquer(carte, () => planCreneau(carte, { duree: d }))} />
        <SelectAffecte carte={carte} />
        <Input aria-label="Étirer jusqu'au" type="date" className="h-7 w-32 px-1 text-xs" min={carte.rdv.datePlanifiee ?? undefined} value={carte.rdv.datePlanifieeFin ?? carte.rdv.datePlanifiee ?? ""} onChange={(e) => appliquer(carte, () => planDateFin(carte, e.target.value))} />
      </div>
      <MontantSousTraitant carte={carte} />
      <div className="flex gap-1">
        <Button size="sm" variant="outline" className="h-6 px-2 text-[11px]" title="Annuler l'étirement (puis déplanifier au clic suivant)" onClick={() => appliquer(carte, () => planAvancer(carte, avecTravaux))}>←</Button>
        <Button size="sm" variant="outline" className="h-6 px-2 text-[11px]" onClick={deplanifier}>Retirer du planning</Button>
      </div>
    </div>
  );
}
