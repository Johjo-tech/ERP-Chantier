import { useState } from "react";
import { messageErreur } from "@/lib/erreurs";
import { preparerDocument } from "@/modules/ocr/api/preparer";
import { refusPieceJointe } from "../domain/pieceJointe";

interface Document {
  chemin: string | null;
  nom: string | null;
  mime: string | null;
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
