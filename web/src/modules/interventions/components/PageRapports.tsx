import { Link } from "react-router";
import { Chargement, Erreur, Vide } from "@/components/etats/Etats";
import { EnTetePage } from "@/components/page/EnTetePage";
import { useFiltresAdresse } from "@/lib/useFiltresAdresse";
import { useMessageNavigation } from "@/lib/useMessageNavigation";
import { Can } from "@/modules/auth-roles/components/Can";
import { useSession } from "@/modules/auth-roles/hooks/useSession";
import { useConducteurs } from "@/modules/societes/hooks/useConducteurs";
import { filtrerRapports } from "../domain/rapport";
import { useBonsLiables, useRapports } from "../hooks/useRapports";
import { CarteRapport } from "./CarteRapport";

const FILTRES = { recherche: "", conducteur: "", logement: "" };

/**
 * Rapports / recherche de fuite (`renderInterventions`, PLN-20) : recherche
 * multi-mots, conducteur, logement. Comme l'ancien écran, l'équipe interne ne
 * voit que les rapports internes ; le sous-traitant, les siens — la base les
 * lui filtre (proposition 20260926052000, PLN-52, D-ECR-PLN-01).
 */
export function PageRapports() {
  const conducteurs = useConducteurs();
  const { filtres, changer } = useFiltresAdresse(FILTRES);
  // `conducteurFilterOptions` : les fiches actives, plus celle déjà choisie, par nom.
  const optionsConducteurs = (conducteurs.data ?? [])
    .filter((c) => c.actif || c.nom === filtres.conducteur)
    .map((c) => c.nom)
    .sort((a, b) => a.localeCompare(b));
  // Le message d'un enregistrement arrive par la navigation : il se dit dans la bulle de l'ancien, une fois.
  useMessageNavigation();

  return (
    <>
      <EnTetePage
        titre="Rapports / recherche de fuite"
        actions={
          <Can module="rapports" action="creer">
            <Link className="btn primary" to="/rapports/nouveau">+ Nouveau rapport</Link>
          </Can>
        }
      />
      <div style={{ display: "flex", gap: "10px", marginBottom: "16px", flexWrap: "wrap" }}>
        <input
          type="text"
          id="interventionSearchInput"
          aria-label="Rechercher"
          style={{ flex: 1, minWidth: "220px" }}
          value={filtres.recherche}
          placeholder="Rechercher"
          onChange={(e) => changer({ ...filtres, recherche: e.target.value })}
        />
        <select aria-label="Conducteur" style={{ width: "auto", minWidth: "180px" }} value={filtres.conducteur} onChange={(e) => changer({ ...filtres, conducteur: e.target.value })}>
          <option value="">Tous les conducteurs</option>
          {optionsConducteurs.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select aria-label="Logement" style={{ width: "auto", minWidth: "170px" }} value={filtres.logement} onChange={(e) => changer({ ...filtres, logement: e.target.value })}>
          <option value="">Tous les logements</option>
          <option value="occupé">🏠 Logement occupé</option>
          <option value="vacant">🔑 Logement vacant</option>
          <option value="commune">🚪 Partie commune</option>
        </select>
      </div>
      <ListeRapports filtres={filtres} />
    </>
  );
}

/**
 * `#interventionListZone` : les cartes, filtrées. L'ancien écran la laissait
 * sous l'assistant ouvert — la page d'un rapport la reprend donc aussi.
 */
export function ListeRapports({ filtres = FILTRES }: { filtres?: typeof FILTRES }) {
  const rapports = useRapports();
  const bons = useBonsLiables();
  const { roleEffectif } = useSession();
  const emetteur = roleEffectif === "sous_traitant" ? "tous" : "internes";
  const liste = filtrerRapports(rapports.data ?? [], { ...filtres, emetteur });
  const numeroDuBon = (id: string | null) => {
    const bon = id ? bons.data?.find((b) => b.id === id) : undefined;
    return bon ? (bon.numero_bc ?? "") : null;
  };
  return (
    <div id="interventionListZone">
      {rapports.isPending && <Chargement />}
      {rapports.isError && <Erreur erreur={rapports.error} reessayer={() => void rapports.refetch()} />}
      {rapports.isSuccess && !liste.length && <Vide message="Aucun rapport pour cette société." />}
      {liste.map((r) => <CarteRapport key={r.id} r={r} numeroBon={numeroDuBon(r.bon_commande_id)} />)}
    </div>
  );
}
