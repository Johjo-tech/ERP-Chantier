import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import { Chargement, Erreur } from "@/components/etats/Etats";
import { formatDateFr } from "@/lib/dates";
import { Can } from "@/modules/auth-roles/components/Can";
import { filtrerMateriels, type Materiel } from "../domain/materiel";
import { nomEmprunteur, pretEnCours, retourPrevu, type PersonneAnnuaire } from "../domain/prets";
import { useMateriels, usePersonnes } from "../hooks/useMateriel";

/**
 * L'inventaire du matériel (VEH-05), au HTML de `renderMateriel` /
 * `renderMaterielListeHTML` (app.js l. 14655) : le champ de recherche nu de
 * l'ancien (pas la `.barre-recherche` des autres listes), le tableau
 * `.stats-table` dans `.vehicule-liste-wrap`, la ligne entière cliquable.
 * Seul écart : un prêt en cours se voit (« En prêt »), l'ancien perdait ses
 * prêts au rechargement (D-VEH-01).
 */
export function PageMateriel() {
  const materiels = useMateriels();
  const personnes = usePersonnes();
  const [recherche, setRecherche] = useState("");
  const liste = useMemo(() => filtrerMateriels(materiels.data ?? [], recherche), [materiels.data, recherche]);

  return (
    <>
      <div className="page-head">
        <h1>Matériel</h1>
        <Can module="materiel" action="creer">
          <Link className="btn primary" to="/materiel/nouveau">
            + Nouveau matériel
          </Link>
        </Can>
      </div>
      <div style={{ display: "flex", gap: "10px", marginBottom: "18px" }}>
        <label htmlFor="recherche-materiel" className="sr-only">
          Rechercher du matériel
        </label>
        <input
          id="recherche-materiel"
          type="text"
          style={{ flex: 1, minWidth: "220px" }}
          placeholder="Rechercher : nom, catégorie…"
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
        />
      </div>
      {materiels.isPending && <Chargement />}
      {materiels.isError && <Erreur erreur={materiels.error} reessayer={() => void materiels.refetch()} />}
      {/* L'ancien disait « pour l'instant » même quand la recherche écartait tout : repris tel quel. */}
      {materiels.isSuccess && liste.length === 0 && <div className="empty">Aucun matériel pour l&apos;instant.</div>}
      {liste.length > 0 && <TableauMateriel liste={liste} annuaire={personnes.data ?? []} />}
    </>
  );
}

function TableauMateriel({ liste, annuaire }: { liste: readonly Materiel[]; annuaire: readonly PersonneAnnuaire[] }) {
  const navigate = useNavigate();
  return (
    <div className="vehicule-liste-wrap">
      <table className="stats-table">
        <thead>
          <tr>
            <th>Matériel</th>
            <th>Catégorie</th>
            <th>État</th>
            <th>Statut</th>
            <th>Emprunteur</th>
            <th>Depuis / jusqu&apos;au</th>
          </tr>
        </thead>
        <tbody>
          {liste.map((m) => {
            const pret = pretEnCours(m.prets);
            const prevu = pret ? retourPrevu(pret) : null;
            const ouvrir = () => void navigate(`/materiel/${m.id}`);
            return (
              <tr
                key={m.id}
                className="vehicule-liste-row"
                tabIndex={0}
                aria-label={`Ouvrir ${m.nom}`}
                onClick={ouvrir}
                onKeyDown={(e) => {
                  if (e.key === "Enter") ouvrir();
                }}
              >
                <td>
                  <strong>{m.nom}</strong>
                </td>
                <td>{m.categorie || "—"}</td>
                <td>{m.etat_general || "—"}</td>
                <td>{pret ? <span className="badge warn">En prêt</span> : <span className="badge success">Disponible</span>}</td>
                <td>{pret ? nomEmprunteur(pret, annuaire) : "—"}</td>
                <td className="card-sub">{pret ? `Depuis le ${formatDateFr(pret.date_debut)}${prevu ? ` · retour prévu ${formatDateFr(prevu)}` : ""}` : "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
