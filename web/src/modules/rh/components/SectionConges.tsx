import { useState, type CSSProperties } from "react";
import { formatDateFr, todayISO } from "@/lib/dates";
import { messageErreur } from "@/lib/erreurs";
import { afficherToast } from "@/lib/toast";
import { useToastErreur } from "@/modules/materiel/components/communs";
import { demandeJustificatif, nbJoursOuvres, schemaSaisieAbsence, soldeCpRestant, trierAbsences, TYPES_ABSENCE, type Absence } from "../domain/conges";
import { useDroitsRh, useGererDossier } from "../hooks/useRh";
import { BoutonPiece, ChoixFichier } from "./communs";

const formatJours = new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** La pastille d'une absence (`salarieForm`) : bleu pour un congé payé, rouge pour un arrêt maladie, orangé sinon. */
function couleurAbsence(type: string): string {
  if (type === "Congé payé") return "#2E9BF0";
  if (type === "Arrêt maladie") return "#EF5A6F";
  return "#F0A82E";
}

interface Props {
  salarieId: string;
  /** L'acquis saisi dans la fiche : il s'enregistre avec elle (D-RH-02), d'où le champ tenu par la fiche. */
  soldeInitial: string;
  onSoldeInitial: (v: string) => void;
  absences: readonly Absence[];
}

/**
 * « 🏖️ Congés & Absences » (RH-08, RH-20), au HTML de `salarieForm` (app.js
 * l. 16345) : l'acquis et le solde calculé, la ligne d'ajout, puis la liste.
 * Les absences sont relues de la base — elles ne se perdent plus au
 * rechargement (D-RH-02).
 */
export function SectionConges({ salarieId, soldeInitial, onSoldeInitial, absences }: Props) {
  const droits = useDroitsRh();
  const gerer = useGererDossier();
  useToastErreur(gerer.supprimerAbsence.error);
  const restant = soldeCpRestant(soldeInitial.replace(",", "."), absences);
  return (
    <>
      <div className="chantier-subsection-title" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span>🏖️ Congés &amp; Absences</span>
      </div>
      <div className="field-grid" style={{ marginTop: "8px" }}>
        <div className="field">
          <label htmlFor="sal_soldeCpInitial">Solde de CP acquis (jours)</label>
          <input type="number" step="0.5" id="sal_soldeCpInitial" value={soldeInitial} placeholder="Ex : 25" onChange={(e) => onSoldeInitial(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="sal_soldeRestant">Solde restant (calculé)</label>
          <input type="text" id="sal_soldeRestant" value={`${formatJours.format(restant).replace(",", ".")} jour(s)`} disabled style={{ background: "var(--surface-2)", fontWeight: 700 }} />
        </div>
      </div>
      {droits.modifier && <AjoutAbsence salarieId={salarieId} />}
      <div className="achats-list" style={{ marginTop: "10px" }}>
        {absences.length === 0 ? (
          <div className="empty">Aucune absence enregistrée.</div>
        ) : (
          trierAbsences(absences).map((a) => {
            const c = couleurAbsence(a.type);
            return (
              <div key={a.id} className="achat-row" style={{ "--cat-color": c } as CSSProperties}>
                <div className="achat-row-icon" style={{ background: `${c}22`, color: c }}>
                  🏖️
                </div>
                <div className="achat-row-main">
                  <div className="achat-designation">
                    {a.type}
                    {a.commentaire && ` — ${a.commentaire}`}
                    {a.justificatifChemin && (
                      <>
                        {" · "}
                        <BoutonPiece chemin={a.justificatifChemin} libelle="📎 justificatif" />
                      </>
                    )}
                  </div>
                  <div className="achat-date">
                    {formatDateFr(a.dateDebut)} → {formatDateFr(a.dateFin)} · {a.nbJours ?? "?"} jour(s) ouvré(s)
                  </div>
                </div>
                {droits.supprimer && (
                  <button
                    type="button"
                    className="btn small danger"
                    aria-label={`Retirer cette absence (${a.type})`}
                    onClick={() => {
                      if (window.confirm(`Retirer cette absence (${a.type}) ?`)) gerer.supprimerAbsence.mutate(a);
                    }}
                  >
                    ✕
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>
    </>
  );
}

const VIERGE = { type: TYPES_ABSENCE[0] as string, dateDebut: "", dateFin: "", commentaire: "" };

/** La ligne `.entretien-add-row` d'ajout d'une absence, et le justificatif d'un arrêt. */
function AjoutAbsence({ salarieId }: { salarieId: string }) {
  const gerer = useGererDossier();
  const [fichier, setFichier] = useState<File | null>(null);
  const [valeurs, setValeurs] = useState(VIERGE);
  const changer = (cle: keyof typeof VIERGE, v: string) => setValeurs((x) => ({ ...x, [cle]: v }));
  const justifier = demandeJustificatif(valeurs.type);

  function ajouter() {
    const r = schemaSaisieAbsence.safeParse(valeurs);
    if (!r.success) {
      afficherToast(r.error.issues[0]?.message ?? messageErreur(r.error));
      return;
    }
    const saisie = r.data;
    gerer.ajouterAbsence.mutate(
      { salarieId, saisie, nbJours: nbJoursOuvres(saisie.dateDebut, saisie.dateFin), aujourdHui: todayISO(), fichier: justifier ? fichier : null },
      {
        onSuccess: () => {
          setValeurs(VIERGE);
          setFichier(null);
          afficherToast("Absence enregistrée.", "success");
        },
        onError: (e) => afficherToast(messageErreur(e)),
      }
    );
  }

  return (
    <>
      <div className="entretien-add-row" role="group" aria-label="Ajouter une absence">
        <select aria-label="Type d'absence" value={valeurs.type} onChange={(e) => changer("type", e.target.value)}>
          {TYPES_ABSENCE.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <input type="date" aria-label="Début" placeholder="Début" value={valeurs.dateDebut} onChange={(e) => changer("dateDebut", e.target.value)} />
        <input type="date" aria-label="Fin" placeholder="Fin" value={valeurs.dateFin} onChange={(e) => changer("dateFin", e.target.value)} />
        <input type="text" aria-label="Commentaire" placeholder="Commentaire (optionnel)" style={{ flex: 1, minWidth: "140px" }} value={valeurs.commentaire} onChange={(e) => changer("commentaire", e.target.value)} />
        <button type="button" className="btn primary" disabled={gerer.ajouterAbsence.isPending} onClick={ajouter}>
          + Ajouter
        </button>
      </div>
      <div className="achat-salarie-zone" style={{ display: justifier ? "flex" : "none" }}>
        <ChoixFichier libelle="Joindre le document du médecin" sansNom onFichiers={(f) => setFichier(f[0] ?? null)} />
        <span className="card-sub">{fichier?.name ?? ""}</span>
      </div>
    </>
  );
}
