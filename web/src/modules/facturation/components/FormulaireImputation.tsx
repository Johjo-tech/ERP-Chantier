import { useState } from "react";
import { ChampChoix, ChampTexte } from "@/components/formulaire/Champ";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { todayISO } from "@/lib/dates";
import { messageErreur } from "@/lib/erreurs";
import { montant } from "@/lib/money";
import { formatEurosEcran } from "@/lib/modeDiscret";
import { schemaNombreFr } from "@/lib/nombres";
import { avoirsImputables, montantImputable } from "../domain/lettrage";
import type { Solde } from "../domain/solde";
import { useImputerAvoir } from "../hooks/useFactures";

/**
 * « Régler par un avoir » depuis une facture (FAC-22, app.js l. 6411) : on
 * choisit l'avoir, le montant proposé est le plus petit des deux restes. La
 * base refait les contrôles et écrit les deux règlements liés (imputer_avoir).
 */
export function FormulaireImputation({ facture, soldes, fermer }: { facture: Solde; soldes: readonly Solde[]; fermer: () => void }) {
  const avoirs = avoirsImputables(facture, soldes);
  const imputer = useImputerAvoir();
  const [avoirId, setAvoirId] = useState(avoirs[0]?.facture_id ?? "");
  const avoir = avoirs.find((a) => a.facture_id === avoirId);
  const propose = avoir ? montantImputable(facture.du, avoir.reste) : null;
  const [saisie, setSaisie] = useState("");
  const [date, setDate] = useState(todayISO());

  if (!avoirs.length) {
    return <Alert>Aucun avoir disponible pour {facture.client_nom}.</Alert>;
  }
  const lu = schemaNombreFr.safeParse(saisie || String(propose ?? ""));
  return (
    <div role="group" aria-label="Régler par un avoir" className="grid gap-2 rounded-md border border-border p-3 sm:grid-cols-4">
      <ChampChoix
        libelle="Avoir"
        valeur={avoirId}
        onChange={(v) => { setAvoirId(v); setSaisie(""); }}
        options={avoirs.map((a) => ({ valeur: a.facture_id, libelle: `${a.numero} — disponible ${formatEurosEcran(montant(a.reste))}` }))}
      />
      <ChampTexte libelle="Montant imputé" inputMode="decimal" placeholder={propose ? String(propose).replace(".", ",") : ""} valeur={saisie} onChange={setSaisie} erreur={saisie && !lu.success ? "Montant invalide." : undefined} />
      <ChampTexte libelle="Date" type="date" valeur={date} onChange={setDate} />
      <div className="flex items-end gap-2">
        <Button
          disabled={!avoir || !lu.success || imputer.isPending}
          onClick={() => lu.success && avoir && imputer.mutate({ avoirId: avoir.facture_id, factureId: facture.facture_id, montant: lu.data, date }, { onSuccess: fermer })}
        >
          Imputer l'avoir
        </Button>
        <Button variant="ghost" onClick={fermer}>Annuler</Button>
      </div>
      {imputer.isError && <Alert variant="erreur" className="sm:col-span-4">{messageErreur(imputer.error)}</Alert>}
    </div>
  );
}
