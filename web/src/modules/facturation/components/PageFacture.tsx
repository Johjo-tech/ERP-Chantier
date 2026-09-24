import { useParams } from "react-router";
import { Chargement, Erreur } from "@/components/etats/Etats";
import { GardeSociete } from "@/modules/societes/components/GardeSociete";
import { REGLAGES_DEFAUT } from "@/modules/societes/domain/reglages";
import { useReglages } from "@/modules/societes/hooks/useReglages";
import { useFacture } from "../hooks/useFactures";
import { FormulaireFacture } from "./FormulaireFacture";
import { VueFactureEmise } from "./VueFactureEmise";

/** Brouillon → formulaire ; émise (numérotée) → vue définitive. */
export function PageFacture() {
  const { id } = useParams();
  const facture = useFacture(id);
  const reglages = useReglages();
  if ((id && facture.isPending) || reglages.isPending) return <Chargement />;
  if (id && facture.isError) return <Erreur erreur={facture.error} reessayer={() => void facture.refetch()} />;
  const r = reglages.data ?? REGLAGES_DEFAUT;
  const f = facture.data ?? null;
  if (!f) return <FormulaireFacture key="nouvelle" facture={null} reglages={r} />;
  return (
    <GardeSociete societeId={f.societe_id} retour="/factures">
      {f.numero ? <VueFactureEmise facture={f} reglages={r} /> : <FormulaireFacture key={f.id} facture={f} reglages={r} />}
    </GardeSociete>
  );
}
