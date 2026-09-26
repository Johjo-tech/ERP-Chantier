import { useLocation, useNavigate } from "react-router";
import { useComptesFacturation } from "../hooks/useComptesFacturation";

/** Les files du circuit : une seule adresse chacune, que le tableau de bord et les notifications ouvrent aussi. */
export const FILE_VALIDATION = "/facturation/validation";
export const FILE_A_FACTURER = "/facturation/a-facturer";

/** « Avoirs (8) » : le compte suit le libellé, et disparaît à zéro (`renderFactures`, app.js l. 5205). */
const compte = (n: number) => (n ? ` (${n})` : "");

/**
 * Les sous-onglets de Facturation (FAC-01, `renderFactures`) : Factures,
 * Avoirs, Validation, À facturer, Règlements — centrés, EN TÊTE de l'écran,
 * avec le compte de chaque file. Un onglet dont le rôle ne voit pas le contenu
 * (bons, règlements) ne s'affiche pas : la base le refuserait (D-ECR-FAC-01).
 */
export function OngletsFacturation() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const n = useComptesFacturation();
  const onglets = [
    { chemin: "/factures", libelle: "Factures" },
    { chemin: "/factures/avoirs", libelle: `Avoirs${compte(n.avoirs)}` },
    ...(n.voitBons ? [{ chemin: FILE_VALIDATION, libelle: `Validation${compte(n.enValidation)}` }, { chemin: FILE_A_FACTURER, libelle: `À facturer${compte(n.aFacturer)}` }] : []),
    ...(n.voitReglements ? [{ chemin: "/factures/reglements", libelle: "Règlements" }] : []),
  ];
  return <BarreOnglets onglets={onglets} actif={ongletActif(pathname, onglets.map((o) => o.chemin))} aller={(c) => void navigate(c)} />;
}

/**
 * L'onglet allumé : celui dont l'adresse est la plus longue à préfixer la
 * page — la fiche d'une facture reste sous « Factures », un dossier client
 * sous « Règlements », comme le formulaire de l'ancien restait dans sa vue.
 */
function ongletActif(pathname: string, chemins: readonly string[]): string | null {
  const exact = chemins.find((c) => c === pathname);
  if (exact) return exact;
  if (pathname.startsWith("/factures/reglements")) return "/factures/reglements";
  if (pathname.startsWith("/factures/") || pathname.startsWith("/chantiers/")) return "/factures";
  return null;
}

/**
 * De VRAIS boutons, comme l'ancien (`<button class="plus-subnav-btn">`) : un
 * lien ne centre pas son libellé sur deux lignes, et « À facturer » se lisait
 * en haut à gauche de sa case sur téléphone. `aria-current` dit lequel est ouvert.
 */
function BarreOnglets({ onglets, actif, aller }: { onglets: readonly { chemin: string; libelle: string }[]; actif: string | null; aller: (chemin: string) => void }) {
  return (
    <nav aria-label="Facturation" className="plus-subnav" style={{ justifyContent: "center" }}>
      {onglets.map((o) => (
        <button key={o.chemin} type="button" className={o.chemin === actif ? "plus-subnav-btn active" : "plus-subnav-btn"} aria-current={o.chemin === actif ? "page" : undefined} onClick={() => aller(o.chemin)}>
          {o.libelle}
        </button>
      ))}
    </nav>
  );
}
