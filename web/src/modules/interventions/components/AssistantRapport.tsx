import { Fragment, useState } from "react";
import { messageErreur } from "@/lib/erreurs";
import { afficherToast } from "@/lib/toast";
import { erreursParChamp } from "@/lib/validation";
import { usePermission } from "@/modules/auth-roles/hooks/useSession";
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

/** `stepIndicatorHTML` : les quatre pastilles, reliées ; un clic mène à l'étape. */
function Indicateur({ etape, onEtape }: { etape: number; onEtape: (n: number) => void }) {
  return (
    <div className="step-indicator" role="group" aria-label="Étapes du rapport">
      {ETAPES.map((libelle, i) => (
        <Fragment key={libelle}>
          {i > 0 && <div className="step-line" />}
          <div className={`step-item ${i === etape ? "active" : ""} ${i < etape ? "done" : ""}`} role="button" tabIndex={0} aria-current={i === etape ? "step" : undefined} onClick={() => onEtape(i)} onKeyDown={(e) => e.key === "Enter" && onEtape(i)}>
            <div className="step-circle">{i + 1}</div>
            <div className="step-label">{libelle}</div>
          </div>
        </Fragment>
      ))}
    </div>
  );
}

/** Le rapport en quatre étapes (`interventionForm`, PLN-20) : Infos, Contrôles, Photos, Rapport. */
export function AssistantRapport({ initiale, photosInitiales, signaturesExistantes, enCours, erreur, onEnregistrer, onAnnuler }: Props) {
  const [etape, setEtape] = useState(0);
  const [saisie, setSaisie] = useState(initiale);
  const [photos, setPhotos] = useState(photosInitiales);
  const [signatures, setSignatures] = useState<SignaturesEdition>({ client: undefined, technicien: undefined });
  const creeDevis = usePermission("devis", "creer");
  const derniere = etape === ETAPES.length - 1;

  const enregistrer = async (suite: Suite) => {
    const r = schemaSaisieRapport.safeParse(saisie);
    if (!r.success) {
      // Le refus de l'ancien écran : une fenêtre, puis retour aux infos.
      window.alert(Object.values(erreursParChamp(r.error))[0] ?? "Saisie incomplète.");
      setEtape(0);
      return;
    }
    try {
      onEnregistrer({ saisie: r.data, ...(await versEnregistrement(photos, signatures)), suite });
    } catch (e) {
      console.error("Préparation des photos du rapport impossible", e);
      afficherToast("Une photo ou une signature n'a pas pu être préparée. Retirez-la puis réessayez.");
    }
  };

  return (
    <div className="form-panel wizard-panel">
      <Indicateur etape={etape} onEtape={setEtape} />
      <div id="wizardBody">
        {!!erreur && (
          <div role="alert" className="wf-banner alerte" style={{ marginBottom: "10px" }}>
            {messageErreur(erreur)}
          </div>
        )}
        {etape === ETAPES.indexOf("Infos") && <EtapeInfos saisie={saisie} onChange={setSaisie} />}
        {etape === ETAPES.indexOf("Contrôles") && <EtapeControles saisie={saisie} onChange={setSaisie} />}
        {etape === ETAPES.indexOf("Photos") && <EtapePhotos photos={photos} onPhotos={setPhotos} signatures={signatures} signaturesExistantes={signaturesExistantes} onSignatures={setSignatures} logement={saisie.logement_statut} onMessage={(m) => afficherToast(m, "success")} />}
        {etape === ETAPES.indexOf("Rapport") && <EtapeRapport saisie={saisie} onChange={setSaisie} enCours={enCours} onImprimer={() => void enregistrer("apercu")} />}
        <div className="form-actions-sticky" style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
          <div>
            {etape > 0 ? (
              <button type="button" className="btn ghost" onClick={() => setEtape(etape - 1)}>← Précédent</button>
            ) : (
              <button type="button" className="btn ghost" onClick={onAnnuler}>Annuler</button>
            )}
          </div>
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            {!derniere ? (
              <button type="button" className="btn primary" onClick={() => setEtape(etape + 1)}>Suivant →</button>
            ) : (
              <>
                <button type="button" className="btn" disabled={enCours} onClick={() => void enregistrer("liste")}>Enregistrer le rapport</button>
                {creeDevis && (
                  <button type="button" className="btn primary" disabled={enCours} onClick={() => void enregistrer("devis")}>Enregistrer et créer un devis</button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
