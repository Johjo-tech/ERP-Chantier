import { useState } from "react";
import type { ChampsLieu } from "../domain/logement";
import { useSuggestionsAdresse, useVilleDuCodePostal } from "../hooks/useLieu";

type ValeursLieu = Record<ChampsLieu, string>;

const vu = (visible: boolean) => (visible ? undefined : { display: "none" as const });

/**
 * « Lieu & locataire » de l'ancien formulaire (`devisForm`, `factureForm`,
 * app.js l. 4640 et 6099) : le bouton qui déplie la boîte, le type de
 * logement qui révèle ses champs, le lieu avec ses adresses proposées, le code
 * postal qui pose la ville. Les champs masqués restent dans la page, comme
 * l'ancien les laissait — seul `display` change.
 */
export function SectionLieuAncien({ valeurs, changer, suffixe, avecTelephone }: {
  valeurs: ValeursLieu;
  changer: (champ: ChampsLieu, v: string) => void;
  /** « Devis » ou « Facture » : les identifiants de l'ancien (`locataireBoxDevis`…). */
  suffixe: string;
  /** Le devis porte le téléphone du locataire ; la facture, qui part chez le bailleur, non. */
  avecTelephone: boolean;
}) {
  const s = valeurs.logement_statut;
  const [ouverte, setOuverte] = useState(() => !!(valeurs.occupant || valeurs.adresse_locataire || valeurs.logement_statut));
  const [dansLAdresse, setDansLAdresse] = useState(false);
  const [cpTouche, setCpTouche] = useState(false);
  const suggestions = useSuggestionsAdresse(valeurs.adresse_locataire, dansLAdresse);
  useVilleDuCodePostal(valeurs.code_postal, (v) => changer("ville", v), cpTouche);
  const champ = (id: string, cle: ChampsLieu, libelle: string, placeholder?: string) => (
    <>
      <label htmlFor={id}>{libelle}</label>
      <input type="text" id={id} value={valeurs[cle]} placeholder={placeholder} onChange={(e) => changer(cle, e.target.value)} />
    </>
  );

  return (
    <div className="form-section">
      <div className="form-section-head">Lieu &amp; locataire</div>
      <div className="field-grid">
        <div className="field full" style={{ marginBottom: "2px" }}>
          <button type="button" className="btn small ghost" aria-expanded={ouverte} onClick={() => setOuverte((o) => !o)}>+ Le locataire est différent du client</button>
        </div>
        <div id={`locataireBox${suffixe}`} style={{ display: ouverte ? "contents" : "none" }}>
          <div className="field">
            <label htmlFor="f_logementStatut">Type</label>
            <select id="f_logementStatut" value={s} onChange={(e) => changer("logement_statut", e.target.value)}>
              <option value="">Non précisé</option>
              <option value="occupé">Logement occupé</option>
              <option value="vacant">Logement vacant</option>
              <option value="commune">Partie commune</option>
            </select>
          </div>
          <div className="field full" id={`communeField${suffixe}`} style={vu(s === "commune")}>{champ("f_precisionCommune", "precision_commune", "Précision (partie commune)", "Cave, hall d'entrée, local poubelles, parking, toiture…")}</div>
          <div className="field full" id={`vacantField${suffixe}`} style={vu(s === "vacant")}>{champ("f_ancienLocataire", "ancien_locataire", "Ancien locataire", "Ex : M. Dupont")}</div>
          <div className="field" id={`occupantField${suffixe}`} style={vu(s === "occupé")}>{champ("f_occupant", "occupant", "Locataire")}</div>
          {avecTelephone && (
            <div className="field" id={`telLocataireField${suffixe}`} style={vu(s === "occupé")}>
              <label htmlFor="f_telephoneLocataire">Téléphone du locataire</label>
              <input type="tel" id="f_telephoneLocataire" value={valeurs.telephone_locataire} placeholder="Ex : 06 12 34 56 78" onChange={(e) => changer("telephone_locataire", e.target.value)} />
            </div>
          )}
          <div className="address-trio">
            <div className="field" style={{ position: "relative" }}>
              <label htmlFor="f_adresseLocataire">Lieu d'intervention</label>
              <input type="text" id="f_adresseLocataire" autoComplete="off" value={valeurs.adresse_locataire} placeholder="Laisser vide si identique à l'adresse client" onChange={(e) => { changer("adresse_locataire", e.target.value); setDansLAdresse(true); }} onBlur={() => setTimeout(() => setDansLAdresse(false), 150)} />
              <div id="fLieuSuggestions" className="suggest-box" style={suggestions ? { display: "block" } : undefined}>
                {suggestions === "attente" && <div className="suggest-empty">Recherche…</div>}
                {Array.isArray(suggestions) && !suggestions.length && <div className="suggest-empty">Aucune adresse trouvée — saisie manuelle possible</div>}
                {Array.isArray(suggestions) &&
                  suggestions.map((a) => (
                    <div
                      key={a.label}
                      className="suggest-item"
                      role="option"
                      aria-selected={false}
                      tabIndex={-1}
                      onMouseDown={(e) => {
                        // Avant le `blur` du champ : sans cela la liste se ferme sous le clic.
                        e.preventDefault();
                        changer("adresse_locataire", a.adresse);
                        changer("code_postal", a.codePostal);
                        changer("ville", a.ville);
                        setDansLAdresse(false);
                      }}
                    >
                      <b>{a.adresse}</b>
                      <small>{a.codePostal} {a.ville}</small>
                    </div>
                  ))}
              </div>
            </div>
            <div className="field">
              <label htmlFor="f_codePostal">Code postal</label>
              <input type="text" id="f_codePostal" autoComplete="off" maxLength={5} inputMode="numeric" value={valeurs.code_postal} onChange={(e) => { changer("code_postal", e.target.value); setCpTouche(true); }} />
            </div>
            <div className="field">
              <label htmlFor="f_ville">Ville</label>
              <input type="text" id="f_ville" autoComplete="off" value={valeurs.ville} onChange={(e) => changer("ville", e.target.value)} />
            </div>
          </div>
          <div className="field" id={`etageField${suffixe}`} style={vu(s === "occupé" || s === "vacant")}>{champ("f_etage", "etage", "Étage", "RDC, 1er, 2e…")}</div>
          <div className="field" id={`numeroField${suffixe}`} style={vu(s === "occupé" || s === "vacant")}>{champ("f_numeroLogement", "numero_logement", "N° de logement", "Ex : 12, Appt 3B")}</div>
        </div>
      </div>
    </div>
  );
}
