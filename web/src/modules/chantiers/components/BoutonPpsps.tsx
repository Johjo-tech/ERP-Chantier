import { todayISO } from "@/lib/dates";
import { messageErreur } from "@/lib/erreurs";
import { afficherToast } from "@/lib/toast";
import type { Chantier } from "../domain/chantier";
import { contenuPpsps, nomFichierPpsps } from "../domain/ppsps";
import { ecrireDocx, MIME_DOCX } from "../fichiers/docx";
import { useIdentitePpsps } from "../hooks/useFiche";
import { telecharger } from "./telechargement";
import { BULLE_BREVE_MS } from "./durees";

/**
 * « 📄 Générer (Word) » (CHA-05) : le PPSPS du chantier, rempli avec l'identité
 * de la société et les champs PPSPS de la fiche, téléchargé en .docx. Rien
 * n'est enregistré : l'utilisateur le complète puis le redépose s'il veut le garder.
 */
export function BoutonPpsps({ chantier }: { chantier: Chantier }) {
  const identite = useIdentitePpsps();
  function generer() {
    afficherToast("Génération du PPSPS en cours…", "success", BULLE_BREVE_MS);
    identite.mutate(undefined, {
      onSuccess: (s) => telecharger(ecrireDocx(contenuPpsps(chantier, s, todayISO())), nomFichierPpsps(chantier.nom), MIME_DOCX),
      onError: (err) => afficherToast(messageErreur(err)),
    });
  }
  return (
    <button type="button" className="btn small primary" onClick={generer} disabled={identite.isPending}>
      📄 Générer (Word)
    </button>
  );
}
