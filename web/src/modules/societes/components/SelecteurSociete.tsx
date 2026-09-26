import type { MouseEvent } from "react";
import { afficherToast } from "@/lib/toast";
import { ROLES_LIBELLES } from "@/modules/auth-roles/domain/permissions";
import { useSession } from "@/modules/auth-roles/hooks/useSession";

interface Props {
  /** `Desktop` dans la barre du haut large, `Mobile` sur téléphone — les identifiants de l'ancien écran, que sa feuille vise. */
  place: "Desktop" | "Mobile";
  ouvert: boolean;
  ouvrir: (e: MouseEvent) => void;
  fermer: () => void;
}

/**
 * Le nom de la société active, en haut à droite ; au clic, les sociétés du
 * compte (`optionsSocietesHTML`, app.js l. 173). Le sélecteur s'affiche même
 * avec une seule société : sinon on ne distingue pas « je n'ai accès qu'à une
 * société » de « le sélecteur est cassé ».
 */
export function SelecteurSociete({ place, ouvert, ouvrir, fermer }: Props) {
  const { etat, societeActive, choisirSociete } = useSession();
  if (etat.statut !== "connecte" || !societeActive) return null;
  const { societes } = etat.session;

  return (
    <div className="user-menu-wrap">
      <button type="button" className="societe-btn" onClick={ouvrir} title="Changer de société" aria-expanded={ouvert} aria-haspopup="menu">
        <span id={`companyLabel${place}`}>{societeActive.nom}</span>
        <span className="chev" aria-hidden="true">▾</span>
      </button>
      <div className={ouvert ? "user-menu user-menu--droite open" : "user-menu user-menu--droite"} id={`societeMenu${place}`}>
        {!societes.length ? (
          <div style={{ padding: "8px 12px", color: "var(--danger)", fontSize: "11.5px" }}>Aucune société rattachée à ce compte.</div>
        ) : (
          <>
            <div className="user-menu-section-title">Société</div>
            {societes.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  fermer();
                  if (s.id === societeActive.id) return;
                  choisirSociete(s.id);
                  // L'ancien écran l'annonçait ainsi (avec le ton d'un avertissement, son défaut).
                  afficherToast(`Chargement de ${s.nom}…`);
                }}
              >
                {s.id === societeActive.id ? "✓ " : ""}
                {s.nom}
                <small style={{ display: "block", color: "var(--text-dim)", fontSize: "10.5px" }}>
                  {s.code} · {ROLES_LIBELLES[s.role]}
                </small>
              </button>
            ))}
            {societes.length === 1 && (
              <div style={{ padding: "6px 12px", color: "var(--text-dim)", fontSize: "11px", lineHeight: 1.4 }}>
                Une seule société vous est rattachée. Pour en obtenir d'autres, un administrateur doit vous ajouter dans <b>membres_societe</b>.
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
