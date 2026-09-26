import { Link, useNavigate, useParams } from "react-router";
import { Chargement, Erreur } from "@/components/etats/Etats";
import { formatDateFr } from "@/lib/dates";
import { Can } from "@/modules/auth-roles/components/Can";
import { useToastErreur } from "@/modules/materiel/components/communs";
import { Info } from "@/modules/materiel/components/Info";
import { nomPersonne } from "@/modules/materiel/domain/prets";
import { usePersonnes } from "@/modules/materiel/hooks/useMateriel";
import { GardeSociete } from "@/modules/societes/components/GardeSociete";
import { useReglagesSociete } from "@/modules/societes/hooks/useSocieteReglages";
import { etiquetteEcheance } from "../domain/echeances";
import { formatKm, libelleType, libelleVehicule, type Vehicule } from "../domain/vehicule";
import { useSupprimerVehicule, useVehicule } from "../hooks/useVehicules";
import { BlocAbonnements } from "./BlocAbonnements";
import { BlocDocuments } from "./BlocDocuments";
import { BlocEntretiens } from "./BlocEntretiens";
import { BlocPretsVehicule } from "./BlocPretsVehicule";

/** Le bandeau `.vehicule-hero` de l'ancienne fiche (app.js l. 15003), mêmes neuf cases. */
function Identite({ v }: { v: Vehicule }) {
  const personnes = usePersonnes();
  const reglages = useReglagesSociete();
  const conducteur = (personnes.data ?? []).find((p) => p.id === v.conducteur_salarie_id);
  const seuil = reglages.data?.seuils.vehiculeControle;
  const ct = seuil === undefined ? null : etiquetteEcheance(v.date_controle_technique, seuil);
  return (
    <div className="vehicule-hero">
      <div className="vehicule-hero-grid">
        <Info libelle="Type">{libelleType(v.type_vehicule) || "—"}</Info>
        <Info libelle="Conducteur attitré">{conducteur ? nomPersonne(conducteur) : "Sans conducteur"}</Info>
        <Info libelle="Immatriculation">{v.immatriculation || "—"}</Info>
        <Info libelle="TVA">{v.tva_applicable === false ? "Sans TVA" : "Avec TVA"}</Info>
        <Info libelle="Motorisation">{v.motorisation || "—"}</Info>
        <Info libelle="Taille de pneus">{v.taille_pneus || "—"}</Info>
        <Info libelle="Kilométrage">{formatKm(v.kilometrage)}</Info>
        <Info libelle="Date d'achat">{v.date_achat ? formatDateFr(v.date_achat) : "—"}</Info>
        <Info libelle="Contrôle technique">
          {v.date_controle_technique ? formatDateFr(v.date_controle_technique) : "—"}{" "}
          {ct && <span className={`badge ${ct.niveau === "danger" ? "danger" : "warn"}`}>{ct.niveau === "danger" ? "Expiré" : "Bientôt"}</span>}
        </Info>
      </div>
    </div>
  );
}

/**
 * La fiche d'un véhicule (VEH-01), au HTML de `renderVehiculeDetail` (app.js
 * l. 14990) : en-tête, bandeau, puis `.chantier-sections` — facture d'achat,
 * abonnements et vente, prêts, entretiens. « Supprimer » est un ajout décidé
 * (D-VEH-07), dans le style du bouton de la fiche matériel.
 */
export function PageFicheVehicule() {
  const { id } = useParams();
  const vehicule = useVehicule(id);
  const supprimer = useSupprimerVehicule(id ?? "");
  const navigate = useNavigate();
  useToastErreur(supprimer.error);

  if (vehicule.isPending) return <Chargement />;
  if (vehicule.isError) return <Erreur erreur={vehicule.error} reessayer={() => void vehicule.refetch()} />;
  const v = vehicule.data;

  return (
    <GardeSociete societeId={v.societe_id} retour="/vehicules">
      {/* L'ancien écran pose la fiche SOUS l'en-tête du module, privé de son bouton (app.js l. 14940). */}
      <div className="page-head">
        <h1>Véhicules</h1>
      </div>
      <div className="page-head">
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          <Link className="btn small" to="/vehicules">
            ← Retour aux véhicules
          </Link>
          <h1 style={{ margin: 0 }}>{libelleVehicule(v)}</h1>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <Can module="vehicules" action="modifier">
            <Link className="btn" to={`/vehicules/${v.id}/modifier`}>
              Modifier
            </Link>
          </Can>
          <Can module="vehicules" action="supprimer">
            <button
              type="button"
              className="btn danger"
              disabled={supprimer.isPending}
              onClick={() => {
                if (window.confirm("Supprimer ce véhicule, ses prêts, ses entretiens et ses documents ?")) supprimer.mutate(undefined, { onSuccess: () => void navigate("/vehicules") });
              }}
            >
              Supprimer
            </button>
          </Can>
        </div>
      </div>
      <Identite v={v} />
      <div className="chantier-sections">
        <BlocDocuments vehicule={v} />
        <BlocAbonnements vehicule={v} />
        <BlocPretsVehicule vehicule={v} />
        <BlocEntretiens vehicule={v} />
      </div>
    </GardeSociete>
  );
}
