import { useId, useState, type FormEvent } from "react";
import { Modale, PiedModale } from "@/components/ui/modale";
import { messageErreur } from "@/lib/erreurs";
import { montant } from "@/lib/money";
import { formatEurosEcran, useModeDiscret } from "@/lib/modeDiscret";
import { afficherToast } from "@/lib/toast";
import { useSocieteActive } from "@/modules/auth-roles/hooks/useSession";
import type { LigneDpgfBase } from "../api/dpgf";
import type { TachePlanifiee } from "../api/planification";
import type { Chantier } from "../domain/chantier";
import { planifier, quantiteDejaPlanifiee, quantiteRestante } from "../domain/planification";
import { usePlanifierQuantite } from "../hooks/useChantiers";
import { BULLE_CONSIGNE_MS } from "./durees";

interface Props {
  chantier: Chantier;
  ligne: LigneDpgfBase;
  taches: readonly TachePlanifiee[];
  fermer: () => void;
}

/**
 * « Planifier une quantité » (CHA-09, CHA-21), la modale de l'ancien
 * (`#planifierQteModal`) : la part saisie devient un bon de commande, à placer
 * ensuite au planning. Le métier de la ligne est celui ENREGISTRÉ.
 */
export function DialoguePlanifier({ chantier, ligne, taches, fermer }: Props) {
  useModeDiscret();
  const societe = useSocieteActive();
  const idQte = useId();
  const [saisie, setSaisie] = useState("");
  const creer = usePlanifierQuantite(chantier.id);
  const deja = quantiteDejaPlanifiee(taches.filter((t) => t.dpgf_ligne_id === ligne.id));
  const restante = quantiteRestante(ligne, deja);
  const total = String(ligne.quantite);
  const apercu = montant(saisie).times(montant(ligne.prix_unitaire));

  function valider(e: FormEvent) {
    e.preventDefault();
    const p = planifier(ligne, deja, saisie, chantier.nom);
    if (!p.ok) return afficherToast(p.motif);
    creer.mutate(
      { societeId: societe.id, chantier, ligne: { id: ligne.id, metier: ligne.metier ?? "" }, quantite: p.quantite, montant: p.montant, libelle: p.libelle },
      {
        onSuccess: () => {
          fermer();
          afficherToast("Tâche créée — retrouvez-la dans \"Non planifiés\" du Planning pour l'assigner.", "success", BULLE_CONSIGNE_MS);
        },
        onError: (err) => afficherToast(messageErreur(err)),
      }
    );
  }

  return (
    <Modale titre="Planifier une quantité" onFermer={fermer} largeurMax="460px">
      <form onSubmit={valider} noValidate>
        <p className="card-sub">
          {ligne.designation} — {deja.toString()} / {total} déjà planifié{deja.gt(1) ? "s" : ""}. Reste {restante.toString()} à planifier.
        </p>
        <div className="field">
          <label htmlFor={idQte}>Quantité à planifier maintenant (sur {restante.toString()} restant(s))</label>
          <input type="number" step="0.01" min="0.01" id={idQte} autoFocus value={saisie} onChange={(e) => setSaisie(e.target.value)} />
        </div>
        <div className="card-sub" style={{ marginBottom: "14px" }}>
          Montant correspondant : {formatEurosEcran(apercu)}
        </div>
        <PiedModale>
          <button type="submit" className="btn primary" disabled={creer.isPending}>
            Créer la tâche
          </button>
          <button type="button" className="btn ghost" onClick={fermer}>
            Annuler
          </button>
        </PiedModale>
      </form>
    </Modale>
  );
}
