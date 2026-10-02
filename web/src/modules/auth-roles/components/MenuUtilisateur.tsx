import type { MouseEvent } from "react";
import { useNavigate } from "react-router";
import { afficherToast } from "@/lib/toast";
import { ROLES_LIBELLES, peutSimuler, type RoleMembre } from "../domain/permissions";
import { useSession } from "../hooks/useSession";
import { VersionConstruite } from "./VersionConstruite";

/**
 * « Voir en tant que » de l'ancien menu (`renderUserMenu`, app.js l. 209) :
 * l'ordre, les pictogrammes et les libellés sont les siens. L'administrateur
 * se choisit lui-même pour revenir à son rôle.
 */
const ROLES_SIMULABLES: readonly [RoleMembre, string][] = [
  ["admin", "👑 Administrateur"],
  ["secretaire", "📋 Secrétaire"],
  ["conducteur", "🦺 Conducteur de travaux"],
  ["technicien", "🔧 Technicien"],
  ["sous_traitant", "🏗️ Sous-traitant"],
  ["lecture", "👀 Lecture seule"],
];

interface Props {
  /** `Desktop` dans le menu latéral, `Mobile` dans la barre du haut — les identifiants de l'ancien écran. */
  place: "Desktop" | "Mobile";
  ouvert: boolean;
  ouvrir: (e: MouseEvent) => void;
  fermer: () => void;
}

/**
 * Le nom du compte et son rôle ; au clic, « Voir en tant que » (administrateur
 * seulement), « Mon compte », la déconnexion et la version construite. Même
 * HTML que l'ancien (`.user-menu-wrap`), en haut du menu latéral et de la
 * barre du haut sur téléphone.
 */
export function MenuUtilisateur({ place, ouvert, ouvrir, fermer }: Props) {
  const { etat, roleReel, roleEffectif, simulerRole, deconnecter } = useSession();
  const naviguer = useNavigate();
  if (etat.statut !== "connecte") return null;
  const { utilisateur } = etat.session;
  const libelleRole = roleEffectif ? ROLES_LIBELLES[roleEffectif] : "Sans rôle";

  return (
    <div className="user-menu-wrap">
      <button type="button" className="brand user-menu-btn" onClick={ouvrir} aria-expanded={ouvert} aria-haspopup="menu">
        <span className="brand-dot" />
        <span className="user-menu-name" title={utilisateur.email}>
          {utilisateur.nom}
          <span className="role-badge" id={`roleBadge${place}`}>{libelleRole}</span>
        </span>
        <span className="user-menu-chevron" aria-hidden="true">▾</span>
      </button>
      <div className={ouvert ? "user-menu open" : "user-menu"} id={place === "Desktop" ? "userMenu" : "userMenuMobile"}>
        <div id={place === "Desktop" ? "userMenuRoles" : "userMenuRolesMobile"}>
          {peutSimuler(roleReel) && (
            <>
              <div className="user-menu-section-title">Voir en tant que</div>
              {ROLES_SIMULABLES.map(([role, libelle]) => (
                <button
                  key={role}
                  type="button"
                  onClick={() => {
                    simulerRole(role === "admin" ? null : role);
                    fermer();
                  }}
                >
                  {roleEffectif === role ? "✓ " : ""}
                  {libelle}
                </button>
              ))}
            </>
          )}
        </div>
        <div className="user-menu-sep" />
        {/* « Mon compte » : ouvert à tous les rôles (AUTH-17, D-SOC-06) — l'ancien le rangeait sous Réglages, que tous ne voient pas. */}
        <button
          type="button"
          onClick={() => {
            fermer();
            void naviguer("/mon-compte");
          }}
        >
          Mon compte
        </button>
        <button
          type="button"
          onClick={() => {
            fermer();
            deconnecter().catch((e: unknown) => {
              console.error("Déconnexion impossible", e);
              afficherToast("Déconnexion impossible — réessayez.");
            });
          }}
        >
          Se déconnecter
        </button>
        <VersionConstruite />
      </div>
    </div>
  );
}
