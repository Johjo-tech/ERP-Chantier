import { useState } from "react";
import { useNavigate } from "react-router";
import { messageErreur } from "@/lib/erreurs";
import { afficherToast } from "@/lib/toast";
import { usePermission, useSession, useVoitLesPrix } from "@/modules/auth-roles/hooks/useSession";
import type { Bon, BonDeLaListe } from "../api/bons";
import { estSav } from "../domain/bon";
import { actionsFacturation, MOTIF_CLOTURE_DEFAUT, peutCloturerSansFacturation } from "../domain/circuit";
import { savDuBon } from "../domain/sav";
import { useCloturerGratuit } from "../hooks/useBons";
import { ModalePrefacture } from "./ModalePrefacture";

/**
 * Les gestes du circuit, avec les boutons et libellés de la carte de l'ancien
 * (app.js l. 7040-7062) : la pré-facture s'ouvre dans SA fenêtre
 * (`openValidationDirecteurModal`), la clôture d'un SAV demande son motif par
 * `prompt`, le SAV (un seul par bon) s'ouvre en page.
 */
export function ActionsCircuit({ bon, tous }: { bon: Bon; tous: readonly BonDeLaListe[] }) {
  const navigate = useNavigate();
  const { roleEffectif } = useSession();
  const prix = useVoitLesPrix();
  const peutCreer = usePermission("bons_commande", "creer");
  const cloturer = useCloturerGratuit();
  const [prefacture, setPrefacture] = useState(false);
  const sav = estSav(bon);
  const savLie = savDuBon(bon.id, tous);
  const origine = sav ? tous.find((b) => b.id === bon.bon_commande_parent_id) : undefined;
  const facturee = bon.factures.length > 0;
  const chiffrable = prix && actionsFacturation(roleEffectif).peutModifierPrefacture && !facturee && bon.statut_workflow !== "cloture_gratuit" && !sav;
  function clore() {
    const motif = window.prompt(`Clôturer ${bon.numero_bc || "ce SAV"} sans facturation ?\n\nMotif (facultatif, conservé sur la fiche et dans le journal) :`, MOTIF_CLOTURE_DEFAUT);
    if (motif === null) return;
    cloturer.mutate({ bonId: bon.id, motif: motif.trim() }, { onSuccess: () => afficherToast("Affaire clôturée sans facturation.", "success"), onError: (e) => afficherToast(messageErreur(e)) });
  }
  return (
    <>
      <div className="bc-actions-bas">
        {chiffrable && <button type="button" className="btn small primary" onClick={() => setPrefacture(true)}>🧾 Ouvrir la pré-facture</button>}
        {sav && peutCloturerSansFacturation(roleEffectif, bon, facturee) && (
          <button type="button" className="btn small primary" title="Un SAV est une reprise sous garantie : il se clôt, il ne se facture pas" disabled={cloturer.isPending} onClick={clore}>✓ Clôturer sans facturation</button>
        )}
        {!sav && !savLie && peutCreer && <button type="button" className="btn small" onClick={() => void navigate(`/commandes/${bon.id}/sav`)}>Créer un SAV</button>}
        <button type="button" className="btn small" onClick={() => void navigate(`/commandes/${bon.id}/apercu`)}>Imprimer / PDF</button>
        {savLie && <button type="button" className="btn small ghost" onClick={() => void navigate(`/commandes/${savLie.id}`)}>Voir le SAV {savLie.numero_bc ?? savLie.numero_interne ?? ""}</button>}
        {origine && <button type="button" className="btn small ghost" onClick={() => void navigate(`/commandes/${origine.id}`)}>Bon de commande d'origine : {origine.numero_bc ?? origine.numero_interne ?? ""}</button>}
      </div>
      {bon.gratuite && <div className="bc-attente-message" style={{ marginTop: "8px" }}>Clôturé sans facturation{bon.gratuite_motif ? ` — ${bon.gratuite_motif}` : ""}.</div>}
      {prefacture && <ModalePrefacture bonId={bon.id} onFermer={() => setPrefacture(false)} />}
    </>
  );
}
