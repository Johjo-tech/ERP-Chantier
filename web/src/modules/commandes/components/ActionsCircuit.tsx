import { useState } from "react";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Can } from "@/modules/auth-roles/components/Can";
import { useSession, useVoitLesPrix } from "@/modules/auth-roles/hooks/useSession";
import type { Bon, BonDeLaListe } from "../api/bons";
import { estSav } from "../domain/bon";
import { actionsFacturation, MOTIF_CLOTURE_DEFAUT, peutCloturerSansFacturation } from "../domain/circuit";
import { savDuBon } from "../domain/sav";
import { useCloturerGratuit } from "../hooks/useBons";

/** Clôturer sans facturation (BC-14) : motif proposé « Reprise sous garantie », conservé au journal. */
function Cloture({ bon, onResultat }: { bon: Bon; onResultat: (m: string, e?: unknown) => void }) {
  const [ouvert, setOuvert] = useState(false);
  const [motif, setMotif] = useState(MOTIF_CLOTURE_DEFAUT);
  const cloturer = useCloturerGratuit();
  if (!ouvert) return <Button variant="secondary" onClick={() => setOuvert(true)}>Clôturer sans facturation</Button>;
  return (
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        cloturer.mutate({ bonId: bon.id, motif: motif.trim() || null }, { onSuccess: () => { setOuvert(false); onResultat("Affaire clôturée sans facturation."); }, onError: (e) => onResultat("", e) });
      }}
    >
      <label htmlFor="motif-cloture" className="text-sm">Motif (facultatif, conservé au journal)</label>
      <Input id="motif-cloture" className="h-9 w-64" value={motif} onChange={(e) => setMotif(e.target.value)} autoFocus />
      <Button type="submit" variant="destructive" disabled={cloturer.isPending}>Clôturer</Button>
      <Button variant="ghost" onClick={() => setOuvert(false)}>Annuler</Button>
    </form>
  );
}

interface Props {
  bon: Bon;
  tous: readonly BonDeLaListe[];
  onResultat: (m: string, e?: unknown) => void;
}

/**
 * Les gestes du circuit, là où le prix se décide (app.js l. 6942-6954) : la
 * pré-facture (ni pour une affaire facturée, ni close, ni pour un SAV), la
 * clôture sans facturation (un SAV, par l'administrateur), le SAV (un seul par bon).
 */
export function ActionsCircuit({ bon, tous, onResultat }: Props) {
  const { roleEffectif } = useSession();
  const prix = useVoitLesPrix();
  const sav = estSav(bon);
  const savLie = savDuBon(bon.id, tous);
  const origine = sav ? tous.find((b) => b.id === bon.bon_commande_parent_id) : undefined;
  const facturee = bon.factures.length > 0;
  const prefacture = prix && actionsFacturation(roleEffectif).peutModifierPrefacture && !facturee && bon.statut_workflow !== "cloture_gratuit" && !sav;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {prefacture && (
        <Button asChild>
          <Link to={`/commandes/${bon.id}/prefacture`}>Ouvrir la pré-facture</Link>
        </Button>
      )}
      {sav && peutCloturerSansFacturation(roleEffectif, bon, facturee) && <Cloture bon={bon} onResultat={onResultat} />}
      {!sav && !savLie && (
        <Can module="bons_commande" action="creer">
          <Button variant="outline" asChild>
            <Link to={`/commandes/${bon.id}/sav`}>Créer un SAV</Link>
          </Button>
        </Can>
      )}
      <Button variant="ghost" asChild>
        <Link to={`/commandes/${bon.id}/apercu`}>Imprimer le bon</Link>
      </Button>
      {savLie && <Link className="text-sm text-primary hover:underline" to={`/commandes/${savLie.id}`}>Voir le SAV {savLie.numero_bc ?? savLie.numero_interne ?? ""}</Link>}
      {origine && <Link className="text-sm text-primary hover:underline" to={`/commandes/${origine.id}`}>Bon de commande d'origine : {origine.numero_bc ?? origine.numero_interne ?? ""}</Link>}
      {bon.gratuite && <span className="text-sm text-muted-foreground">Clôturé sans facturation{bon.gratuite_motif ? ` — ${bon.gratuite_motif}` : ""}.</span>}
    </div>
  );
}
