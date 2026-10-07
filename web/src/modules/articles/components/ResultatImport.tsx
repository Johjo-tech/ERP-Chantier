import type { ReactNode } from "react";
import { messageErreur } from "@/lib/erreurs";
import type { ResultatImport as Resultat } from "../api/articles";

const pluriel = (n: number) => (n > 1 ? "s" : "");

/** La fin de l'import, au HTML de l'ancien (`importCatalogueHTML`, étape « termine »). */
export function ResultatImport({ resultat, rapport, retour }: { resultat: Resultat; rapport: (() => void) | null; retour: ReactNode }) {
  const { crees, misAJour, echecs } = resultat;
  return (
    <div className="form-panel">
      <div role="status" className="wf-banner ok">
        <b>Import terminé</b> — {crees} créé{pluriel(crees)}, {misAJour} mis à jour.
      </div>
      {echecs.length > 0 && (
        <div role="alert" className="wf-banner alerte" style={{ marginTop: "10px" }}>
          <div style={{ fontWeight: 700 }}>
            {echecs.length} lot{pluriel(echecs.length)} refusé{pluriel(echecs.length)}
          </div>
          <ul style={{ margin: 0, paddingLeft: "18px" }}>
            {echecs.map((e) => (
              <li key={e.codes[0] ?? ""}>
                {messageErreur(e.erreur)} <span className="card-sub">({e.codes.length} article(s))</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div style={{ display: "flex", gap: "10px", marginTop: "16px" }}>
        {rapport && (
          <button type="button" className="btn" onClick={rapport}>
            📄 Rapport
          </button>
        )}
        {retour}
      </div>
    </div>
  );
}
