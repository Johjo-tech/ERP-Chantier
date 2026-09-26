import type { ReactNode } from "react";
import { useParams } from "react-router";
import { Chargement, Erreur } from "@/components/etats/Etats";
import { GardeSociete } from "@/modules/societes/components/GardeSociete";
import { REGLAGES_DEFAUT } from "@/modules/societes/domain/reglages";
import { useReglages } from "@/modules/societes/hooks/useReglages";
import type { ChampReferenceLigne } from "@/modules/documents/components/reference";
import { Alert } from "@/components/ui/alert";
import { motifRoleFacture } from "../domain/actions";
import { useDroitsFacture } from "../hooks/useEcranFactures";
import { useFacture } from "../hooks/useFactures";
import { FormulaireFacture } from "./FormulaireFacture";
import { OngletsFacturation } from "./OngletsFacturation";

/**
 * L'écran d'une facture, tel que l'ancien l'ouvrait (`renderFactures` avec
 * `formOpen.facture`) : les sous-onglets, « Factures » sans ses boutons, le
 * motif du rôle, puis le formulaire à la place de la liste — pour une pièce
 * neuve, un brouillon, ou une facture émise qui s'y lit derrière un voile.
 */
export function PageFacture({ ChampReference }: { ChampReference?: ChampReferenceLigne }) {
  const { id } = useParams();
  const facture = useFacture(id);
  const reglages = useReglages();
  const droits = useDroitsFacture();
  const motifRole = motifRoleFacture(droits);
  const cadre = (contenu: ReactNode) => (
    <>
      <OngletsFacturation />
      <div className="page-head"><h1>Factures</h1></div>
      {motifRole && <div className="card-sub" style={{ margin: "0 0 12px" }}>{motifRole}</div>}
      <div id="formZoneFacture">{contenu}</div>
    </>
  );
  if ((id && facture.isPending) || reglages.isPending) return cadre(<Chargement />);
  if (id && facture.isError) return cadre(<Erreur erreur={facture.error} reessayer={() => void facture.refetch()} />);
  const r = reglages.data ?? REGLAGES_DEFAUT;
  const f = facture.data ?? null;
  // Des réglages illisibles ne bloquent pas la saisie, mais cela se dit (TVA, unités, délai par défaut).
  const avis = reglages.isError && <Alert>Réglages de la société illisibles : valeurs par défaut utilisées (TVA 10 %, 30 jours net).</Alert>;
  if (!f) return cadre(<>{avis}<FormulaireFacture key="nouvelle" facture={null} reglages={r} ChampReference={ChampReference} /></>);
  return (
    <GardeSociete societeId={f.societe_id} retour="/factures">
      {cadre(<>{avis}<FormulaireFacture key={f.id} facture={f} reglages={r} ChampReference={ChampReference} /></>)}
    </GardeSociete>
  );
}
