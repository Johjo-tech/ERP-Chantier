import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useSocieteActive } from "@/modules/auth-roles/hooks/useSession";
import { useClients } from "@/modules/clients/hooks/useClients";
import { BoutonPdf } from "@/modules/documents/components/BoutonPdf";
import { PanneauEmail } from "@/modules/documents/components/PanneauEmail";
import { brouillonEmail } from "@/modules/documents/domain/email";
import { totauxDocument } from "@/modules/documents/domain/totaux";
import { BoutonTransmettre } from "@/modules/efacture/components/BoutonTransmettre";
import { estAvoir } from "../domain/avoir";
import type { Facture } from "../domain/facture";
import { useModeleFacture, useOptionsPdfFacture } from "../hooks/useImpression";

/**
 * « Imprimer / PDF », « Envoyer par e-mail » et « Transmettre à la
 * plateforme » d'une facture ou d'un avoir. Le PDF passe par les options de
 * l'ancien : cadenas d'un brouillon (FAC-12), Factur-X d'un numéro (EFA-04).
 */
export function ActionsDocumentFacture({ facture }: { facture: Facture }) {
  const societe = useSocieteActive();
  const { modele } = useModeleFacture(facture);
  const clients = useClients();
  const options = useOptionsPdfFacture(facture);
  const [email, setEmail] = useState(false);
  const avoir = estAvoir(facture.type_document);
  const fiche = clients.data?.find((c) => c.id === facture.client_id);
  const cadre = fiche?.cadre_facturation ?? facture.cadre_facturation;

  return (
    <>
      <BoutonPdf piece={modele} avant={options.avant} apres={options.apres} />
      <Button variant="outline" disabled={!modele} onClick={() => setEmail((x) => !x)}>Envoyer par e-mail</Button>
      <BoutonTransmettre facture={facture} cadre={cadre} />
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
            piece={modele}
            avant={options.avant}
            fermer={() => setEmail(false)}
          />
        </div>
      )}
    </>
  );
}
