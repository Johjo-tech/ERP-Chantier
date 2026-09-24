import { Alert } from "@/components/ui/alert";
import { messageErreur } from "@/lib/erreurs";
import type { ResultatImport as Resultat } from "../api/articles";

export function ResultatImport({ resultat }: { resultat: Resultat }) {
  const { crees, misAJour, echecs } = resultat;
  const refuses = echecs.reduce((n, e) => n + e.codes.length, 0);
  return (
    <div className="flex flex-col gap-3">
      <Alert variant={echecs.length ? "info" : "succes"}>
        <span className="font-semibold">Import terminé</span> — {crees} créé(s), {misAJour} mis à jour, {refuses} en échec.
      </Alert>
      {echecs.length > 0 && (
        <Alert variant="erreur">
          <p className="font-semibold">{echecs.length} lot(s) refusé(s) — les autres ont bien été écrits.</p>
          <ul className="list-disc pl-5">
            {echecs.map((e) => (
              <li key={e.codes[0] ?? ""}>
                {messageErreur(e.erreur)} <span className="text-xs">({e.codes.length} article(s), de {e.codes[0]} à {e.codes.at(-1)})</span>
              </li>
            ))}
          </ul>
        </Alert>
      )}
    </div>
  );
}
