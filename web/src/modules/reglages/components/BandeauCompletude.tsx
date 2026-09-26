import { completudeSociete, messageManques, recommandationsSociete, type ValeursSociete } from "@/modules/societes/domain/societe";

/**
 * Ce qui manque à la fiche, recalculé à chaque frappe (SOC-06), au HTML de
 * `majCompletudeSociete` (app.js l. 12492) : le bandeau d'alerte ou de
 * réussite, puis les recommandations. Obligatoire et recommandé restent
 * séparés : les confondre, c'est ne plus savoir par quoi commencer.
 */
export function BandeauCompletude({ valeurs, piedDePage }: { valeurs: ValeursSociete; piedDePage: string }) {
  const manques = completudeSociete(valeurs);
  const conseils = recommandationsSociete(valeurs);
  return (
    <div id="ie_completude" style={{ marginTop: "12px" }} aria-live="polite">
      {manques.length ? <div className="wf-banner alerte">{messageManques(manques)}</div> : <div className="wf-banner ok">✓ Les mentions obligatoires de vos documents sont au complet.</div>}
      {conseils.length > 0 && (
        <div className="card-sub" style={{ marginTop: "6px" }}>
          Recommandé, sans être obligatoire : {conseils.map((c) => c.libelle).join(", ")}.
        </div>
      )}
      {/* Un pied de page personnalisé remplace l'identité légale : à dire quand elle est incomplète. */}
      {piedDePage.trim() !== "" && manques.length > 0 && (
        <div className="card-sub" style={{ marginTop: "6px", color: "var(--danger)" }}>
          Votre pied de page personnalisé remplace l&apos;identité légale sur les documents : les mentions ci-dessus n&apos;y figureront pas.
        </div>
      )}
    </div>
  );
}
