import { useQueryClient } from "@tanstack/react-query";
import { useEchecsDeLecture } from "./cadre/echecs";

/**
 * « Certaines données n'ont pas pu être chargées » (`signalerEchecsDeChargement`,
 * app.js l. 555) : une lecture en échec ne doit pas passer pour une base vide.
 * L'ancien écran le disait par un bandeau en haut de page ; chaque écran de la
 * nouvelle application affiche aussi son erreur, mais le bandeau reste — il
 * voit les lectures des écrans qu'on n'a pas sous les yeux (compteurs, cloche).
 *
 * La session expirée n'a pas de bandeau ici : elle ramène à la connexion avec
 * son motif (AUTH-10).
 */
export function BandeauEchecLecture() {
  const qc = useQueryClient();
  const sources = useEchecsDeLecture();
  if (!sources) return null;
  return (
    <div id="bandeauEchecLecture" role="alert" className="bandeau-alerte">
      <span>
        ⚠ <b>Certaines données n'ont pas pu être chargées</b> ({sources}). Ce que vous voyez est incomplet — ne vous y fiez pas pour décider.
      </span>
      <button type="button" className="btn small" onClick={() => void qc.refetchQueries({ predicate: (q) => q.state.status === "error" })}>
        Réessayer
      </button>
    </div>
  );
}
