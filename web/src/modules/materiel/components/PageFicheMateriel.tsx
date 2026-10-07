import { Link, useNavigate, useParams } from "react-router";
import { Chargement, Erreur } from "@/components/etats/Etats";
import { formatDateFr } from "@/lib/dates";
import { Can } from "@/modules/auth-roles/components/Can";
import { GardeSociete } from "@/modules/societes/components/GardeSociete";
import { pretEnCours } from "../domain/prets";
import { useMateriel, useSupprimerMateriel } from "../hooks/useMateriel";
import { BlocPretsMateriel } from "./BlocPretsMateriel";
import { useToastErreur } from "./communs";
import { Info } from "./Info";

/**
 * La fiche d'un matériel, au HTML de `renderMaterielDetail` (app.js l. 14776) :
 * en-tête avec « ← Retour au matériel », le bandeau `.vehicule-hero`, puis les
 * prêts. La suppression passe par la même question que l'ancien.
 */
export function PageFicheMateriel() {
  const { id } = useParams();
  const materiel = useMateriel(id);
  const supprimer = useSupprimerMateriel(id ?? "");
  const navigate = useNavigate();
  useToastErreur(supprimer.error);

  if (materiel.isPending) return <Chargement />;
  if (materiel.isError) return <Erreur erreur={materiel.error} reessayer={() => void materiel.refetch()} />;
  const m = materiel.data;

  return (
    <GardeSociete societeId={m.societe_id} retour="/materiel">
      {/* L'ancien écran pose la fiche SOUS l'en-tête du module, privé de son bouton (app.js l. 14672). */}
      <div className="page-head">
        <h1>Matériel</h1>
      </div>
      <div className="page-head">
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          <Link className="btn small" to="/materiel">
            ← Retour au matériel
          </Link>
          <h1 style={{ margin: 0 }}>{m.nom}</h1>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <Can module="materiel" action="modifier">
            <Link className="btn" to={`/materiel/${m.id}/modifier`}>
              Modifier
            </Link>
          </Can>
          <Can module="materiel" action="supprimer">
            <button
              type="button"
              className="btn danger"
              disabled={supprimer.isPending}
              onClick={() => {
                if (!window.confirm("Supprimer ce matériel et tout son historique de prêt ?")) return;
                supprimer.mutate(undefined, { onSuccess: () => void navigate("/materiel") });
              }}
            >
              Supprimer
            </button>
          </Can>
        </div>
      </div>
      <div className="vehicule-hero">
        <div className="vehicule-hero-grid">
          <Info libelle="Catégorie">{m.categorie || "—"}</Info>
          <Info libelle="État général">{m.etat_general || "—"}</Info>
          <Info libelle="N° de série">{m.numero_serie || "—"}</Info>
          <Info libelle="Date d'achat">{m.date_achat ? formatDateFr(m.date_achat) : "—"}</Info>
          <Info libelle="Statut">{pretEnCours(m.prets) ? <span className="badge warn">En prêt</span> : <span className="badge success">Disponible</span>}</Info>
        </div>
      </div>
      <BlocPretsMateriel materiel={m} />
    </GardeSociete>
  );
}
