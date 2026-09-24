import { useState } from "react";
import { Chargement } from "@/components/etats/Etats";
import { EnTetePage } from "@/components/page/EnTetePage";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { messageErreur } from "@/lib/erreurs";
import { useClients } from "@/modules/clients/hooks/useClients";
import { refusFichier } from "../domain/contrat";
import { useLectureBon } from "../hooks/useLectureBon";
import { ResultatLecture } from "./ResultatLecture";

const PLUS_LONG_QUE_DHABITUDE_MS = 45_000;

/** Lire un bon de commande reçu (PDF, photo) pour préremplir sa saisie. */
export function PageLectureBon() {
  const clients = useClients();
  const { lecture, ecoule, annuler } = useLectureBon();
  const [refus, setRefus] = useState<string | null>(null);

  function choisir(f: File | undefined) {
    if (!f) return;
    const motif = refusFichier(f);
    setRefus(motif);
    if (!motif) lecture.mutate(f);
  }

  return (
    <div className="flex max-w-4xl flex-col gap-4">
      <EnTetePage titre="Lire un bon de commande" sousTitre="Le document est lu côté serveur ; vous relisez tout avant d'enregistrer." />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="fichier-bon">Document du client (PDF, JPEG, PNG ou WebP, 14 Mo au plus)</Label>
        <Input id="fichier-bon" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" disabled={lecture.isPending} onChange={(e) => choisir(e.target.files?.[0])} />
      </div>
      {refus && <Alert variant="erreur">{refus}</Alert>}
      {lecture.isPending && (
        <div className="flex flex-col gap-2">
          <Chargement libelle={`Lecture en cours… ${Math.floor(ecoule / 1000)} s (habituellement 30 s)`} />
          {ecoule >= PLUS_LONG_QUE_DHABITUDE_MS && <Alert>C'est plus long que d'habitude. La lecture est toujours en cours.</Alert>}
          <Button variant="outline" className="self-start" onClick={annuler}>Interrompre</Button>
        </div>
      )}
      {lecture.isError && <Alert variant="erreur">{messageErreur(lecture.error)}</Alert>}
      {lecture.isSuccess && <ResultatLecture extraction={lecture.data} clients={clients.data ?? []} />}
    </div>
  );
}
