import type { ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { messageErreur } from "@/lib/erreurs";
import { afficherToast } from "@/lib/toast";
import { telechargerTexte } from "@/modules/articles/components/telechargement";
import { peut } from "@/modules/auth-roles/domain/permissions";
import { useSession } from "@/modules/auth-roles/hooks/useSession";
import { SectionComptes } from "@/modules/comptes/components/SectionComptes";
import { SectionAccesClients } from "@/modules/espace-client/components/SectionAccesClients";
import { useSauvegarde } from "@/modules/import-export/hooks/useImportExport";
import { rubriqueRetenue, rubriquesVisibles, type GroupeRubriques, type Rubrique } from "../domain/rubriques";
import { SectionDocuments } from "./SectionDocuments";
import { SectionDocumentsLegaux } from "./SectionDocumentsLegaux";
import { SectionIdentiteVisuelle } from "./SectionIdentiteVisuelle";
import { SectionIntervenants } from "./SectionIntervenants";
import { SectionListes } from "./SectionListes";
import { SectionMonCompte } from "./SectionMonCompte";
import { SectionNotifications } from "./SectionNotifications";
import { SectionNumerotation } from "./SectionNumerotation";
import { SectionOrganisation } from "./SectionOrganisation";
import { SectionSeuils } from "./SectionSeuils";

const SECTIONS: Record<string, () => ReactNode> = {
  organisation: () => <SectionOrganisation />,
  identite: () => <SectionIdentiteVisuelle />,
  legaux: () => <SectionDocumentsLegaux />,
  documents: () => <SectionDocuments />,
  numerotation: () => <SectionNumerotation />,
  listes: () => <SectionListes />,
  intervenants: () => <SectionIntervenants />,
  rh: () => <SectionSeuils domaine="rh" />,
  vehicules: () => <SectionSeuils domaine="vehicules" />,
  conduite: () => <SectionSeuils domaine="conduite" />,
  notifications: () => <SectionNotifications />,
  moncompte: () => <SectionMonCompte />,
  comptes: () => <SectionComptes />,
  "acces-clients": () => <SectionAccesClients />,
};

const telechargerJson = (nom: string, contenu: string) => telechargerTexte(nom, contenu, "application/json");

/**
 * « 💾 Sauvegarde de vos données », en tête des Réglages comme dans l'ancien
 * écran. L'export télécharge le fichier ; la sauvegarde ne se réimporte pas
 * par l'écran (elle est une archive, D-IMP) : « ⬆ Importer une sauvegarde »
 * mène à l'écran Import / export, qui dit ce qui s'importe (D-ECR-PAR-09).
 */
function CarteSauvegarde() {
  const sauvegarde = useSauvegarde(telechargerJson);
  return (
    <div className="card" style={{ borderColor: "var(--accent)", background: "var(--accent-soft)" }}>
      <div className="card-title" style={{ marginBottom: "4px" }}>
        💾 Sauvegarde de vos données
      </div>
      <div className="card-sub" style={{ marginBottom: "12px" }}>
        Si vous testez régulièrement une nouvelle version de l&apos;appli, vos données peuvent ne pas se conserver d&apos;une version à l&apos;autre. Exportez-les avant de changer de version, puis réimportez-les — vous ne perdrez plus
        rien.
      </div>
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
        <button
          type="button"
          className="btn primary"
          disabled={sauvegarde.isPending}
          onClick={() =>
            sauvegarde.mutate(undefined, {
              onSuccess: () => afficherToast("Sauvegarde téléchargée — gardez ce fichier en lieu sûr.", "success"),
              onError: (e) => afficherToast(`La sauvegarde n'a pas pu être créée : ${messageErreur(e)}`),
            })
          }
        >
          ⬇ Exporter mes données
        </button>
        <Link className="btn" to="/import-export" style={{ cursor: "pointer" }}>
          ⬆ Importer une sauvegarde
        </Link>
      </div>
    </div>
  );
}

/** `renderReglagesNav` (app.js l. 12371) : la liste déroulante du téléphone, le rail du bureau. */
function Navigation({ groupes, active }: { groupes: readonly GroupeRubriques[]; active: Rubrique | null }) {
  const navigate = useNavigate();
  const ouvrir = (id: string) => void navigate(`/reglages/${id}`);
  return (
    <>
      <select className="reglages-choix" aria-label="Rubrique des réglages" value={active?.id ?? ""} onChange={(e) => ouvrir(e.target.value)}>
        {groupes.map((g) => (
          <optgroup key={g.titre} label={g.titre}>
            {g.rubriques.map((r) => (
              <option key={r.id} value={r.id}>
                {r.icone} {r.libelle}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      <nav className="reglages-rail" aria-label="Rubriques des réglages">
        {groupes.map((g) => (
          <RailGroupe key={g.titre} groupe={g} active={active} ouvrir={ouvrir} />
        ))}
      </nav>
    </>
  );
}

function RailGroupe({ groupe, active, ouvrir }: { groupe: GroupeRubriques; active: Rubrique | null; ouvrir: (id: string) => void }) {
  return (
    <>
      <div className="reglages-groupe">{groupe.titre}</div>
      {groupe.rubriques.map((r) => (
        <button key={r.id} type="button" className={`reglages-lien ${r.id === active?.id ? "active" : ""}`} aria-current={r.id === active?.id ? "page" : undefined} onClick={() => ouvrir(r.id)}>
          <span className="reglages-lien-ico" aria-hidden="true">
            {r.icone}
          </span>
          <span className="reglages-lien-texte">
            {r.libelle}
            <span className="reglages-lien-desc">{r.description}</span>
          </span>
        </button>
      ))}
    </>
  );
}

/**
 * L'écran Réglages, au HTML de `renderParametres` (app.js l. 12282) : titre à
 * la société, carte de sauvegarde, `.reglages-layout` (rail + rubrique), et la
 * note sur la TVA en pied.
 */
export function PageReglages() {
  const { rubrique: demandee } = useParams();
  const { etat, roleEffectif, societeActive } = useSession();
  if (etat.statut !== "connecte") return null;
  const groupes = rubriquesVisibles((m) => peut(etat.session.matrice, roleEffectif, m, "voir"));
  const active = rubriqueRetenue(demandee, groupes);

  return (
    <>
      <div className="page-head">
        <h1>Réglages — {societeActive?.nom ?? ""}</h1>
      </div>
      <CarteSauvegarde />
      <div className="reglages-layout">
        <Navigation groupes={groupes} active={active} />
        <div id="reglagesContenu" role="region" aria-label={active?.libelle}>
          {active ? SECTIONS[active.id]?.() : <div className="empty">Aucune rubrique ne vous est ouverte.</div>}
        </div>
      </div>
      <footer className="note">
        Vérifiez le taux de TVA applicable selon la nature des travaux (une attestation du client est requise pour les taux réduits de 5,5 % et 10 % sur des logements de plus de 2 ans).
      </footer>
    </>
  );
}
