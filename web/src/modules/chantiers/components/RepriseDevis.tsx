import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { messageErreur } from "@/lib/erreurs";
import type { LigneDpgfBase } from "../api/dpgf";
import type { DevisAvecLignes } from "../api/liens";
import { repriseDevis } from "../domain/devis-vers-dpgf";
import { useRepriseDevis } from "../hooks/useChantiers";

interface Props {
  chantierId: string;
  devis: readonly DevisAvecLignes[];
  lignes: readonly LigneDpgfBase[];
  figees: ReadonlySet<string>;
}

/**
 * « Ajouter au DPGF » les lignes d'un devis du chantier (CHA-15). L'ancien
 * écran le faisait à l'enregistrement du devis ; ici le geste est explicite,
 * depuis le DPGF, et refusé si des lignes de ce devis sont déjà facturées ou
 * planifiées (D-CHA-06).
 */
export function RepriseDevis({ chantierId, devis, lignes, figees }: Props) {
  const [choix, setChoix] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const reprendre = useRepriseDevis(chantierId);
  if (!devis.length) return null;

  function lancer() {
    const d = devis.find((x) => x.id === choix);
    if (!d) return;
    const r = repriseDevis(d.id, d.devis_lignes, lignes, figees);
    if (r.conservees) return setMessage(`Des lignes du devis ${d.numero ?? ""} sont déjà facturées ou planifiées : le DPGF n'est pas modifié.`);
    if (!r.aAjouter.length) return setMessage("Ce devis n'a aucune ligne à reprendre.");
    const suivante = lignes.reduce((max, l) => Math.max(max, l.position), -1) + 1;
    reprendre.mutate(
      { reprise: r, positionSuivante: suivante },
      { onSuccess: () => setMessage(`${r.aAjouter.length} ligne(s) du devis ${d.numero ?? ""} ajoutée(s) au DPGF.`) }
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="flex items-center gap-2 text-sm">
        Reprendre un devis
        <Select className="w-48" value={choix} onChange={(e) => setChoix(e.target.value)}>
          <option value="">— Choisir —</option>
          {devis.map((d) => (
            <option key={d.id} value={d.id}>{d.numero ?? "Brouillon"}</option>
          ))}
        </Select>
      </label>
      <Button size="sm" variant="outline" onClick={lancer} disabled={!choix || reprendre.isPending}>Ajouter au DPGF</Button>
      {message && <span role="status" className="text-xs text-muted-foreground">{message}</span>}
      {reprendre.isError && <Alert variant="erreur">{messageErreur(reprendre.error)}</Alert>}
    </div>
  );
}
