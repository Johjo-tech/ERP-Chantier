import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { messageErreur } from "@/lib/erreurs";
import { Can } from "@/modules/auth-roles/components/Can";
import type { Bon } from "../api/bons";
import { verrouBonCommande } from "../domain/verrou";
import { useBcRecu, useGenererFacture } from "../hooks/useBons";

/**
 * « BC reçu » (BC-08) : le numéro arrive par courriel ou courrier ; le poser
 * sans ouvrir le bon, c'est le faire tout de suite — et il doit précéder la
 * facture, dont la référence client se fige à l'émission.
 */
function BcRecu({ bon, onMessage }: { bon: Bon; onMessage: (m: string) => void }) {
  const [numero, setNumero] = useState("");
  const recu = useBcRecu();
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <label htmlFor="numero-bc-recu" className="sr-only">Numéro du bon reçu</label>
      <Input id="numero-bc-recu" className="h-9 w-44" placeholder="N° du BC reçu" value={numero} onChange={(e) => setNumero(e.target.value)} />
      <Button
        variant="secondary"
        disabled={recu.isPending}
        onClick={() => {
          const n = numero.trim();
          if (!n) return onMessage("Indiquez le numéro figurant sur le bon du client.");
          recu.mutate(
            { id: bon.id, numero: n },
            { onSuccess: () => onMessage(`Bon de commande n° ${n} enregistré — ce bon n'est plus en attente, et le numéro partira sur sa facture.`), onError: (e) => onMessage(messageErreur(e)) }
          );
        }}
      >
        BC reçu
      </Button>
    </span>
  );
}

/** La facture naît du bon par la base (bc_generer_facture), seulement une fois le chiffrage validé et jamais deux fois (BC-15). */
function CreerFacture({ bon }: { bon: Bon }) {
  const navigate = useNavigate();
  const generer = useGenererFacture();
  return (
    <>
      <Button
        disabled={generer.isPending}
        onClick={() => generer.mutate(bon.id, { onSuccess: (id) => void navigate(`/factures/${id}`, { state: { message: "Facture créée en brouillon depuis le bon de commande." } }) })}
      >
        {generer.isPending ? "Création…" : "Créer la facture"}
      </Button>
      {generer.isError && <Alert variant="erreur">{messageErreur(generer.error)}</Alert>}
    </>
  );
}

export function ActionsBon({ bon, onMessage }: { bon: Bon; onMessage: (m: string) => void }) {
  const fige = verrouBonCommande(bon.factures) !== null;
  const facture = bon.factures[0];
  return (
    <>
      {bon.en_attente_bc && !fige && (
        <Can module="bons_commande" action="modifier">
          <BcRecu bon={bon} onMessage={onMessage} />
        </Can>
      )}
      {bon.statut_workflow === "chiffre" && !facture && (
        <Can module="factures" action="creer">
          <CreerFacture bon={bon} />
        </Can>
      )}
      {facture && (
        <Can module="factures">
          <Button variant="outline" asChild>
            <Link to={`/factures/${facture.id}`}>Voir la facture {facture.numero ?? "(brouillon)"}</Link>
          </Button>
        </Can>
      )}
    </>
  );
}
