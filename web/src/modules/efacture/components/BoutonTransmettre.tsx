import { Alert } from "@/components/ui/alert";
import { BoutonConfirme } from "@/components/ui/confirmation";
import { usePermission } from "@/modules/auth-roles/hooks/useSession";
import { passeParUnePlateforme, type CadreFacturation } from "../domain/cadre";
import { messageDepot, useDeposerFacture } from "../hooks/useEfacture";

export interface PieceTransmissible {
  id: string;
  numero: string | null;
  legacy_id: string | null;
  pdp_identifiant: string | null;
}

/**
 * « Transmettre à la plateforme » (EFA-01). Le geste reste manuel et confirmé :
 * une facture transmise ne se rattrape pas, il faut émettre un avoir. Masqué
 * pour un brouillon, une pièce historique, un particulier ou une entreprise
 * étrangère, et pour qui ne peut pas modifier les factures (EFA-20 : la
 * fonction, elle, ne vérifie pas le rôle — D-EFA-05).
 *
 * `cadre` : celui de la FICHE d'abord, puis celui de la facture (app.js l. 304).
 */
export function BoutonTransmettre({ facture, cadre }: { facture: PieceTransmissible; cadre: CadreFacturation | null }) {
  const peutEmettre = usePermission("factures", "modifier");
  const depot = useDeposerFacture(facture.id);

  if (!facture.numero || !passeParUnePlateforme({ legacy_id: facture.legacy_id, cadre_facturation: cadre })) return null;
  if (facture.pdp_identifiant) return <span className="self-center text-sm text-muted-foreground">Déposée sur la plateforme ({facture.pdp_identifiant})</span>;
  if (!peutEmettre) return null;

  return (
    <>
      <BoutonConfirme
        libelle={depot.isPending ? "Transmission en cours…" : "Transmettre à la plateforme"}
        question={`Déposer la facture ${facture.numero} sur la plateforme ? Une facture transmise ne peut plus être modifiée : il faudrait émettre un avoir.`}
        enCours={depot.isPending}
        onConfirmer={() => depot.mutate()}
      />
      {depot.isSuccess && (
        <Alert variant="succes" className="basis-full">
          Facture déposée sur la plateforme{depot.data.identifiant ? ` (${depot.data.identifiant})` : ""}.
        </Alert>
      )}
      {depot.isError && (
        <Alert variant="erreur" className="basis-full">
          {messageDepot(depot.error)}
        </Alert>
      )}
    </>
  );
}
