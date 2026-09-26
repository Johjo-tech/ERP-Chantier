import type { CSSProperties, ReactNode } from "react";
import { formatDateFr } from "@/lib/dates";
import { nomEmprunteur, trierPrets, type PersonneAnnuaire, type PretBase } from "../domain/prets";

interface Props<P extends PretBase> {
  prets: readonly P[];
  personnes: readonly PersonneAnnuaire[];
  etatAuPret: (p: P) => string | null;
  modifiable: boolean;
  onSupprimer: (id: string) => void;
  /** Ce qu'un véhicule ajoute à la date : « · ⚠ 2 nouvelle(s) marque(s) au retour ». */
  suiteDate?: (p: P) => string;
  /** Ce qu'un véhicule ajoute avant « ✕ » : les boutons de l'état au départ et au retour. */
  boutons?: (p: P) => ReactNode;
  /** Et après : le schéma ouvert, sur toute la largeur. */
  dessous?: (p: P) => ReactNode;
}

const GRIS = "#8C8C8C";
const ORANGE = "#F0A82E";

/**
 * L'historique des prêts, au HTML de l'ancien écran (`.achats-list` de
 * `.achat-row`, app.js l. 14806) : le plus récent d'abord, pastille grise pour
 * un prêt rendu, orangée pour un prêt en cours. La suppression demande
 * confirmation (D-VEH-07 ; l'ancien retirait sans rien demander).
 */
export function HistoriquePrets<P extends PretBase>({ prets, personnes, etatAuPret, modifiable, onSupprimer, suiteDate, boutons, dessous }: Props<P>) {
  return (
    <div className="achats-list" style={{ marginTop: "14px" }} aria-label="Historique des prêts">
      {prets.length ? (
        trierPrets(prets).map((p) => {
          const couleur = p.date_fin ? GRIS : ORANGE;
          const ligne = { "--cat-color": couleur, flexWrap: boutons ? "wrap" : undefined } as CSSProperties;
          return (
            <div key={p.id} className="achat-row" style={ligne}>
              <div className="achat-row-icon" style={{ background: `${couleur}22`, color: couleur }}>
                📦
              </div>
              <div className="achat-row-main">
                <div className="achat-designation">
                  {nomEmprunteur(p, personnes)} <span className="card-sub">— état au prêt : {etatAuPret(p) || "—"}</span>
                </div>
                <div className="achat-date">
                  Du {formatDateFr(p.date_debut)}
                  {p.duree_jours != null && ` · prévu ${p.duree_jours} j`}
                  {p.date_fin ? ` · rendu le ${formatDateFr(p.date_fin)}` : " · en cours"}
                  {suiteDate?.(p)}
                </div>
              </div>
              {boutons?.(p)}
              {modifiable && (
                <button
                  type="button"
                  className="btn small danger"
                  aria-label="Supprimer ce prêt"
                  onClick={() => {
                    if (window.confirm("Supprimer ce prêt de l'historique ?")) onSupprimer(p.id);
                  }}
                >
                  ✕
                </button>
              )}
              {dessous?.(p)}
            </div>
          );
        })
      ) : (
        <div className="empty">Aucun prêt enregistré pour l&apos;instant.</div>
      )}
    </div>
  );
}
