import { useState } from "react";
import { Link, useSearchParams } from "react-router";
import { Chargement, Erreur, Vide } from "@/components/etats/Etats";
import { EnTetePage } from "@/components/page/EnTetePage";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { BoutonConfirme } from "@/components/ui/confirmation";
import { Input } from "@/components/ui/input";
import { todayISO } from "@/lib/dates";
import { messageErreur } from "@/lib/erreurs";
import { montant } from "@/lib/money";
import { formatEurosEcran } from "@/lib/modeDiscret";
import { correspond } from "@/lib/recherche";
import { grouperPar } from "@/lib/utils";
import { lettrageDeLaSelection } from "../domain/lettrage";
import { libelleModeReglement } from "../domain/reglements";
import { totalDu } from "../domain/solde";
import { useImputerAvoir, useReglements, useSoldes } from "../hooks/useFactures";
import { CartePieceDossier } from "./CartePieceDossier";
import { PanneauReglementGroupe } from "./PanneauReglementGroupe";

/**
 * Le dossier d'un client (FAC-33) : ses pièces émises, les plus récentes
 * d'abord ; cocher des factures → « Règlement » groupé ; cocher UNE facture et
 * UN avoir → « Lettrer » (FAC-23). La barre annonce le total de TOUTE la
 * sélection, même ce que la recherche cache.
 */
export function PageDossierClient() {
  const [params] = useSearchParams();
  const client = params.get("client") ?? "";
  const soldes = useSoldes();
  const reglements = useReglements();
  const lettrer = useImputerAvoir();
  const [selection, setSelection] = useState<string[]>([]);
  const [recherche, setRecherche] = useState("");
  const [groupeOuvert, setGroupeOuvert] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (soldes.isPending || reglements.isPending) return <Chargement />;
  if (soldes.isError || reglements.isError) return <Erreur erreur={soldes.error ?? reglements.error} reessayer={() => { void soldes.refetch(); void reglements.refetch(); }} />;

  const pieces = soldes.data.filter((s) => s.client_nom === client && s.cle !== "brouillon").sort((a, b) => b.date.localeCompare(a.date));
  const parFacture = grouperPar(reglements.data, (r) => r.facture_id);
  const visibles = pieces.filter((p) =>
    correspond(recherche, p.numero, formatEurosEcran(montant(p.ttc)), formatEurosEcran(montant(p.reste)), ...(parFacture.get(p.facture_id) ?? []).map((r) => `${libelleModeReglement(r.mode)} ${r.reference ?? ""} ${formatEurosEcran(montant(r.montant))}`))
  );
  const choisies = pieces.filter((p) => selection.includes(p.facture_id));
  const lettrage = lettrageDeLaSelection(pieces, selection);
  const aEncaisser = choisies.filter((p) => p.sens > 0 && p.du > 0.01);
  const basculer = (id: string) => setSelection((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  return (
    <div className="flex flex-col gap-3">
      <EnTetePage titre={client || "Dossier client"} actions={<Button variant="ghost" asChild><Link to="/factures/reglements">← Retour</Link></Button>} />
      {message && <Alert variant="succes">{message}</Alert>}
      {lettrer.isError && <Alert variant="erreur">{messageErreur(lettrer.error)}</Alert>}
      <label htmlFor="recherche-pieces" className="sr-only">Rechercher dans le dossier</label>
      <Input id="recherche-pieces" type="search" className="max-w-md" placeholder="N° de facture, montant, mode, référence…" value={recherche} onChange={(e) => setRecherche(e.target.value)} />
      {visibles.length === 0 ? (
        <Vide message="Aucune pièce pour ce client." />
      ) : (
        <ul aria-label="Pièces du client" className="divide-y divide-border rounded-md border border-border">
          {visibles.map((p) => (
            <CartePieceDossier key={p.facture_id} piece={p} soldes={soldes.data} reglements={parFacture.get(p.facture_id) ?? []} coche={selection.includes(p.facture_id)} basculer={() => basculer(p.facture_id)} />
          ))}
        </ul>
      )}
      {selection.length > 0 && !groupeOuvert && (
        <div role="region" aria-label="Sélection" className="sticky bottom-2 flex flex-wrap items-center justify-between gap-3 rounded-md border border-primary bg-card p-3 shadow">
          {lettrage ? (
            <>
              <span>Avoir {lettrage.avoir.numero} en face de la facture {lettrage.facture.numero} — <b>{formatEurosEcran(lettrage.montant)}</b> à lettrer</span>
              <BoutonConfirme
                libelle="Lettrer"
                question={`Lettrer l'avoir ${lettrage.avoir.numero} avec la facture ${lettrage.facture.numero} pour ${formatEurosEcran(lettrage.montant)} ?`}
                enCours={lettrer.isPending}
                onConfirmer={() =>
                  lettrer.mutate(
                    { avoirId: lettrage.avoir.facture_id, factureId: lettrage.facture.facture_id, montant: Number(lettrage.montant.toString()), date: todayISO() },
                    { onSuccess: () => { setSelection([]); setMessage(`Avoir ${lettrage.avoir.numero} lettré pour ${formatEurosEcran(lettrage.montant)}.`); } }
                  )
                }
              />
            </>
          ) : (
            <>
              <span>{aEncaisser.length} facture{aEncaisser.length > 1 ? "s" : ""} sélectionnée{aEncaisser.length > 1 ? "s" : ""} — Total : <b>{formatEurosEcran(totalDu(aEncaisser))}</b></span>
              <Button disabled={!aEncaisser.length} onClick={() => setGroupeOuvert(true)}>Règlement</Button>
            </>
          )}
        </div>
      )}
      {groupeOuvert && (
        <PanneauReglementGroupe
          factures={aEncaisser}
          fermer={(m) => {
            setGroupeOuvert(false);
            if (m) { setSelection([]); setMessage(m); }
          }}
        />
      )}
    </div>
  );
}
