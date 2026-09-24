import { useState } from "react";
import { Link, useLocation } from "react-router";
import { EnTetePage } from "@/components/page/EnTetePage";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { formatDateFr } from "@/lib/dates";
import { Can } from "@/modules/auth-roles/components/Can";
import { BlocTotaux } from "@/modules/documents/components/BlocTotaux";
import { EditeurLignes } from "@/modules/documents/components/EditeurLignes";
import { depuisBase } from "@/modules/documents/domain/lignes";
import { estAvoir, totauxDocument } from "@/modules/documents/domain/totaux";
import type { ReglagesDocuments } from "@/modules/societes/domain/reglages";
import { libelleDocument } from "../domain/avoir";
import type { Facture } from "../domain/facture";
import { verrouFacture } from "../domain/verrou";
import { montant } from "@/lib/money";
import { useTotauxFactures } from "../hooks/useFactures";
import { BlocReglements } from "./BlocReglements";
import { FormulaireAvoir } from "./FormulaireAvoir";

/** Une facture émise : définitive (L441-9) — on la consulte, on l'encaisse, on la corrige par un avoir. */
export function VueFactureEmise({ facture, reglages }: { facture: Facture; reglages: ReglagesDocuments }) {
  const location = useLocation();
  const message = (location.state as { message?: string } | null)?.message;
  const [avoirOuvert, setAvoirOuvert] = useState(false);
  const lignes = facture.lignes.map(depuisBase);
  const avoir = estAvoir(facture.type_document);
  // Le TTC qui fait foi pour le solde est celui de la base (v_facture_totaux) ; le calcul local ne sert qu'en attendant.
  const totaux = useTotauxFactures();
  const ttcBase = totaux.data?.find((t) => t.facture_id === facture.id)?.ttc;
  const ttc = ttcBase != null ? montant(ttcBase) : totauxDocument(lignes, facture.remise_pourcentage).ttc;
  const verrou = verrouFacture(facture);

  return (
    <div className="flex flex-col gap-4">
      <EnTetePage
        titre={`${libelleDocument(facture.type_document) === "AVOIR" ? "Avoir" : "Facture"} ${facture.numero ?? ""}`}
        sousTitre={`${facture.client_nom} · du ${formatDateFr(facture.date)}${facture.echeance ? ` · échéance ${formatDateFr(facture.echeance)}` : ""}`}
        actions={
          <>
            <Button variant="outline" asChild><Link to={`/factures/${facture.id}/apercu`}>Aperçu / imprimer</Link></Button>
            {!avoir && facture.numero && (
              <Can module="factures" action="creer">
                <Button variant="outline" onClick={() => setAvoirOuvert(true)}>Établir un avoir</Button>
              </Can>
            )}
          </>
        }
      />
      {message && <Alert variant="succes">{message}</Alert>}
      {verrou && <Alert>{verrou.libelle}</Alert>}
      {avoir && facture.motif_rectification && <Alert>Motif : {facture.motif_rectification}</Alert>}
      {avoirOuvert && <FormulaireAvoir facture={facture} fermer={() => setAvoirOuvert(false)} />}
      <EditeurLignes lignes={lignes} onChange={() => undefined} tvaDefaut={reglages.tvaDefaut} unites={reglages.unites} taux={reglages.tauxTva} lectureSeule />
      <BlocTotaux
        lignes={lignes}
        remise={String(facture.remise_pourcentage)}
        signe={avoir ? -1 : 1}
        deductions={avoir ? undefined : { acomptes: facture.acomptes_deduits, retenuePct: facture.retenue_garantie_pourcentage }}
      />
      {!avoir && facture.numero && <BlocReglements factureId={facture.id} ttc={ttc} modeParDefaut={facture.mode_paiement} />}
      <Button variant="ghost" className="self-start" asChild><Link to="/factures">Retour à la liste</Link></Button>
    </div>
  );
}
