import { useId, useState, type CSSProperties } from "react";
import { messageErreur } from "@/lib/erreurs";
import { afficherToast } from "@/lib/toast";
import { verifierFichierChantier } from "@/modules/chantiers/domain/fichiers";
import { ACCEPTE_DOCUMENT_VEHICULE } from "../domain/documents";
import { saisieEntretienDepuis, schemaSaisieEntretien, type Entretien, type SaisieEntretien } from "../domain/entretien";

/** La pastille verte des entretiens (`--cat-color:#5BC97A` de l'ancien écran). */
const VERT_ENTRETIEN = "#5BC97A";

function lire(valeurs: Record<keyof SaisieEntretien, string>): SaisieEntretien | null {
  const r = schemaSaisieEntretien.safeParse(valeurs);
  if (r.success) return r.data;
  afficherToast(r.error.issues[0]?.message ?? messageErreur(r.error));
  return null;
}

interface PropsAjout {
  vehiculeId: string;
  kmVehicule: number | null;
  voitLesPrix: boolean;
  enCours: boolean;
  /** `reussi` vide la ligne : un échec garde la saisie. */
  onAjouter: (s: SaisieEntretien, fichier: File | null, reussi: () => void) => void;
}

/**
 * La ligne d'ajout de `renderVehiculeDetail` (app.js l. 15086) : désignation,
 * kilométrage (prérempli du compteur), montant, date, « 📎 Facture »,
 * « + Ajouter ». Le montant disparaît pour qui ne voit pas les prix (D-VEH-07).
 */
export function AjoutEntretien({ vehiculeId, kmVehicule, voitLesPrix, enCours, onAjouter }: PropsAjout) {
  const idFichier = useId();
  const [valeurs, setValeurs] = useState(() => saisieEntretienDepuis(null, kmVehicule));
  const [fichier, setFichier] = useState<File | null>(null);
  const changer = (cle: keyof SaisieEntretien, v: string) => setValeurs((x) => ({ ...x, [cle]: v }));

  function ajouter() {
    const s = lire(valeurs);
    if (!s) return;
    onAjouter(s, fichier, () => {
      setFichier(null);
      setValeurs(saisieEntretienDepuis(null, s.kilometrage ?? kmVehicule));
    });
  }

  return (
    <div className="entretien-add-row">
      <label htmlFor={`entretienDesignation_${vehiculeId}`} className="sr-only">Désignation</label>
      <input type="text" id={`entretienDesignation_${vehiculeId}`} placeholder="Ex : Vidange, plaquettes de frein…" style={{ flex: 1 }} value={valeurs.designation} onChange={(e) => changer("designation", e.target.value)} />
      <label htmlFor={`entretienKilometrage_${vehiculeId}`} className="sr-only">Kilométrage</label>
      <input type="number" id={`entretienKilometrage_${vehiculeId}`} placeholder="Kilométrage" value={valeurs.kilometrage} onChange={(e) => changer("kilometrage", e.target.value)} />
      {voitLesPrix && (
        <>
          <label htmlFor={`entretienMontant_${vehiculeId}`} className="sr-only">Montant</label>
          <input type="number" step="0.01" id={`entretienMontant_${vehiculeId}`} placeholder="Montant" value={valeurs.montant} onChange={(e) => changer("montant", e.target.value)} />
        </>
      )}
      <label htmlFor={`entretienDate_${vehiculeId}`} className="sr-only">Date</label>
      <input type="date" id={`entretienDate_${vehiculeId}`} value={valeurs.date_entretien} onChange={(e) => changer("date_entretien", e.target.value)} />
      <label className="btn" style={{ cursor: "pointer" }} htmlFor={idFichier} title={fichier?.name}>
        📎 Facture
        <input
          type="file"
          id={idFichier}
          accept={ACCEPTE_DOCUMENT_VEHICULE}
          style={{ display: "none" }}
          onChange={(e) => {
            const f = e.target.files?.[0] ?? null;
            e.target.value = "";
            if (!f) return;
            const verdict = verifierFichierChantier(f);
            if (verdict.ok) setFichier(f);
            else afficherToast(verdict.motif);
          }}
        />
      </label>
      <button type="button" className="btn primary" disabled={enCours} onClick={ajouter}>
        + Ajouter
      </button>
    </div>
  );
}

/** La ligne en correction (`entretienEditRowHTML`, app.js l. 15329) : ✓ enregistre, ✕ abandonne. */
export function EditionEntretien({ entretien, voitLesPrix, enCours, onEnregistrer, onAnnuler }: { entretien: Entretien; voitLesPrix: boolean; enCours: boolean; onEnregistrer: (s: SaisieEntretien) => void; onAnnuler: () => void }) {
  const [valeurs, setValeurs] = useState(() => saisieEntretienDepuis(entretien, null));
  const changer = (cle: keyof SaisieEntretien, v: string) => setValeurs((x) => ({ ...x, [cle]: v }));
  const id = entretien.id;
  return (
    <div className="achat-row entretien-edit-row" style={{ "--cat-color": VERT_ENTRETIEN } as CSSProperties}>
      <div className="achat-row-icon" style={{ background: `${VERT_ENTRETIEN}22`, color: VERT_ENTRETIEN }}>
        🔧
      </div>
      <input type="text" aria-label="Désignation" id={`editEntretienDesignation_${id}`} value={valeurs.designation} style={{ flex: 1, minWidth: "140px" }} onChange={(e) => changer("designation", e.target.value)} />
      <input type="number" aria-label="Kilométrage" id={`editEntretienKilometrage_${id}`} value={valeurs.kilometrage} placeholder="Km" style={{ width: "110px" }} onChange={(e) => changer("kilometrage", e.target.value)} />
      {voitLesPrix && (
        <input type="number" aria-label="Montant" step="0.01" id={`editEntretienMontant_${id}`} value={valeurs.montant.replace(",", ".")} style={{ width: "110px" }} onChange={(e) => changer("montant", e.target.value)} />
      )}
      <input type="date" aria-label="Date" id={`editEntretienDate_${id}`} value={valeurs.date_entretien} style={{ width: "150px" }} onChange={(e) => changer("date_entretien", e.target.value)} />
      <button
        type="button"
        className="btn small primary"
        aria-label="Enregistrer l'entretien"
        disabled={enCours}
        onClick={() => {
          if (!valeurs.designation.trim()) {
            afficherToast("La désignation ne peut pas être vide.");
            return;
          }
          const s = lire(valeurs);
          if (s) onEnregistrer(s);
        }}
      >
        ✓
      </button>
      <button type="button" className="btn small ghost" aria-label="Annuler la correction" onClick={onAnnuler}>
        ✕
      </button>
    </div>
  );
}
