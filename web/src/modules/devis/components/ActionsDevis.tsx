import { useState } from "react";
import { useNavigate } from "react-router";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { BoutonConfirme } from "@/components/ui/confirmation";
import { messageErreur } from "@/lib/erreurs";
import { Can } from "@/modules/auth-roles/components/Can";
import { useSocieteActive } from "@/modules/auth-roles/hooks/useSession";
import { EnregistrementPartiel } from "@/modules/commandes/api/bons";
import { useClients } from "@/modules/clients/hooks/useClients";
import { BoutonPdf } from "@/modules/documents/components/BoutonPdf";
import { PanneauEmail } from "@/modules/documents/components/PanneauEmail";
import { brouillonEmail } from "@/modules/documents/domain/email";
import { totauxDocument } from "@/modules/documents/domain/totaux";
import { REGLAGES_DEFAUT } from "@/modules/societes/domain/reglages";
import { useReglages } from "@/modules/societes/hooks/useReglages";
import type { Devis } from "../domain/devis";
import { useBonDepuisDevis, useDupliquerDevis, useModeleDevis, useSupprimerDevis } from "../hooks/useDevis";

/** Les gestes du devis (DEV-01) : PDF, e-mail, dupliquer, créer le bon de commande, supprimer. */
export function ActionsDevis({ devis }: { devis: Devis }) {
  const navigate = useNavigate();
  const societe = useSocieteActive();
  const clients = useClients();
  const reglages = useReglages();
  const modele = useModeleDevis(devis, (reglages.data ?? REGLAGES_DEFAUT).validiteDevisJours);
  const dupliquer = useDupliquerDevis();
  const supprimer = useSupprimerDevis();
  const bon = useBonDepuisDevis();
  const [email, setEmail] = useState(false);
  const erreur = dupliquer.error ?? supprimer.error ?? bon.error;
  return (
    <>
      <BoutonPdf modele={modele} />
      <Button variant="outline" disabled={!modele} onClick={() => setEmail((x) => !x)}>Envoyer par e-mail</Button>
      <Can module="devis" action="creer">
        <Button
          variant="outline"
          disabled={dupliquer.isPending}
          onClick={() => dupliquer.mutate(devis.id, { onSuccess: (id) => void navigate(`/devis/${id}`, { state: { message: "Copie créée : nouveau brouillon daté du jour." } }) })}
        >
          Dupliquer
        </Button>
      </Can>
      <Can module="bons_commande" action="creer">
        <Button
          variant="outline"
          disabled={bon.isPending}
          onClick={() =>
            bon.mutate(devis.id, {
              onSuccess: (id) => void navigate(`/commandes/${id}`, { state: { message: "Bon de commande créé depuis le devis (en attente du numéro du client). Relisez-le." } }),
              // Bon créé sans toutes ses lignes : on l'ouvre, l'alerte dit quoi compléter.
              onError: (e) => {
                if (e instanceof EnregistrementPartiel) void navigate(`/commandes/${e.bonId}`, { state: { message: messageErreur(e), alerte: true } });
              },
            })
          }
        >
          Créer un bon de commande
        </Button>
      </Can>
      <Can module="devis" action="supprimer">
        <BoutonConfirme
          libelle="Supprimer"
          question={`Supprimer le devis ${devis.numero} ?`}
          enCours={supprimer.isPending}
          onConfirmer={() => supprimer.mutate(devis.id, { onSuccess: () => void navigate("/devis") })}
        />
      </Can>
      {erreur && <Alert variant="erreur">{messageErreur(erreur)}</Alert>}
      {email && (
        <div className="basis-full">
          <PanneauEmail
            brouillon={brouillonEmail({
              nature: "devis",
              avoir: false,
              numero: devis.numero,
              ttc: totauxDocument(devis.lignes, devis.remise_pourcentage).ttc,
              societeNom: societe.nom,
              destinataire: clients.data?.find((c) => c.id === devis.client_id)?.email ?? null,
              lieu: devis,
            })}
            modele={modele}
            fermer={() => setEmail(false)}
          />
        </div>
      )}
    </>
  );
}
