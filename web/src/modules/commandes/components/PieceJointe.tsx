import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { messageErreur } from "@/lib/erreurs";
import { preparerDocument } from "@/modules/ocr/api/preparer";
import { apercuDe, refusPieceJointe, urlApercuPdf } from "../domain/pieceJointe";
import { useUrlPieceJointe } from "../hooks/useBons";

interface Document {
  chemin: string | null;
  nom: string | null;
  mime: string | null;
}

/**
 * Le bon du client tel qu'il l'a envoyé, affiché d'après une URL signée
 * (bucket privé) demandée une seule fois par chemin (BC-09, BC-73).
 */
export function ApercuPieceJointe({ doc, grand = false }: { doc: Document; grand?: boolean }) {
  const url = useUrlPieceJointe(doc.chemin);
  if (!doc.chemin) return null;
  if (url.isPending) return <p className="text-sm text-muted-foreground">Chargement du document…</p>;
  if (url.isError) return <Alert variant="erreur">{messageErreur(url.error)}</Alert>;
  const mode = apercuDe(doc.mime, doc.nom);
  const titre = doc.nom ?? "Bon du client";
  const hauteur = grand ? "h-[80vh]" : "h-96";
  return (
    <figure className="flex flex-col gap-2">
      {mode === "image" && <img src={url.data} alt={titre} className={`${hauteur} w-full object-contain`} />}
      {mode === "pdf" && <iframe src={urlApercuPdf(url.data)} title={titre} className={`${hauteur} w-full rounded border`} />}
      <figcaption className="text-xs">
        <a href={url.data} target="_blank" rel="noreferrer" className="text-primary hover:underline">Ouvrir « {titre} » dans un nouvel onglet</a>
      </figcaption>
    </figure>
  );
}

interface Props {
  doc: Document;
  /** Le fichier choisi, pas encore rangé ; `null` = retrait demandé ; `undefined` = rien ne change. */
  enAttente: File | null | undefined;
  onChange: (f: File | null | undefined) => void;
  /** Le bucket suit `peut_ecrire` : sans ce droit, l'écran ne propose pas un dépôt que la base refuserait. */
  peutDeposer: boolean;
  lectureSeule: boolean;
}

/**
 * Le champ « Pièce jointe » du bon, dans l'habit de l'ancien : le nom du
 * document et sa croix, puis le sélecteur de fichier. PDF, JPEG, PNG ou WebP,
 * 14 Mo au plus ; retirer demande explicitement de vider le chemin. Le fichier
 * part au stockage à l'enregistrement du bon, jamais avant.
 */
export function ChampPieceJointe({ doc, enAttente, onChange, peutDeposer, lectureSeule }: Props) {
  const [refus, setRefus] = useState<string | null>(null);
  const nom = enAttente === undefined ? (doc.chemin ? (doc.nom ?? "Bon du client") : null) : enAttente ? enAttente.name : null;
  /** La même préparation que la lecture automatique : ce que l'une accepte, l'autre l'archive (HEIC converti, image allégée). */
  async function choisir(f: File | undefined) {
    if (!f) return;
    try {
      const pret = await preparerDocument(f);
      const motif = refusPieceJointe({ name: pret.name, type: pret.type, size: pret.size });
      setRefus(motif);
      if (!motif) onChange(pret);
    } catch (e) {
      setRefus(messageErreur(e));
    }
  }
  const modifiable = !lectureSeule && peutDeposer;
  return (
    <div className="field full">
      <label htmlFor="bc_pieceJointe">Pièce jointe (bon de commande scanné)</label>
      <div id="bcAttachmentPreview">
        {nom && (
          <div className="card-sub" style={{ marginBottom: "6px" }}>
            📎 {nom}{" "}
            {modifiable && <button className="btn small danger" type="button" aria-label="Retirer la pièce jointe" onClick={() => onChange(doc.chemin ? null : undefined)}>✕</button>}
          </div>
        )}
      </div>
      <input type="file" id="bc_pieceJointe" accept="application/pdf,image/*,.heic,.heif" disabled={!modifiable} onChange={(e) => void choisir(e.target.files?.[0])} />
      {!lectureSeule && !peutDeposer && <div className="card-sub">Le dépôt de documents est réservé à l&apos;administrateur, au conducteur et au terrain.</div>}
      {refus && <small className="champ-erreur" role="alert">{refus}</small>}
    </div>
  );
}
