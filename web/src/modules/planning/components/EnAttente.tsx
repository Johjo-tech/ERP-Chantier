import { Link } from "react-router";
import { Can } from "@/modules/auth-roles/components/Can";
import { LIBELLES_STATUT, statutDe } from "../domain/taches";
import type { CartePlanning } from "../domain/cartes";
import { usePlanningContexte } from "./contexte";
import { InfosCarte } from "./InfosCarte";

/**
 * « En attente technicien / sous-traitant » : les bons dont le terrain n'a pas
 * fini (ni SAV, ni circuit clos, ni tout validé), avec l'état de chaque tâche.
 */
export function EnAttente({ cartes, mode }: { cartes: CartePlanning[]; mode: "equipe" | "sous_traitant" }) {
  const { ouvrirFiche, donnees, nomSousTraitant, nomEquipe } = usePlanningContexte();
  return (
    <section aria-label={mode === "sous_traitant" ? "En attente sous-traitant" : "En attente technicien"} className="flex flex-col gap-2">
      <p className="text-sm text-muted-foreground">
        {mode === "sous_traitant" ? "Bons de commande assignés à un sous-traitant, en attente de validation." : "Bons de commande gérés en interne (techniciens), en attente de validation."}
      </p>
      {!cartes.length && <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">Aucun bon de commande ne correspond.</p>}
      <ul className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {cartes.map((c) => {
          const taches = donnees.taches.filter((t) => t.bon_commande_id === c.bcId);
          return (
            <li key={c.bcId} className="flex cursor-pointer flex-col gap-1 rounded-md border bg-card p-2" onClick={() => ouvrirFiche(c, null)}>
              <InfosCarte carte={c} />
              <ul className="text-xs">
                {taches.map((t) => (
                  <li key={t.id}>
                    {t.metier ?? "Sans métier"} : {LIBELLES_STATUT[statutDe(t.statut)]}
                    {t.date_tache ? ` (${t.date_tache.split("-").reverse().join("/")})` : " (à replanifier)"}
                    {" — "}
                    {nomEquipe(t.technicien_id) ?? nomSousTraitant(t.sous_traitant_id) ?? "non affectée"}
                  </li>
                ))}
                {!taches.length && <li className="text-muted-foreground">Aucune tâche au planning.</li>}
              </ul>
              <Can module="bons_commande">
                <Link to={`/commandes/${c.bcId}`} className="self-start text-xs text-primary underline" onClick={(e) => e.stopPropagation()}>Ouvrir le bon</Link>
              </Can>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
