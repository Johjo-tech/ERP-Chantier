import { useId, useState } from "react";
import { formatDateFr, todayISO } from "@/lib/dates";
import type { ReglagesDocuments } from "@/modules/societes/domain/reglages";
import { CLE_AUTRE, CLE_SOCIETE, dateEcheance, DELAIS_PREREGLES, delaiHorsPlafond, delaiPaiementRetenu, libelleDelaiPaiement, MODES_REGLEMENT } from "../domain/delais";

export type ChampDelai = "delai_paiement_jours" | "delai_paiement_mode" | "mode_paiement";

interface Props {
  jours: string;
  mode: string;
  modePaiement: string;
  /** La clé de la liste, tenue par le formulaire : un changement de type de client la repose (`appliquerDelaiDuCadre`). */
  cle: string;
  onCle: (cle: string, parLUtilisateur: boolean) => void;
  reglages: ReglagesDocuments;
  erreurJours?: string | undefined;
  onChange: (champ: ChampDelai, v: string) => void;
}

/** Le mode de règlement proposé quand la fiche n'en porte pas (`MODE_REGLEMENT_DEFAUT`). */
const MODE_REGLEMENT_DEFAUT = "virement";

/**
 * Le bloc « 💶 Règlement » de l'ancienne fiche : délai (liste), mode de
 * règlement, et — pour un délai hors liste seulement — le nombre de jours et
 * le mode de calcul. L'aide sous le bloc dit l'échéance d'une facture du jour ;
 * comme l'ancien, elle n'apparaît qu'une fois le délai touché.
 */
export function ChampsDelai({ jours, mode, modePaiement, cle, onCle, reglages, erreurJours, onChange }: Props) {
  const [touche, setTouche] = useState(false);
  const ids = { preset: useId(), mode: useId(), jours: useId(), calcul: useId() };
  const libre = cle === CLE_AUTRE;
  const modeSur = mode === "fin_de_mois" ? "fin_de_mois" : "net";
  const modeRetenu = modePaiement.trim() || MODE_REGLEMENT_DEFAUT;
  const connu = MODES_REGLEMENT.some((m) => m.code === modeRetenu);

  const delai = delaiPaiementRetenu(
    { delai_paiement_jours: jours.trim() === "" ? null : Number(jours), delai_paiement_mode: modeSur },
    { delai_paiement_jours: reglages.delaiPaiementJours, delai_paiement_mode: reglages.modeDelaiPaiement }
  );
  const hors = delaiHorsPlafond(delai);
  const aide = `${libelleDelaiPaiement(delai)} — une facture d'aujourd'hui serait due le ${formatDateFr(dateEcheance(todayISO(), delai))}.${hors ? ` ${hors}` : ""}`;

  function choisir(c: string) {
    setTouche(true);
    onCle(c, true);
  }

  return (
    <div className="field-grid">
      <div className="field full section-title" style={{ margin: "12px 0 0" }}>
        💶 Règlement
      </div>
      <div className="field">
        <label htmlFor={ids.preset}>Délai de paiement</label>
        <select id={ids.preset} value={cle} onChange={(e) => choisir(e.target.value)}>
          <option value={CLE_SOCIETE}>Réglage de la société ({reglages.delaiPaiementJours} jours)</option>
          {DELAIS_PREREGLES.map((d) => (
            <option key={d.cle} value={d.cle}>
              {d.libelle}
            </option>
          ))}
          <option value={CLE_AUTRE}>Autre — saisie libre…</option>
        </select>
      </div>
      <div className="field">
        <label htmlFor={ids.mode}>Mode de règlement</label>
        <select id={ids.mode} value={modeRetenu} onChange={(e) => onChange("mode_paiement", e.target.value)}>
          {MODES_REGLEMENT.map((m) => (
            <option key={m.code} value={m.code}>
              {m.libelle}
            </option>
          ))}
          {/* Une valeur que la liste ne propose plus reste affichée : ouvrir la fiche ne doit pas la changer. */}
          {!connu && <option value={modeRetenu}>{modeRetenu === "traite" ? "Traite" : "Autre"}</option>}
        </select>
      </div>
      <div className="field" hidden={!libre}>
        <label htmlFor={ids.jours}>Nombre de jours</label>
        <input
          type="number"
          min={0}
          id={ids.jours}
          value={jours}
          placeholder={`Défaut société : ${reglages.delaiPaiementJours}`}
          aria-invalid={!!erreurJours}
          onChange={(e) => {
            setTouche(true);
            onChange("delai_paiement_jours", e.target.value);
          }}
        />
        {erreurJours && (
          <small role="alert" className="champ-erreur">
            {erreurJours}
          </small>
        )}
      </div>
      <div className="field" hidden={!libre}>
        <label htmlFor={ids.calcul}>Mode de calcul</label>
        <select
          id={ids.calcul}
          value={modeSur}
          onChange={(e) => {
            setTouche(true);
            onChange("delai_paiement_mode", e.target.value);
          }}
        >
          <option value="net">Net — date de facture + N jours</option>
          <option value="fin_de_mois">Fin de mois — fin du mois + N jours</option>
        </select>
      </div>
      <div className="field full">
        <small className="card-sub" aria-live="polite" style={hors ? { color: "var(--danger)" } : undefined}>
          {touche ? aide : ""}
        </small>
      </div>
    </div>
  );
}
