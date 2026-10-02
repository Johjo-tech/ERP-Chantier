import { useState } from "react";
import { EditeurLignes } from "@/modules/documents/components/EditeurLignes";
import type { ChampReferenceLigne } from "@/modules/documents/components/reference";
import type { ErreurLigne, LigneEdition } from "@/modules/documents/domain/lignes";
import type { LigneBonLue } from "../domain/bon";
import { zoneMontant } from "../domain/formulaire";
import { BoiteTotaux } from "./BoiteTotaux";
import { ChampMetierChapitre } from "./ChampMetierChapitre";
import { LignesSansPrix } from "./LignesSansPrix";

interface PropsMontant {
  lignes: readonly LigneEdition[];
  montant: string;
  onMontant: (v: string) => void;
  metiers: readonly string[];
  montantsParMetier: Readonly<Record<string, string>>;
  onMontantMetier: (metier: string, v: string) => void;
  /** Métiers qu'aucun chapitre du devis lié ne désigne : leur montant reste à saisir. */
  sansChapitre: readonly string[];
  erreur?: string | undefined;
  desactive: boolean;
}

/** Le montant du bon (`bcMontantFieldsHTML`) : saisi, calculé sur les lignes, ou ventilé par métier. */
function ZoneMontant({ lignes, montant, onMontant, metiers, montantsParMetier, onMontantMetier, sansChapitre, erreur, desactive }: PropsMontant) {
  const z = zoneMontant(metiers, lignes);
  if (z.forme !== "ventile") {
    return (
      <div className="field full" id="bcMontantFieldsZone">
        <label htmlFor="bc_montant">Montant des travaux (HT)</label>
        {z.forme === "calcule" ? (
          <input type="number" step="0.01" id="bc_montant" value={z.valeur} readOnly className="champ-calcule" />
        ) : (
          <input type="number" step="0.01" id="bc_montant" value={montant.replace(",", ".")} placeholder="0,00" disabled={desactive} aria-invalid={erreur ? true : undefined} onChange={(e) => onMontant(e.target.value)} />
        )}
        {z.forme === "calcule" && <div className="bc-montant-note">{z.note}</div>}
        {erreur && <small className="champ-erreur">{erreur}</small>}
      </div>
    );
  }
  return (
    <div className="field full" id="bcMontantFieldsZone">
      <label>Montant des travaux (HT) — par métier</label>
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {[...new Set(metiers)].map((m) => (
          <div key={m}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ minWidth: "130px", fontSize: "13px", color: "var(--text-dim)" }}>{m}</span>
              <input type="number" step="0.01" className="bc_montant_metier" data-metier={m} aria-label={`Montant des travaux (HT) — ${m}`} value={(montantsParMetier[m] ?? "").replace(",", ".")} placeholder="0,00" style={{ flex: 1 }} disabled={desactive} onChange={(e) => onMontantMetier(m, e.target.value)} />
            </div>
            {sansChapitre.includes(m) && <div style={{ fontSize: "11.5px", color: "var(--accent-2)", margin: "3px 0 0 138px" }}>⚠ Aucun chapitre &quot;{m}&quot; trouvé dans le devis lié — montant à saisir manuellement.</div>}
          </div>
        ))}
      </div>
      {z.note && <div className="bc-montant-note">{z.note}</div>}
      {erreur && <small className="champ-erreur">{erreur}</small>}
    </div>
  );
}

interface Props extends PropsMontant {
  prix: boolean;
  onLignes: (l: LigneEdition[]) => void;
  lignesLues: readonly LigneBonLue[];
  tvaDefaut: number;
  taux: readonly number[];
  erreursLignes: readonly ErreurLigne[];
  ChampReference?: ChampReferenceLigne | undefined;
}

/**
 * « Chiffrage » : le montant, puis les travaux à réaliser — au moins une
 * ligne, le prix peut attendre le chiffrage — et leurs totaux. Qui ne voit pas
 * les prix lit les travaux sans montant.
 */
export function ChiffrageBon(p: Props) {
  const [ouverte, setOuverte] = useState(true);
  return (
    <div className="form-section">
      <div className="form-section-head"><span className="form-section-ico" />Chiffrage</div>
      {p.prix && <div className="field-grid"><ZoneMontant {...p} /></div>}
      <div className="section-title" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "8px", borderTop: "none", paddingTop: 0 }}>
        <span>Travaux à réaliser *</span>
        {/* L'ancien libellé ne change pas au clic : on le garde tel quel. */}
        <button type="button" className="btn small ghost" aria-expanded={ouverte} aria-controls="bcLignesZone" onClick={() => setOuverte(!ouverte)}>▲ Masquer</button>
      </div>
      <p className="card-sub">Au moins une ligne est obligatoire : décrivez en gros ce qu&apos;il y a à faire. Le prix peut rester à zéro, il se saisit au chiffrage — la description, elle, part sur la facture. Si vous chiffrez ici, le montant ci-dessus sera recalculé automatiquement.</p>
      <div id="bcLignesZone" style={{ display: ouverte ? "block" : "none" }}>
        {p.prix ? (
          <>
            <EditeurLignes lignes={[...p.lignes]} onChange={p.onLignes} tvaDefaut={p.tvaDefaut} taux={p.taux} erreurs={p.erreursLignes} lectureSeule={p.desactive} ChampReference={p.ChampReference} ChampMetier={ChampMetierChapitre} />
            <BoiteTotaux id="bcTotalsBoxContent" lignes={p.lignes.map((l) => ({ type: l.type, quantite: l.quantite, prix_unitaire: l.prix_unitaire, tva: l.tva }))} />
          </>
        ) : (
          <LignesSansPrix lignes={p.lignesLues} />
        )}
      </div>
    </div>
  );
}
