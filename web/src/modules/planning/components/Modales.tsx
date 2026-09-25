import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { todayISO } from "@/lib/dates";
import type { Equipe, SousTraitant } from "../domain/cartes";
import type { Affectation } from "../domain/filtres";
import type { AffectationChoisie } from "../domain/planification";
import { DUREE_DEFAUT_H, HEURE_DEFAUT } from "../domain/taches";
import { SelectDuree } from "./ControlesCarte";
import { Dialogue } from "./Dialogue";

/**
 * Le choix de l'équipe (ou du sous-traitant) à la pose : OBLIGATOIRE (PLN-04).
 * Une tâche sans équipe ne peut être close que par le conducteur — on la
 * demande donc au lieu de refuser le dépôt.
 */
export function ModaleAffectation({ type, equipes, sousTraitants, onChoisir, onAnnuler }: { type: Affectation; equipes: readonly Equipe[]; sousTraitants: readonly SousTraitant[]; onChoisir: (a: AffectationChoisie) => void; onAnnuler: () => void }) {
  const st = type === "sous_traitant";
  const liste = st ? sousTraitants : equipes;
  const [id, setId] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const valider = () => {
    if (!id) {
      setErreur("Choisissez d'abord dans la liste.");
      return;
    }
    onChoisir(st ? { type: "sous_traitant", sousTraitant: sousTraitants.find((s) => s.id === id) ?? null } : { type: "equipe", equipe: equipes.find((e) => e.id === id) ?? null });
  };
  return (
    <Dialogue
      titre={st ? "Quel sous-traitant ?" : "Quelle équipe ?"}
      onFermer={onAnnuler}
      actions={
        <>
          <Button variant="ghost" onClick={onAnnuler}>Annuler</Button>
          <Button onClick={valider}>Planifier</Button>
        </>
      }
    >
      <p className="text-sm text-muted-foreground">{st ? "Le sous-traitant intervient sur cette date." : "Seuls les membres de cette équipe pourront déclarer les travaux faits."}</p>
      <label className="flex flex-col gap-1 text-sm">
        {st ? "Sous-traitant" : "Équipe"}
        <Select value={id} onChange={(e) => setId(e.target.value)} aria-invalid={!!erreur}>
          <option value="">— Choisir —</option>
          {liste.map((x) => <option key={x.id} value={x.id}>{x.nom}</option>)}
        </Select>
      </label>
      {!liste.length && <p className="text-sm text-destructive">{st ? "Aucun sous-traitant n'est enregistré." : "Aucune équipe n'est enregistrée."}</p>}
      {erreur && <p role="alert" className="text-sm text-destructive">{erreur}</p>}
    </Dialogue>
  );
}

/** Une journée de plus pour ce bon (PLN-06) : date (aujourd'hui ou après), heure, durée. */
export function ModaleDateSupplementaire({ onValider, onAnnuler }: { onValider: (date: string, heure: string, duree: number) => void; onAnnuler: () => void }) {
  const [date, setDate] = useState("");
  const [heure, setHeure] = useState(HEURE_DEFAUT);
  const [duree, setDuree] = useState(DUREE_DEFAUT_H);
  return (
    <Dialogue
      titre="Planifier une autre date"
      onFermer={onAnnuler}
      actions={
        <>
          <Button variant="ghost" onClick={onAnnuler}>Annuler</Button>
          <Button disabled={!date} onClick={() => onValider(date, heure, duree)}>Ajouter</Button>
        </>
      }
    >
      <label className="flex flex-col gap-1 text-sm">
        Date
        <Input type="date" min={todayISO()} value={date} onChange={(e) => setDate(e.target.value)} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Heure de début
        <Input type="time" value={heure} onChange={(e) => setHeure(e.target.value)} />
      </label>
      <div className="flex items-center gap-2 text-sm">
        Durée <SelectDuree libelle="Durée" valeur={duree} onChange={setDuree} />
      </div>
    </Dialogue>
  );
}
