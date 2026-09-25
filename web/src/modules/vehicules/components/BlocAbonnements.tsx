import { useState } from "react";
import { Link } from "react-router";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateFr } from "@/lib/dates";
import { montant } from "@/lib/money";
import { formatEurosEcran } from "@/lib/modeDiscret";
import { usePermission, useVoitLesPrix } from "@/modules/auth-roles/hooks/useSession";
import { useReglagesSociete } from "@/modules/societes/hooks/useSocieteReglages";
import { etiquetteEcheance } from "../domain/echeances";
import type { Vehicule } from "../domain/vehicule";
import { FormulaireVente } from "./FormulaireVente";

function Abonnement({ titre, fournisseur, numero, validite, seuil, vendu }: { titre: string; fournisseur: string | null; numero: string | null; validite: string | null; seuil: number | undefined; vendu: boolean }) {
  const e = seuil === undefined ? null : etiquetteEcheance(validite, seuil, vendu);
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="w-32 text-muted-foreground">{titre}</span>
      <strong>{fournisseur || "—"}</strong>
      <span className="text-xs text-muted-foreground">
        {numero || "Non renseigné"}
        {validite && ` · valide jusqu'au ${formatDateFr(validite)}`}
      </span>
      {e && <Badge variant={e.niveau === "danger" ? "danger" : "alerte"}>{e.texte}</Badge>}
    </div>
  );
}

/**
 * Télépéage, carte carburant, et la vente (VEH-01, VEH-04). Vendre exige de
 * pouvoir modifier le véhicule ET créer une facture : le conducteur, qui a le
 * premier droit sans le second, ne voit pas le bouton.
 */
export function BlocAbonnements({ vehicule }: { vehicule: Vehicule }) {
  const modifieVehicules = usePermission("vehicules", "modifier");
  const creeFactures = usePermission("factures", "creer");
  const peutVendre = modifieVehicules && creeFactures;
  const voitLesPrix = useVoitLesPrix();
  const reglages = useReglagesSociete();
  const seuil = reglages.data?.seuils.vehiculeCarte;
  const [vente, setVente] = useState(false);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Télépéage et carte carburant</CardTitle>
        {!vehicule.vendu && peutVendre && !vente && (
          <Button size="sm" variant="destructive" onClick={() => setVente(true)}>
            Vendre ce véhicule
          </Button>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <Abonnement titre="Télépéage" fournisseur={vehicule.telepeage_fournisseur} numero={vehicule.telepeage_numero} validite={vehicule.telepeage_validite} seuil={seuil} vendu={vehicule.vendu} />
        <Abonnement titre="Carte carburant" fournisseur={vehicule.carte_carburant_fournisseur} numero={vehicule.carte_carburant_numero} validite={vehicule.carte_carburant_validite} seuil={seuil} vendu={vehicule.vendu} />
        {vente && <FormulaireVente vehicule={vehicule} onFermer={() => setVente(false)} />}
        {vehicule.vendu && (
          <div role="status" className="flex flex-wrap items-center gap-2 rounded-md bg-muted px-3 py-2 text-sm">
            <strong>Véhicule vendu</strong> le {formatDateFr(vehicule.date_vente)}
            {voitLesPrix && vehicule.prix_vente != null && ` pour ${formatEurosEcran(montant(vehicule.prix_vente))} HT`}
            {vehicule.facture_vente_id && (
              <Button asChild size="sm" variant="outline">
                <Link to={`/factures/${vehicule.facture_vente_id}`}>Voir la facture</Link>
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
