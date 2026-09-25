import { useState } from "react";
import { ChampTexte, ChampZone } from "@/components/formulaire/Champ";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { messageErreur } from "@/lib/erreurs";
import { lienMailto, texteACopier, type BrouillonEmail } from "../domain/email";
import type { ModeleDocument } from "../domain/modele";
import { BoutonPdf } from "./BoutonPdf";

interface Props {
  brouillon: BrouillonEmail;
  modele: ModeleDocument | null;
  /** Passe avant l'ouverture de la messagerie et avant le PDF (cadenas d'une facture, FAC-12). */
  avant?: () => Promise<void>;
  fermer: () => void;
}

/**
 * Préparer l'envoi : texte modifiable, PDF à joindre, messagerie de
 * l'utilisateur (`mailto:`), ou copie pour un webmail — le parcours de
 * l'ancienne fenêtre (app.js l. 11816-11850), sans service d'envoi.
 */
export function PanneauEmail({ brouillon, modele, avant, fermer }: Props) {
  const [b, setB] = useState(brouillon);
  const [avis, setAvis] = useState<{ ok: boolean; texte: string } | null>(null);

  async function ouvrirMessagerie() {
    try {
      if (avant) await avant();
      window.location.href = lienMailto(b);
      setAvis({ ok: true, texte: "Si votre messagerie ne s'est pas ouverte, utilisez « Copier le texte » et collez-le dans votre webmail." });
    } catch (err) {
      setAvis({ ok: false, texte: messageErreur(err) });
    }
  }

  async function copier() {
    try {
      await navigator.clipboard.writeText(texteACopier(b));
      setAvis({ ok: true, texte: "Texte copié — collez-le dans votre messagerie." });
    } catch (err) {
      console.warn("Copie refusée par le navigateur", err);
      setAvis({ ok: false, texte: "Impossible de copier automatiquement. Sélectionnez et copiez le texte à la main." });
    }
  }

  return (
    <section role="dialog" aria-label="Envoyer par e-mail" className="flex flex-col gap-3 rounded-md border border-border p-3">
      <ChampTexte libelle="Destinataire" type="email" valeur={b.destinataire} onChange={(v) => setB({ ...b, destinataire: v })} />
      <ChampTexte libelle="Objet" valeur={b.objet} onChange={(v) => setB({ ...b, objet: v })} />
      <ChampZone libelle="Message" valeur={b.corps} onChange={(v) => setB({ ...b, corps: v })} />
      <p className="text-sm text-muted-foreground">Téléchargez le PDF, puis joignez-le au message ouvert dans votre messagerie.</p>
      {avis && <Alert variant={avis.ok ? "succes" : "erreur"}>{avis.texte}</Alert>}
      <div className="flex flex-wrap gap-2">
        <BoutonPdf modele={modele} avant={avant} />
        <Button onClick={() => void ouvrirMessagerie()}>Ouvrir la messagerie</Button>
        <Button variant="outline" onClick={() => void copier()}>Copier le texte</Button>
        <Button variant="ghost" onClick={fermer}>Fermer</Button>
      </div>
    </section>
  );
}
