import type { ReactNode } from "react";
import type { LectureFichier } from "../domain/import";
import { useCodesExistants } from "../hooks/useArticles";

/** Ce qu'on montre d'un fichier avant d'écrire, comme l'ancien : assez pour juger, pas mille lignes. */
const APERCU = { rejets: 8, signalements: 6 } as const;

interface Props {
  nom: string;
  lecture: LectureFichier;
  onImporter: () => void;
  onRapport: () => void;
  retour: ReactNode;
}

function Chiffre({ valeur, libelle, couleur }: { valeur: number | string; libelle: string; couleur?: string | undefined }) {
  return (
    <div>
      <div className="hero-stat-value" style={couleur ? { color: couleur } : { color: "inherit" }}>
        {valeur}
      </div>
      <div className="card-sub">{libelle}</div>
    </div>
  );
}

const LISTE = { margin: 0, paddingLeft: "18px" } as const;
const TITRE = { fontWeight: 700, marginBottom: "6px" } as const;

/** L'aperçu de l'ancien (`importCatalogueHTML`, étape « apercu »). */
export function ApercuImport({ nom, lecture, onImporter, onRapport, retour }: Props) {
  const existants = useCodesExistants(lecture.articles.map((a) => a.code));
  const aMettreAJour = existants.data ? lecture.articles.filter((a) => existants.data.has(a.code)).length : null;
  const n = lecture.articles.length;
  const { rejets, signalements } = lecture;

  return (
    <section aria-label={`Aperçu de ${nom}`} className="form-panel">
      <h3>{nom}</h3>
      <div style={{ display: "flex", gap: "18px", flexWrap: "wrap", margin: "14px 0" }}>
        <Chiffre valeur={aMettreAJour === null ? "…" : n - aMettreAJour} libelle="à créer" />
        <Chiffre valeur={aMettreAJour ?? "…"} libelle="à mettre à jour" />
        <Chiffre valeur={rejets.length} libelle="rejetés" couleur={rejets.length ? "var(--danger)" : undefined} />
        <Chiffre valeur={signalements.length} libelle="signalés" couleur={signalements.length ? "#C24E00" : undefined} />
      </div>
      {rejets.length > 0 && (
        <div className="wf-banner alerte">
          <div style={TITRE}>Lignes écartées</div>
          <ul style={LISTE}>
            {rejets.slice(0, APERCU.rejets).map((r) => (
              <li key={`${r.ligne}-${r.motif}`}>
                Ligne {r.ligne} — {r.motif}
              </li>
            ))}
          </ul>
          {rejets.length > APERCU.rejets && (
            <div className="card-sub" style={{ marginTop: "6px" }}>
              …et {rejets.length - APERCU.rejets} autres, dans le rapport.
            </div>
          )}
        </div>
      )}
      {signalements.length > 0 && (
        <div className="wf-banner" style={{ marginTop: "10px" }}>
          <div style={TITRE}>Décidé à la place du fichier</div>
          <ul style={LISTE}>
            {signalements.slice(0, APERCU.signalements).map((s) => (
              <li key={`${s.ligne}-${s.code ?? ""}-${s.motif}`}>
                Ligne {s.ligne}
                {s.code ? ` (${s.code})` : ""} — {s.motif}
              </li>
            ))}
          </ul>
          {signalements.length > APERCU.signalements && (
            <div className="card-sub" style={{ marginTop: "6px" }}>
              …et {signalements.length - APERCU.signalements} autres.
            </div>
          )}
        </div>
      )}
      <div style={{ display: "flex", gap: "10px", marginTop: "16px", flexWrap: "wrap" }}>
        <button type="button" className="btn primary" disabled={n === 0} onClick={onImporter}>
          Importer {n} article{n > 1 ? "s" : ""}
        </button>
        {(rejets.length > 0 || signalements.length > 0) && (
          <button type="button" className="btn" onClick={onRapport}>
            📄 Rapport
          </button>
        )}
        {retour}
      </div>
    </section>
  );
}
