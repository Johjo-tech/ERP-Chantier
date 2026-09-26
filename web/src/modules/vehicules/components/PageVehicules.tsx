import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import { Chargement, Erreur } from "@/components/etats/Etats";
import { BarreRecherche } from "@/components/ui/barre-recherche";
import { formatDateFr } from "@/lib/dates";
import { Can } from "@/modules/auth-roles/components/Can";
import { nomPersonne } from "@/modules/materiel/domain/prets";
import { usePersonnes } from "@/modules/materiel/hooks/useMateriel";
import { useReglagesSociete } from "@/modules/societes/hooks/useSocieteReglages";
import { alertesVehicule, etiquetteEcheance, trierAlertes } from "../domain/echeances";
import { chercherVehicules, compterVehicules, filtrerVehicules, formatKm, libelleType, libelleVehicule, type FiltreVehicules, type Vehicule } from "../domain/vehicule";
import { useEcheancesDocuments, useVehicules } from "../hooks/useVehicules";
import { BlocEcheances } from "./BlocEcheances";

const FILTRES: readonly { cle: FiltreVehicules; libelle: string }[] = [
  { cle: "actifs", libelle: "En service" },
  { cle: "vendus", libelle: "Vendus" },
  { cle: "tous", libelle: "Tous" },
];

/**
 * Le parc (VEH-01), au HTML de `renderVehicules` / `renderVehiculeListeHTML`
 * (app.js l. 14923) : filtres `.vehicule-filtres`, barre de recherche, tableau
 * `.stats-table` dans `.vehicule-liste-wrap`, ligne entière cliquable.
 * Écarts décidés : le CT se lit dans `date_controle_technique` (l'ancien lisait
 * un `prochainCT` sans colonne, toujours « — ») et ses seuils viennent des
 * réglages (D-VEH-04) ; le bloc des échéances n'apparaît que s'il a à dire.
 */
export function PageVehicules() {
  const vehicules = useVehicules();
  const personnes = usePersonnes();
  const reglages = useReglagesSociete();
  const documents = useEcheancesDocuments();
  const [filtre, setFiltre] = useState<FiltreVehicules>("actifs");
  const [recherche, setRecherche] = useState("");
  const tous = useMemo(() => vehicules.data ?? [], [vehicules.data]);
  const seuils = reglages.data?.seuils;
  const conducteur = useMemo(() => {
    const annuaire = new Map((personnes.data ?? []).map((p) => [p.id, nomPersonne(p)]));
    return (v: { conducteur_salarie_id: string | null }) => (v.conducteur_salarie_id ? (annuaire.get(v.conducteur_salarie_id) ?? null) : null);
  }, [personnes.data]);
  const filtres = useMemo(() => filtrerVehicules(tous, filtre), [tous, filtre]);
  const liste = useMemo(() => chercherVehicules(filtres, recherche, conducteur), [filtres, recherche, conducteur]);
  const alertes = useMemo(() => (seuils ? trierAlertes(tous.flatMap((v) => alertesVehicule(v, seuils, documents.data ?? []))) : []), [tous, seuils, documents.data]);
  const compte = compterVehicules(tous);

  return (
    <>
      <div className="page-head">
        <h1>Véhicules</h1>
        <Can module="vehicules" action="creer">
          <Link className="btn primary" to="/vehicules/nouveau">
            + Nouveau véhicule
          </Link>
        </Can>
      </div>
      <BlocEcheances alertes={alertes} />
      <div className="vehicule-filtres" role="group" aria-label="Filtrer les véhicules">
        {FILTRES.map((f) => (
          <button key={f.cle} type="button" className={`btn small ${filtre === f.cle ? "primary" : ""}`} aria-pressed={filtre === f.cle} onClick={() => setFiltre(f.cle)}>
            {f.libelle} ({compte[f.cle]})
          </button>
        ))}
      </div>
      <BarreRecherche
        id="vehicule"
        libelle="Rechercher un véhicule"
        valeur={recherche}
        onChange={setRecherche}
        placeholder="Rechercher : immatriculation, marque, modèle, conducteur…"
        affiches={liste.length}
        total={filtres.length}
      />
      <div id="liste-vehicule">
        {vehicules.isPending && <Chargement />}
        {vehicules.isError && <Erreur erreur={vehicules.error} reessayer={() => void vehicules.refetch()} />}
        {vehicules.isSuccess && liste.length === 0 && (
          <div className="empty">{recherche.trim() ? "Aucun véhicule ne correspond à la recherche." : "Aucun véhicule dans cette catégorie."}</div>
        )}
        {liste.length > 0 && <TableauVehicules liste={liste} seuilCt={seuils?.vehiculeControle ?? null} conducteur={conducteur} />}
      </div>
    </>
  );
}

function TableauVehicules({ liste, seuilCt, conducteur }: { liste: readonly Vehicule[]; seuilCt: number | null; conducteur: (v: Vehicule) => string | null }) {
  const navigate = useNavigate();
  return (
    <div className="vehicule-liste-wrap">
      <table className="stats-table">
        <thead>
          <tr>
            <th>Véhicule</th>
            <th>Immatriculation</th>
            <th>Type</th>
            <th>Motorisation</th>
            <th>Pneus</th>
            <th>Kilométrage</th>
            <th>Contrôle technique</th>
            <th>Conducteur</th>
            <th>Statut</th>
          </tr>
        </thead>
        <tbody>
          {liste.map((v) => {
            const ct = seuilCt === null ? null : etiquetteEcheance(v.date_controle_technique, seuilCt, v.vendu);
            const ouvrir = () => void navigate(`/vehicules/${v.id}`);
            return (
              <tr
                key={v.id}
                className="vehicule-liste-row"
                tabIndex={0}
                aria-label={`Ouvrir ${libelleVehicule(v)}`}
                onClick={ouvrir}
                onKeyDown={(e) => {
                  if (e.key === "Enter") ouvrir();
                }}
              >
                <td>
                  <strong>{libelleVehicule(v)}</strong>
                </td>
                <td className="stats-num">{v.immatriculation || "—"}</td>
                <td>{libelleType(v.type_vehicule) || "—"}</td>
                <td>{v.motorisation || "—"}</td>
                <td>{v.taille_pneus || "—"}</td>
                <td className="stats-num">{formatKm(v.kilometrage)}</td>
                <td>
                  {v.date_controle_technique ? (
                    <>
                      {formatDateFr(v.date_controle_technique)} {ct && <span className="vehicule-ct-tag">{ct.texte}</span>}
                    </>
                  ) : (
                    "—"
                  )}
                </td>
                <td>{conducteur(v) ?? "—"}</td>
                <td>{v.vendu ? <span className="badge">Vendu</span> : <span className="badge success">En service</span>}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
