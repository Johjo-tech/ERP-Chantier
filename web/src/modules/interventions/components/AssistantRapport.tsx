import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { messageErreur } from "@/lib/erreurs";
import { erreursParChamp } from "@/lib/validation";
import { Can } from "@/modules/auth-roles/components/Can";
import { dataUrlEnBlob } from "@/modules/planning/components/image";
import type { PhotoAEnregistrer, Signatures } from "../api/rapports";
import type { PhotoEdition } from "../domain/assistant";
import { ETAPES, schemaSaisieRapport, type SaisieRapport } from "../domain/rapport";
import { EtapeInfos } from "./EtapeInfos";
import { EtapePhotos, type SignaturesEdition } from "./EtapePhotos";
import { EtapeControles, EtapeRapport } from "./EtapesSuite";

export type Suite = "liste" | "devis" | "apercu";

export interface ResultatAssistant {
  saisie: SaisieRapport;
  photos: PhotoAEnregistrer[];
  signatures: Signatures;
  suite: Suite;
}

interface Props {
  initiale: SaisieRapport;
  photosInitiales: PhotoEdition[];
  signaturesExistantes: { client: string | null; technicien: string | null };
  enCours: boolean;
  erreur: unknown;
  onEnregistrer: (r: ResultatAssistant) => void;
  onAnnuler: () => void;
}

async function versEnregistrement(photos: readonly PhotoEdition[], s: SignaturesEdition): Promise<{ photos: PhotoAEnregistrer[]; signatures: Signatures }> {
  const enBlob = async (v: string | null | undefined) => (v === undefined ? undefined : v === null ? null : dataUrlEnBlob(v));
  const signatures: Signatures = {};
  const client = await enBlob(s.client);
  const technicien = await enBlob(s.technicien);
  if (client !== undefined) signatures.client = client;
  if (technicien !== undefined) signatures.technicien = technicien;
  return {
    photos: await Promise.all(photos.map(async (p) => ({ id: p.id, chemin: null, fichier: p.dataUrl ? await dataUrlEnBlob(p.dataUrl) : null, categorie: p.categorie }))),
    signatures,
  };
}

/** Le rapport en quatre étapes (PLN-20) : Infos, Contrôles, Photos, Rapport. */
export function AssistantRapport({ initiale, photosInitiales, signaturesExistantes, enCours, erreur, onEnregistrer, onAnnuler }: Props) {
  const [etape, setEtape] = useState(0);
  const [saisie, setSaisie] = useState(initiale);
  const [photos, setPhotos] = useState(photosInitiales);
  const [signatures, setSignatures] = useState<SignaturesEdition>({ client: undefined, technicien: undefined });
  const [erreurs, setErreurs] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);

  const enregistrer = async (suite: Suite) => {
    const r = schemaSaisieRapport.safeParse(saisie);
    if (!r.success) {
      setErreurs(erreursParChamp(r.error));
      setEtape(0);
      return;
    }
    setErreurs({});
    try {
      onEnregistrer({ saisie: r.data, ...(await versEnregistrement(photos, signatures)), suite });
    } catch (e) {
      console.error("Préparation des photos du rapport impossible", e);
      setMessage("Une photo ou une signature n'a pas pu être préparée. Retirez-la puis réessayez.");
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <ol aria-label="Étapes du rapport" className="flex flex-wrap gap-2">
        {ETAPES.map((libelle, i) => (
          <li key={libelle}>
            <Button variant={i === etape ? "default" : "outline"} size="sm" aria-current={i === etape ? "step" : undefined} onClick={() => setEtape(i)}>
              {i + 1}. {libelle}
            </Button>
          </li>
        ))}
      </ol>
      {message && <Alert variant="info">{message}</Alert>}
      {!!Object.keys(erreurs).length && <Alert variant="erreur">{Object.values(erreurs)[0]}</Alert>}
      {!!erreur && <Alert variant="erreur">{messageErreur(erreur)}</Alert>}
      {etape === ETAPES.indexOf("Infos") && <EtapeInfos saisie={saisie} onChange={setSaisie} erreurs={erreurs} />}
      {etape === ETAPES.indexOf("Contrôles") && <EtapeControles saisie={saisie} onChange={setSaisie} />}
      {etape === ETAPES.indexOf("Photos") && <EtapePhotos photos={photos} onPhotos={setPhotos} signatures={signatures} signaturesExistantes={signaturesExistantes} onSignatures={setSignatures} logement={saisie.logement_statut} onMessage={setMessage} />}
      {etape === ETAPES.indexOf("Rapport") && <EtapeRapport saisie={saisie} onChange={setSaisie} />}
      <div className="flex flex-wrap justify-between gap-2 border-t pt-3">
        <Button variant="ghost" onClick={() => (etape ? setEtape(etape - 1) : onAnnuler())}>{etape ? "← Précédent" : "Annuler"}</Button>
        {etape < ETAPES.length - 1 ? (
          <Button onClick={() => setEtape(etape + 1)}>Suivant →</Button>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" disabled={enCours} onClick={() => void enregistrer("apercu")}>Enregistrer et imprimer / envoyer</Button>
            <Button variant="outline" disabled={enCours} onClick={() => void enregistrer("liste")}>Enregistrer le rapport</Button>
            <Can module="devis" action="creer">
              <Button disabled={enCours} onClick={() => void enregistrer("devis")}>Enregistrer et créer un devis</Button>
            </Can>
          </div>
        )}
      </div>
    </div>
  );
}
