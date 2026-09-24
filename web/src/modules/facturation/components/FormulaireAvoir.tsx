import { useState } from "react";
import { useNavigate } from "react-router";
import { ChampChoix, ChampTexte } from "@/components/formulaire/Champ";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { messageErreur } from "@/lib/erreurs";
import { MOTIFS_AVOIR, refusAvoir } from "../domain/avoir";
import type { Facture } from "../domain/facture";
import { useEtablirAvoir } from "../hooks/useFactures";

const AUTRE = "autre";

/** Établir un avoir sur une facture émise : motif de la liste ou libre, imprimé sur l'avoir. */
export function FormulaireAvoir({ facture, fermer }: { facture: Facture; fermer: () => void }) {
  const navigate = useNavigate();
  const etablir = useEtablirAvoir();
  const [choix, setChoix] = useState<string>(MOTIFS_AVOIR[0]);
  const [libre, setLibre] = useState("");
  const motif = choix === AUTRE ? libre : choix;
  const refus = refusAvoir(facture, motif);

  return (
    <div role="group" aria-label="Établir un avoir" className="flex flex-col gap-3 rounded-md border border-border p-3">
      <ChampChoix libelle="Motif de l'avoir" valeur={choix} onChange={setChoix} options={[...MOTIFS_AVOIR.map((m) => ({ valeur: m, libelle: m })), { valeur: AUTRE, libelle: "Autre motif…" }]} />
      {choix === AUTRE && <ChampTexte libelle="Motif (5 caractères au moins)" valeur={libre} onChange={setLibre} erreur={libre && refus ? refus : undefined} />}
      {etablir.isError && <Alert variant="erreur">{messageErreur(etablir.error)}</Alert>}
      <p className="text-sm text-muted-foreground">L'avoir reprend les lignes de la facture et reçoit aussitôt son numéro (série AV).</p>
      <div className="flex gap-2">
        <Button
          disabled={!!refus || etablir.isPending}
          onClick={() => etablir.mutate({ factureId: facture.id, motif }, { onSuccess: (id) => void navigate(`/factures/${id}`, { state: { message: "Avoir établi et émis." } }) })}
        >
          Établir l'avoir
        </Button>
        <Button variant="ghost" onClick={fermer}>Annuler</Button>
      </div>
    </div>
  );
}
