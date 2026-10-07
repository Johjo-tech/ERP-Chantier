import { useState } from "react";
import { Modale } from "@/components/ui/modale";
import { lienMailto, texteACopier, type BrouillonEmail } from "@/modules/documents/domain/email";
import { showToast } from "@/modules/documents/impression/zone";
import { DUREE_AVIS } from "../domain/avis";

/**
 * « Envoyer par email » (`#emailModal` d'index.html, `openEmailComposeModal`,
 * app.js l. 11922) : télécharger le PDF, puis ouvrir la messagerie ou copier
 * le texte — aucun service d'envoi. Même fenêtre, mêmes étapes numérotées,
 * mêmes avis.
 */
export function ModaleEmail({ brouillon, telecharger, fermer }: { brouillon: BrouillonEmail; telecharger: () => void; fermer: () => void }) {
  const [b, setB] = useState(brouillon);
  const [telecharge, setTelecharge] = useState(false);

  function ouvrirMessagerie() {
    window.location.href = lienMailto(b);
    showToast("Si votre messagerie ne s'est pas ouverte, utilisez \"Copier le texte\" ci-dessous et collez-le dans votre webmail.", "success", DUREE_AVIS.messagerie);
  }

  function copier() {
    navigator.clipboard.writeText(texteACopier(b)).then(
      () => showToast("Texte copié — collez-le dans votre messagerie.", "success", DUREE_AVIS.texteCopie),
      (e: unknown) => {
        console.warn("Copie refusée par le navigateur", e);
        showToast("Impossible de copier automatiquement. Sélectionnez et copiez le texte manuellement.");
      }
    );
  }

  return (
    <Modale titre="Envoyer par email" onFermer={fermer} largeurMax="520px">
      <div className="field full">
        <label htmlFor="emailDownloadBtn">1. Télécharger le document</label>
        <button type="button" className="btn" id="emailDownloadBtn" onClick={() => { telecharger(); setTelecharge(true); }}>
          {telecharge ? "✓ Téléchargé — vérifiez votre dossier Téléchargements" : "📄 Télécharger le PDF"}
        </button>
      </div>
      <div className="field full" style={{ marginTop: "14px" }}>
        <label htmlFor="email_dest">2. Destinataire</label>
        <input type="email" id="email_dest" placeholder="client@exemple.fr" value={b.destinataire} onChange={(e) => setB({ ...b, destinataire: e.target.value })} />
      </div>
      <div className="field full">
        <label htmlFor="email_subject">Objet</label>
        <input type="text" id="email_subject" value={b.objet} onChange={(e) => setB({ ...b, objet: e.target.value })} />
      </div>
      <div className="field full">
        <label htmlFor="email_body">Message</label>
        <textarea id="email_body" rows={8} value={b.corps} onChange={(e) => setB({ ...b, corps: e.target.value })} />
      </div>
      <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginTop: "10px" }}>
        <button type="button" className="btn primary" onClick={ouvrirMessagerie}>3. Ouvrir dans ma messagerie</button>
        <button type="button" className="btn" onClick={copier}>Copier le texte</button>
      </div>
      <div style={{ marginTop: "12px", fontSize: "12px", color: "var(--text-dim)", lineHeight: 1.5 }}>
        N'oubliez pas de joindre le PDF téléchargé (étape 1) avant d'envoyer — aucun site web ne peut le faire automatiquement pour des raisons de sécurité du navigateur. Si votre messagerie ne s'ouvre pas à l'étape 3 (aucune appli mail configurée sur cet appareil), utilisez "Copier le texte" et collez-le dans votre webmail (Gmail, Outlook…).
      </div>
    </Modale>
  );
}
