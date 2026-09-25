import { Link } from "react-router";
import { EnTetePage } from "@/components/page/EnTetePage";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { messageErreur } from "@/lib/erreurs";
import { useClientsRapprochables } from "@/modules/clients/hooks/useClients";
import { useFonctionnalite } from "@/modules/societes/hooks/useFonctionnalite";
import { LectureImpossible } from "../api/extraire";
import { attenteAnnoncee, ETAPES_AFFICHEES, etatAnnule, etatDelaiDepasse, etatEchec, etatLecture, formaterDuree, LIBELLES_ETAPE, type EtapeLecture, type EtatLecture } from "../domain/lecture";
import { useLectureBon } from "../hooks/useLectureBon";
import { ResultatLecture } from "./ResultatLecture";

/** Les étapes, la courante marquée : l'encodage se lit « Préparation » (regles-ocr). */
function Etapes({ etape }: { etape: EtapeLecture }) {
  const courante = etape === "encodage" ? "preparation" : etape;
  const rang = ETAPES_AFFICHEES.indexOf(courante);
  return (
    <ol aria-label="Étapes de la lecture" className="flex flex-wrap gap-3 text-sm">
      {ETAPES_AFFICHEES.map((e, i) => (
        <li key={e} aria-current={i === rang ? "step" : undefined} className={i === rang ? "font-semibold" : i < rang ? "text-success" : "text-muted-foreground"}>
          {i < rang ? "✓ " : ""}{LIBELLES_ETAPE[e]}
        </li>
      ))}
    </ol>
  );
}

function etatDeLEchec(erreur: unknown, ecoule: number): EtatLecture {
  if (erreur instanceof LectureImpossible && erreur.issue === "annule") return etatAnnule(ecoule);
  if (erreur instanceof LectureImpossible && erreur.issue === "delai") return etatDelaiDepasse(ecoule);
  return etatEchec(messageErreur(erreur));
}

/**
 * Lire un bon de commande reçu (PDF, photo) pour préremplir sa saisie
 * (OCR-01 à OCR-04). Réservé au niveau d'abonnement qui l'ouvre : l'URL directe
 * ne contourne pas la fonctionnalité (relecture 3, M6).
 */
export function PageLectureBon() {
  const ouverte = useFonctionnalite("ocr");
  const clients = useClientsRapprochables();
  const { lecture, ecoule, etape, annuler, reessayer } = useLectureBon();
  if (!ouverte) return <Alert>La lecture automatique des bons n'est pas incluse dans l'abonnement de cette société.</Alert>;
  const enCours = etatLecture(etape, ecoule);
  const echec = lecture.isError ? etatDeLEchec(lecture.error, ecoule) : null;

  return (
    <div className="flex max-w-4xl flex-col gap-4">
      <EnTetePage titre="Importer un bon de commande" sousTitre="Le document est lu côté serveur ; vous relisez tout avant d'enregistrer." />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="fichier-bon">Document du client (PDF ou photo — une photo lourde ou HEIC est convertie en JPEG)</Label>
        <Input id="fichier-bon" type="file" accept="application/pdf,image/*,.heic,.heif" disabled={lecture.isPending} onChange={(e) => { const f = e.target.files?.[0]; if (f) lecture.mutate(f); }} />
      </div>
      {lecture.isPending && (
        <div className="flex flex-col gap-2" role="status" aria-live="polite">
          <Etapes etape={etape} />
          <p className="text-sm">{enCours.libelle}… {formaterDuree(ecoule)} — {attenteAnnoncee()}</p>
          {enCours.alerte && <Alert>{enCours.alerte}</Alert>}
          <Button variant="outline" className="self-start" onClick={annuler}>Annuler la lecture</Button>
        </div>
      )}
      {echec && (
        <Alert variant={echec.ton === "erreur" ? "erreur" : "info"}>
          <p className="font-medium">{echec.libelle}</p>
          {echec.alerte && <p>{echec.alerte}</p>}
          <div className="mt-2 flex flex-wrap gap-2">
            <Button size="sm" onClick={reessayer}>↻ Réessayer</Button>
            <Button size="sm" variant="outline" asChild><Link to="/commandes/nouveau">Saisir à la main</Link></Button>
          </div>
        </Alert>
      )}
      {lecture.isSuccess && <ResultatLecture extraction={lecture.data.extraction} fichier={lecture.data.fichier} clients={clients.data ?? []} />}
    </div>
  );
}
