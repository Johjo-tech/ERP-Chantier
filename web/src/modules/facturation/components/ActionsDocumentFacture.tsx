import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useSocieteActive } from "@/modules/auth-roles/hooks/useSession";
import { useClients } from "@/modules/clients/hooks/useClients";
import { BoutonPdf } from "@/modules/documents/components/BoutonPdf";
import { PanneauEmail } from "@/modules/documents/components/PanneauEmail";
import { brouillonEmail } from "@/modules/documents/domain/email";
import { totauxDocument } from "@/modules/documents/domain/totaux";
import { BoutonTransmettre } from "@/modules/efacture/components/BoutonTransmettre";
import { passeParUnePlateforme } from "@/modules/efacture/domain/cadre";
import { enrichirFacturX } from "@/modules/efacture/hooks/useEfacture";
import { estAvoir } from "../domain/avoir";
import type { Facture } from "../domain/facture";
import { useCadenas } from "../hooks/useFactures";
import { useModeleFacture } from "../hooks/useImpression";

/**
 * « Télécharger le PDF », « Envoyer par e-mail » et « Transmettre à la
 * plateforme » d'une facture ou d'un avoir.
 *
 * Une facture NON numérotée qu'on télécharge ou qu'on envoie reçoit d'abord son
 * cadenas et l'identité figée des deux parties (FAC-12) : le client a reçu CE
 * document. Une facture émise est déjà figée par la base : rien à poser, mais
 * son PDF emporte la facture structurée (Factur-X, EFA-04).
 */
export function ActionsDocumentFacture({ facture }: { facture: Facture }) {
  const societe = useSocieteActive();
  const { modele } = useModeleFacture(facture);
  const clients = useClients();
  const { poser } = useCadenas(facture.id);
  const [email, setEmail] = useState(false);
  const [pdfSimple, setPdfSimple] = useState<string | null>(null);

  const avant = !facture.numero && !facture.verrouillee ? async () => { await poser.mutateAsync(facture.client_id); } : undefined;
  const avoir = estAvoir(facture.type_document);
  const fiche = clients.data?.find((c) => c.id === facture.client_id);
  // Le cadre de la FICHE d'abord : la colonne de la facture vaut « entreprise » par défaut (app.js l. 304).
  const cadre = fiche?.cadre_facturation ?? facture.cadre_facturation;

  /* Un manque n'empêche pas le téléchargement, il le signale — et seulement si
     la pièce RELÈVE de la facture électronique : pour un particulier, le PDF
     simple est le document normal (app.js l. 3887). */
  const apres = facture.numero
    ? async (pdf: Blob) => {
        const r = await enrichirFacturX(pdf, facture.id);
        setPdfSimple(!r.structuree && r.manques.length && passeParUnePlateforme({ legacy_id: facture.legacy_id, cadre_facturation: cadre }) ? `PDF simple : ${r.manques[0]}` : null);
        return r.fichier;
      }
    : undefined;

  return (
    <>
      <BoutonPdf modele={modele} avant={avant} apres={apres} />
      <Button variant="outline" disabled={!modele} onClick={() => setEmail((x) => !x)}>Envoyer par e-mail</Button>
      <BoutonTransmettre facture={facture} cadre={cadre} />
      {pdfSimple && <Alert className="basis-full">{pdfSimple}</Alert>}
      {email && (
        <div className="basis-full">
          <PanneauEmail
            brouillon={brouillonEmail({
              nature: "facture",
              avoir,
              numero: facture.numero ?? "(brouillon)",
              ttc: totauxDocument(facture.lignes, facture.remise_pourcentage).ttc.times(avoir ? -1 : 1),
              societeNom: societe.nom,
              destinataire: fiche?.email ?? null,
              lieu: facture,
            })}
            modele={modele}
            avant={avant}
            fermer={() => setEmail(false)}
          />
        </div>
      )}
    </>
  );
}
