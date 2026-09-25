import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { EnTetePage } from "@/components/page/EnTetePage";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { formatDateFr } from "@/lib/dates";
import { messageErreur } from "@/lib/erreurs";
import { formatEuros, montant } from "@/lib/money";
import { Can } from "@/modules/auth-roles/components/Can";
import { usePermission } from "@/modules/auth-roles/hooks/useSession";
import { BlocTotaux } from "@/modules/documents/components/BlocTotaux";
import { EditeurLignes } from "@/modules/documents/components/EditeurLignes";
import { depuisBase } from "@/modules/documents/domain/lignes";
import { estAvoir } from "@/modules/documents/domain/totaux";
import type { ReglagesDocuments } from "@/modules/societes/domain/reglages";
import { libelleDocument } from "../domain/avoir";
import type { Facture } from "../domain/facture";
import { verrouFacture } from "../domain/verrou";
import { useDupliquerFacture, useSoldes } from "../hooks/useFactures";
import { ActionsDocumentFacture } from "./ActionsDocumentFacture";
import { BlocReglements } from "./BlocReglements";
import { FormulaireAvoir } from "./FormulaireAvoir";

/** Une facture émise : définitive (L441-9) — on la consulte, on l'envoie, on l'encaisse, on la corrige par un avoir. */
export function VueFactureEmise({ facture, reglages }: { facture: Facture; reglages: ReglagesDocuments }) {
  const location = useLocation();
  const navigate = useNavigate();
  const message = (location.state as { message?: string } | null)?.message;
  const [avoirOuvert, setAvoirOuvert] = useState(false);
  const lignes = facture.lignes.map(depuisBase);
  const avoir = estAvoir(facture.type_document);
  const soldes = useSoldes();
  const dupliquer = useDupliquerFacture();
  const voitReglements = usePermission("reglements", "voir");
  // Le solde qui fait foi est celui de la base (v_facture_solde, FAC-73).
  const solde = soldes.data?.find((s) => s.facture_id === facture.id);
  const verrou = verrouFacture(facture);

  return (
    <div className="flex flex-col gap-4">
      <EnTetePage
        titre={`${libelleDocument(facture.type_document) === "AVOIR" ? "Avoir" : "Facture"} ${facture.numero ?? ""}`}
        sousTitre={`${facture.client_nom} · du ${formatDateFr(facture.date)}${facture.echeance ? ` · échéance ${formatDateFr(facture.echeance)}` : ""}`}
        actions={
          <>
            <Button variant="outline" asChild><Link to={`/factures/${facture.id}/apercu`}>Aperçu / imprimer</Link></Button>
            <ActionsDocumentFacture facture={facture} />
            {!avoir && (
              <Can module="factures" action="creer">
                <Button variant="outline" onClick={() => setAvoirOuvert(true)}>Établir un avoir</Button>
                <Button
                  variant="outline"
                  disabled={dupliquer.isPending}
                  onClick={() => dupliquer.mutate(facture.id, { onSuccess: (id) => void navigate(`/factures/${id}`, { state: { message: "Copie créée en brouillon — elle recevra son numéro à l'émission." } }) })}
                >
                  Dupliquer
                </Button>
              </Can>
            )}
          </>
        }
      />
      {message && <Alert variant="succes">{message}</Alert>}
      {dupliquer.isError && <Alert variant="erreur">{messageErreur(dupliquer.error)}</Alert>}
      {verrou && <Alert>{verrou.libelle}</Alert>}
      {avoir && facture.motif_rectification && <Alert>Motif : {facture.motif_rectification}</Alert>}
      {avoirOuvert && <FormulaireAvoir facture={facture} fermer={() => setAvoirOuvert(false)} />}
      <EditeurLignes lignes={lignes} onChange={() => undefined} tvaDefaut={reglages.tvaDefaut} taux={reglages.tauxTva} lectureSeule />
      <BlocTotaux
        lignes={lignes}
        remise={String(facture.remise_pourcentage)}
        signe={avoir ? -1 : 1}
        deductions={avoir ? undefined : { acomptes: facture.acomptes_deduits, retenuePct: facture.retenue_garantie_pourcentage }}
      />
      {avoir && solde && <Alert>Crédit disponible : {formatEuros(montant(solde.credit))}. Il s'impute sur une facture du même client (Règlements › dossier client, ou « Régler par un avoir » sur la facture).</Alert>}
      {!avoir && voitReglements && solde && <BlocReglements solde={solde} soldes={soldes.data ?? []} modeParDefaut={facture.mode_paiement} />}
      <Button variant="ghost" className="self-start" asChild><Link to="/factures">Retour à la liste</Link></Button>
    </div>
  );
}
