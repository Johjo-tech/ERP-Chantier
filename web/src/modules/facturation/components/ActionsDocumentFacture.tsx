import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useSocieteActive } from "@/modules/auth-roles/hooks/useSession";
import { useClients } from "@/modules/clients/hooks/useClients";
import { BoutonPdf } from "@/modules/documents/components/BoutonPdf";
import { PanneauEmail } from "@/modules/documents/components/PanneauEmail";
import { brouillonEmail } from "@/modules/documents/domain/email";
import { totauxDocument } from "@/modules/documents/domain/totaux";
import { estAvoir } from "../domain/avoir";
import type { Facture } from "../domain/facture";
import { useCadenas } from "../hooks/useFactures";
import { useModeleFacture } from "../hooks/useImpression";

/**
 * « Télécharger le PDF » et « Envoyer par e-mail » d'une facture ou d'un avoir.
 *
 * Une facture NON numérotée qu'on télécharge ou qu'on envoie reçoit d'abord son
 * cadenas et l'identité figée des deux parties (FAC-12) : le client a reçu CE
 * document. Une facture émise est déjà figée par la base : rien à poser.
 */
export function ActionsDocumentFacture({ facture }: { facture: Facture }) {
  const societe = useSocieteActive();
  const { modele } = useModeleFacture(facture);
  const clients = useClients();
  const { poser } = useCadenas(facture.id);
  const [email, setEmail] = useState(false);

  const avant = !facture.numero && !facture.verrouillee ? async () => { await poser.mutateAsync(facture.client_id); } : undefined;
  const avoir = estAvoir(facture.type_document);

  return (
    <>
      <BoutonPdf modele={modele} avant={avant} />
      <Button variant="outline" disabled={!modele} onClick={() => setEmail((x) => !x)}>Envoyer par e-mail</Button>
      {email && (
        <div className="basis-full">
          <PanneauEmail
            brouillon={brouillonEmail({
              nature: "facture",
              avoir,
              numero: facture.numero ?? "(brouillon)",
              ttc: totauxDocument(facture.lignes, facture.remise_pourcentage).ttc.times(avoir ? -1 : 1),
              societeNom: societe.nom,
              destinataire: clients.data?.find((c) => c.id === facture.client_id)?.email ?? null,
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

