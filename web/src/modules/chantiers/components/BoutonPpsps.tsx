import { Button } from "@/components/ui/button";
import { todayISO } from "@/lib/dates";
import { messageErreur } from "@/lib/erreurs";
import type { Chantier } from "../domain/chantier";
import { contenuPpsps, nomFichierPpsps } from "../domain/ppsps";
import { ecrireDocx, MIME_DOCX } from "../fichiers/docx";
import { useIdentitePpsps } from "../hooks/useFiche";
import { telecharger } from "./telechargement";

/**
 * « Générer (Word) » (CHA-05) : le PPSPS du chantier, rempli avec l'identité de
 * la société et les champs PPSPS de la fiche, téléchargé en .docx. Rien n'est
 * enregistré : l'utilisateur le complète puis le redépose s'il veut le garder.
 */
export function BoutonPpsps({ chantier }: { chantier: Chantier }) {
  const identite = useIdentitePpsps();
  function generer() {
    identite.mutate(undefined, {
      onSuccess: (s) => telecharger(ecrireDocx(contenuPpsps(chantier, s, todayISO())), nomFichierPpsps(chantier.nom), MIME_DOCX),
    });
  }
  return (
    <span className="inline-flex flex-col items-end gap-1">
      <Button size="sm" variant="outline" onClick={generer} disabled={identite.isPending}>
        {identite.isPending ? "Génération…" : "Générer (Word)"}
      </Button>
      {identite.isError && <span role="alert" className="text-xs text-destructive">{messageErreur(identite.error)}</span>}
    </span>
  );
}
