import { useParams } from "react-router";
import { Chargement, Erreur } from "@/components/etats/Etats";
import { GardeSociete } from "@/modules/societes/components/GardeSociete";
import { REGLAGES_DEFAUT } from "@/modules/societes/domain/reglages";
import { useReglages } from "@/modules/societes/hooks/useReglages";
import type { ChampReferenceLigne } from "@/modules/documents/components/reference";
import { Alert } from "@/components/ui/alert";
import { useFacture } from "../hooks/useFactures";
import { FormulaireFacture } from "./FormulaireFacture";
import { VueFactureEmise } from "./VueFactureEmise";

/** Brouillon → formulaire ; émise (numérotée) → vue définitive. */
export function PageFacture({ ChampReference }: { ChampReference?: ChampReferenceLigne }) {
  const { id } = useParams();
  const facture = useFacture(id);
  const reglages = useReglages();
  if ((id && facture.isPending) || reglages.isPending) return <Chargement />;
  if (id && facture.isError) return <Erreur erreur={facture.error} reessayer={() => void facture.refetch()} />;
  const r = reglages.data ?? REGLAGES_DEFAUT;
  const f = facture.data ?? null;
  // Des réglages illisibles ne bloquent pas la saisie, mais cela se dit (TVA, unités, délai par défaut).
  const avis = reglages.isError && <Alert>Réglages de la société illisibles : valeurs par défaut utilisées (TVA 10 %, 30 jours net).</Alert>;
  if (!f) return <>{avis}<FormulaireFacture key="nouvelle" facture={null} reglages={r} ChampReference={ChampReference} /></>;
  return (
    <GardeSociete societeId={f.societe_id} retour="/factures">
      {avis}
      {f.numero ? <VueFactureEmise facture={f} reglages={r} /> : <FormulaireFacture key={f.id} facture={f} reglages={r} ChampReference={ChampReference} />}
    </GardeSociete>
  );
}
