import { useNavigate } from "react-router";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { BoutonConfirme } from "@/components/ui/confirmation";
import { messageErreur } from "@/lib/erreurs";
import { Can } from "@/modules/auth-roles/components/Can";
import type { Devis } from "../domain/devis";
import { useDupliquerDevis, useSupprimerDevis } from "../hooks/useDevis";

export function ActionsDevis({ devis }: { devis: Devis }) {
  const navigate = useNavigate();
  const dupliquer = useDupliquerDevis();
  const supprimer = useSupprimerDevis();
  return (
    <>
      <Can module="devis" action="creer">
        <Button
          variant="outline"
          disabled={dupliquer.isPending}
          onClick={() => dupliquer.mutate(devis.id, { onSuccess: (id) => void navigate(`/devis/${id}`, { state: { message: "Copie créée : nouveau brouillon daté du jour." } }) })}
        >
          Dupliquer
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
      {(dupliquer.isError || supprimer.isError) && <Alert variant="erreur">{messageErreur(dupliquer.error ?? supprimer.error)}</Alert>}
    </>
  );
}
