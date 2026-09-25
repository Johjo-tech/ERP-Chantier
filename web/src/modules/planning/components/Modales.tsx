import { cloneElement, useId, useState, type ReactElement } from "react";
import { Modale } from "@/components/ui/modale";
import { todayISO } from "@/lib/dates";
import { afficherToast } from "@/lib/toast";
import type { Equipe, SousTraitant } from "../domain/cartes";
import type { Affectation } from "../domain/filtres";
import type { AffectationChoisie } from "../domain/planification";
import { DUREE_DEFAUT_H, HEURE_DEFAUT } from "../domain/taches";
import { DUREES } from "./format";

/** Les deux boutons au pied de ces fenêtres (`display:flex; gap:10px; margin-top:16px`). */
function Pied({ valider, libelle, onAnnuler }: { valider: () => void; libelle: string; onAnnuler: () => void }) {
  return (
    <div style={{ display: "flex", gap: "10px", marginTop: "16px" }}>
      <button type="button" className="btn primary" onClick={valider}>{libelle}</button>
      <button type="button" className="btn ghost" onClick={onAnnuler}>Annuler</button>
    </div>
  );
}

/** Un `.field` de l'ancien, dont le libellé désigne la saisie. */
function Champ({ libelle, children }: { libelle: string; children: ReactElement<{ id?: string }> }) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{libelle}</label>
      {cloneElement(children, { id })}
    </div>
  );
}

/**
 * Le choix de l'équipe (ou du sous-traitant) à la pose (`choixAssigneModal`) :
 * OBLIGATOIRE (PLN-04). Une tâche sans équipe ne peut être close que par le
 * conducteur — on la demande donc au lieu de refuser le dépôt.
 */
export function ModaleAffectation({ type, equipes, sousTraitants, onChoisir, onAnnuler }: { type: Affectation; equipes: readonly Equipe[]; sousTraitants: readonly SousTraitant[]; onChoisir: (a: AffectationChoisie) => void; onAnnuler: () => void }) {
  const st = type === "sous_traitant";
  const liste = st ? sousTraitants : equipes;
  const [id, setId] = useState("");
  const valider = () => {
    if (!id) return afficherToast("Choisissez d'abord dans la liste.");
    onChoisir(st ? { type: "sous_traitant", sousTraitant: sousTraitants.find((s) => s.id === id) ?? null } : { type: "equipe", equipe: equipes.find((e) => e.id === id) ?? null });
  };
  return (
    <Modale titre={st ? "Quel sous-traitant ?" : "Quelle équipe ?"} onFermer={onAnnuler} largeurMax="380px">
      <p className="card-sub">{st ? "Le sous-traitant intervient sur cette date." : "Seuls les membres de cette équipe pourront déclarer les travaux faits."}</p>
      <Champ libelle="Affecter à">
        <select value={id} onChange={(e) => setId(e.target.value)}>
          <option value="">— Non attribué —</option>
          {liste.map((x) => (
            <option key={x.id} value={x.id}>{x.nom}</option>
          ))}
        </select>
      </Champ>
      <Pied valider={valider} libelle="✓ Planifier" onAnnuler={onAnnuler} />
    </Modale>
  );
}

/** Une journée de plus pour ce bon (`ajoutDateSupplModal`, PLN-06) : date (aujourd'hui ou après), heure, durée. */
export function ModaleDateSupplementaire({ onValider, onAnnuler }: { onValider: (date: string, heure: string, duree: number) => void; onAnnuler: () => void }) {
  const [date, setDate] = useState("");
  const [heure, setHeure] = useState(HEURE_DEFAUT);
  const [duree, setDuree] = useState(DUREE_DEFAUT_H);
  return (
    <Modale titre="Ajouter une date" onFermer={onAnnuler} largeurMax="380px">
      <p className="card-sub">Planifie ce même bon de commande sur un jour supplémentaire, en plus de sa date déjà prévue.</p>
      <Champ libelle="Date">
        <input type="date" min={todayISO()} value={date} onChange={(e) => setDate(e.target.value)} />
      </Champ>
      <div className="field-grid">
        <Champ libelle="Heure de début">
          <input type="time" value={heure} onChange={(e) => setHeure(e.target.value)} />
        </Champ>
        <Champ libelle="Durée">
          <select value={duree} onChange={(e) => setDuree(Number(e.target.value))}>
            {DUREES.map((n) => (
              <option key={n} value={n}>{n} h</option>
            ))}
          </select>
        </Champ>
      </div>
      <Pied valider={() => (date ? onValider(date, heure, duree) : afficherToast("Choisissez une date."))} libelle="✓ Ajouter" onAnnuler={onAnnuler} />
    </Modale>
  );
}

/** « Programmer un rappel » (`rappelModal`) : le locataire en congés revient à cette date. */
export function ModaleRappel({ onValider, onAnnuler }: { onValider: (date: string) => void; onAnnuler: () => void }) {
  const [date, setDate] = useState("");
  return (
    <Modale titre="Programmer un rappel" onFermer={onAnnuler} largeurMax="360px">
      <p className="card-sub">Ex : le locataire est en congés et revient à cette date — un rappel apparaîtra ce jour-là.</p>
      <Champ libelle="Rappeler le">
        <input type="date" min={todayISO()} value={date} onChange={(e) => setDate(e.target.value)} />
      </Champ>
      <Pied valider={() => (date ? onValider(date) : afficherToast("Choisissez une date de rappel."))} libelle="✓ Programmer" onAnnuler={onAnnuler} />
    </Modale>
  );
}
