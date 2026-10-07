import { useState, type ReactNode } from "react";
import { messageErreur } from "@/lib/erreurs";
import { afficherToast } from "@/lib/toast";
import { nomPersonne, saisiePretVierge, schemaSaisiePret, type PersonneAnnuaire, type SaisiePret } from "../domain/prets";

interface Props {
  /** Préfixe des identifiants de champ (`pretSalarieId_<id>` de l'ancien). */
  id: string;
  personnes: readonly PersonneAnnuaire[];
  etats: readonly string[];
  etatInitial: string;
  enCours: boolean;
  /** Le message de la ligne vide : « ce matériel » ou « ce véhicule ». */
  quoi: string;
  onPreter: (s: SaisiePret) => void;
  /** Ce qui se saisit en plus pour un véhicule : le schéma de l'état au départ. */
  complement?: ReactNode;
}

/**
 * Prêter un objet du parc, sur la ligne `.entretien-add-row` de l'ancien écran
 * (app.js l. 14800 et 15060) : à qui, dans quel état, depuis quand, combien de
 * jours, « + Prêter ». Les champs n'ont pas de libellé visible — l'ancien n'en
 * avait pas ; ils en ont un pour les lecteurs d'écran. Une saisie refusée se
 * dit par la bulle, comme avant.
 */
export function FormulairePret({ id, personnes, etats, etatInitial, enCours, quoi, onPreter, complement }: Props) {
  const [valeurs, setValeurs] = useState(() => saisiePretVierge(etatInitial));
  const changer = (cle: keyof SaisiePret, v: string) => setValeurs((x) => ({ ...x, [cle]: v }));

  function preter() {
    if (!valeurs.salarie_id) {
      afficherToast(`Choisissez la personne à qui prêter ${quoi}.`);
      return;
    }
    const r = schemaSaisiePret.safeParse(valeurs);
    if (!r.success) {
      afficherToast(messageErreur(r.error));
      return;
    }
    onPreter(r.data);
  }

  return (
    <div role="form" aria-label="Prêter">
      <div className="entretien-add-row">
        <label htmlFor={`${id}-salarie`} className="sr-only">Prêté à</label>
        <select id={`${id}-salarie`} value={valeurs.salarie_id} onChange={(e) => changer("salarie_id", e.target.value)}>
          <option value="">— Sans conducteur / non renseigné —</option>
          {personnes.map((p) => (
            <option key={p.id} value={p.id}>
              {nomPersonne(p)}
            </option>
          ))}
        </select>
        <label htmlFor={`${id}-etat`} className="sr-only">État au prêt</label>
        <select id={`${id}-etat`} value={valeurs.etat} onChange={(e) => changer("etat", e.target.value)}>
          {etats.map((e) => (
            <option key={e} value={e}>
              {e}
            </option>
          ))}
        </select>
        <label htmlFor={`${id}-date`} className="sr-only">Date du prêt</label>
        <input type="date" id={`${id}-date`} value={valeurs.date_debut} onChange={(e) => changer("date_debut", e.target.value)} />
        <label htmlFor={`${id}-duree`} className="sr-only">Durée (jours)</label>
        <input type="number" id={`${id}-duree`} placeholder="Durée (jours)" style={{ width: "140px" }} value={valeurs.duree_jours} onChange={(e) => changer("duree_jours", e.target.value)} />
        <button type="button" className="btn primary" disabled={enCours} onClick={preter}>
          + Prêter
        </button>
      </div>
      {complement}
    </div>
  );
}
