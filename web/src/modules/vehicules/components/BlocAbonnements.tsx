import { useState } from "react";
import { Link } from "react-router";
import { formatDateFr } from "@/lib/dates";
import { montant } from "@/lib/money";
import { formatEurosEcran, useModeDiscret } from "@/lib/modeDiscret";
import { usePermission, useVoitLesPrix } from "@/modules/auth-roles/hooks/useSession";
import { useReglagesSociete } from "@/modules/societes/hooks/useSocieteReglages";
import { etiquetteEcheance } from "../domain/echeances";
import type { Vehicule } from "../domain/vehicule";
import { FormulaireVente } from "./FormulaireVente";

function Abonnement(props: { titre: string; fournisseur: string | null; numero: string | null; vide: string; validite: string | null; prefixeValidite: string; seuil: number | undefined; vendu: boolean }) {
  useModeDiscret();
  const e = props.seuil === undefined ? null : etiquetteEcheance(props.validite, props.seuil, props.vendu);
  return (
    <div className="vehicule-abonnement-row">
      <span>{props.titre}</span>
      <strong>{props.fournisseur || "—"}</strong>
      <span className="card-sub">
        {props.numero || props.vide}
        {props.validite && `${props.prefixeValidite}${formatDateFr(props.validite)}`}
      </span>
      {e && <span className="vehicule-ct-tag">{e.texte}</span>}
    </div>
  );
}

/**
 * « 🛣️ Télépéage & ⛽ Carte carburant » et la vente (VEH-01, VEH-04), au HTML
 * de l'ancien écran (app.js l. 15022). Vendre exige de pouvoir modifier le
 * véhicule ET créer une facture : le conducteur, qui a le premier droit sans
 * le second, ne voit pas le bouton. Les échéances proches portent l'étiquette
 * de la liste (D-VEH-04).
 */
export function BlocAbonnements({ vehicule }: { vehicule: Vehicule }) {
  useModeDiscret();
  const modifieVehicules = usePermission("vehicules", "modifier");
  const creeFactures = usePermission("factures", "creer");
  const peutVendre = modifieVehicules && creeFactures;
  const voitLesPrix = useVoitLesPrix();
  const reglages = useReglagesSociete();
  const seuil = reglages.data?.seuils.vehiculeCarte;
  const [vente, setVente] = useState(false);
  const v = vehicule;

  return (
    <div className="chantier-section">
      <div className="section-title" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span>🛣️ Télépéage &amp; ⛽ Carte carburant</span>
        {!v.vendu && peutVendre && (
          <button type="button" className="btn small danger" onClick={() => setVente(true)}>
            💰 Vendre ce véhicule
          </button>
        )}
      </div>
      <Abonnement titre="🛣️ Télépéage" fournisseur={v.telepeage_fournisseur} numero={v.telepeage_numero} vide="Non renseigné" validite={v.telepeage_validite} prefixeValidite=" · valide jusqu'au " seuil={seuil} vendu={v.vendu} />
      <Abonnement titre="⛽ Carte carburant" fournisseur={v.carte_carburant_fournisseur} numero={v.carte_carburant_numero} vide="Non renseignée" validite={v.carte_carburant_validite} prefixeValidite=" · " seuil={seuil} vendu={v.vendu} />
      {v.vendu && (
        <div className="vehicule-vendu-info">
          <strong>🚗 Véhicule vendu</strong> le {formatDateFr(v.date_vente)}
          {voitLesPrix && v.prix_vente ? ` pour ${formatEurosEcran(montant(v.prix_vente))}` : ""}{" "}
          {v.facture_vente_id && (
            <Link className="btn small" to={`/factures/${v.facture_vente_id}`}>
              Voir la facture
            </Link>
          )}
        </div>
      )}
      {vente && <FormulaireVente vehicule={v} onFermer={() => setVente(false)} />}
    </div>
  );
}
