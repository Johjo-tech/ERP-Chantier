import { useId, useState, type FormEvent } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { messageErreur } from "@/lib/erreurs";
import { montant } from "@/lib/money";
import { formatEurosEcran } from "@/lib/modeDiscret";
import { useSocieteActive } from "@/modules/auth-roles/hooks/useSession";
import type { LigneDpgfBase } from "../api/dpgf";
import type { TachePlanifiee } from "../api/planification";
import type { Chantier } from "../domain/chantier";
import { planifier, quantiteDejaPlanifiee, quantiteRestante } from "../domain/planification";
import { usePlanifierQuantite } from "../hooks/useChantiers";

interface Props {
  chantier: Chantier;
  ligne: LigneDpgfBase;
  taches: readonly TachePlanifiee[];
  fermer: () => void;
  planifiee: () => void;
}

/**
 * « Planifier une quantité » (CHA-09, CHA-21) : la part saisie devient un bon
 * de commande, à placer ensuite au planning. Le métier de la ligne est celui
 * ENREGISTRÉ : une saisie non enregistrée ne part pas dans le bon.
 */
export function DialoguePlanifier({ chantier, ligne, taches, fermer, planifiee }: Props) {
  const societe = useSocieteActive();
  const titre = useId();
  const [saisie, setSaisie] = useState("");
  const [refus, setRefus] = useState<string | null>(null);
  const creer = usePlanifierQuantite(chantier.id);
  const deja = quantiteDejaPlanifiee(taches.filter((t) => t.dpgf_ligne_id === ligne.id));
  const restante = quantiteRestante(ligne, deja);
  const apercu = montant(saisie).times(montant(ligne.prix_unitaire));

  function valider(e: FormEvent) {
    e.preventDefault();
    const p = planifier(ligne, deja, saisie, chantier.nom);
    if (!p.ok) return setRefus(p.motif);
    setRefus(null);
    const metier = ligne.metier ?? "";
    creer.mutate(
      { societeId: societe.id, chantier, ligne: { id: ligne.id, metier }, quantite: p.quantite, montant: p.montant, libelle: p.libelle },
      { onSuccess: planifiee }
    );
  }

  return (
    <form onSubmit={valider} role="dialog" aria-labelledby={titre} className="flex flex-col gap-2 rounded-md border border-primary/40 bg-primary/5 p-3">
      <h3 id={titre} className="text-sm font-semibold">Planifier une quantité</h3>
      <p className="text-sm">
        {ligne.designation} — {deja.toString().replace(".", ",")} / {String(ligne.quantite).replace(".", ",")} déjà planifié. Reste {restante.toString().replace(".", ",")} à planifier.
      </p>
      {refus && <Alert variant="erreur">{refus}</Alert>}
      {creer.isError && <Alert variant="erreur">{messageErreur(creer.error)}</Alert>}
      <label className="flex items-center gap-2 text-sm">
        <span>Quantité</span>
        <Input autoFocus aria-label="Quantité à planifier" inputMode="decimal" className="w-24" value={saisie} onChange={(e) => setSaisie(e.target.value)} />
        <span className="text-muted-foreground">sur {restante.toString().replace(".", ",")} restant(s)</span>
      </label>
      <p className="text-sm text-muted-foreground">Montant correspondant : {formatEurosEcran(apercu)}</p>
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={creer.isPending}>{creer.isPending ? "Création…" : "Créer le bon"}</Button>
        <Button type="button" size="sm" variant="ghost" onClick={fermer}>Annuler</Button>
      </div>
    </form>
  );
}
