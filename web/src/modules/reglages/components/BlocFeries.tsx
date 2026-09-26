import { Chargement, Erreur } from "@/components/etats/Etats";
import { afficherToast } from "@/lib/toast";
import { messageErreur } from "@/lib/erreurs";
import { usePermission } from "@/modules/auth-roles/hooks/useSession";
import { useDefinirFeriesAlsaceMoselle, useFeriesAlsaceMoselle } from "@/modules/societes/hooks/useFeries";

/**
 * Réglages › Organisation : la société est-elle en Alsace-Moselle (PLN-53) ?
 * Absent de l'ancien écran (qui ne grisait aucun férié) : une carte de plus
 * sous la fiche, dans ses habits (D-ECR-PAR-10). Enregistré au clic : c'est
 * une seule case, sans rapport avec le formulaire d'identité au-dessus.
 */
export function BlocFeries() {
  const lu = useFeriesAlsaceMoselle();
  const definir = useDefinirFeriesAlsaceMoselle();
  const modifiable = usePermission("reglages", "modifier");
  return (
    <div className="card">
      <div className="card-title" style={{ marginBottom: "4px" }}>
        📅 Jours fériés
      </div>
      <div className="card-sub" style={{ marginBottom: "10px" }}>
        Le planning grise les fériés nationaux. En Bas-Rhin, Haut-Rhin et Moselle, le droit local y ajoute le Vendredi saint et le 26 décembre.
      </div>
      {lu.isPending ? (
        <Chargement />
      ) : lu.isError ? (
        <Erreur erreur={lu.error} reessayer={() => void lu.refetch()} />
      ) : (
        <label className="bc-tache-row">
          <input
            type="checkbox"
            checked={definir.isPending ? definir.variables : lu.data}
            disabled={!modifiable || definir.isPending}
            onChange={(e) =>
              definir.mutate(e.target.checked, {
                onSuccess: () => afficherToast("Réglage des jours fériés enregistré.", "success"),
                onError: (err) => afficherToast(messageErreur(err)),
              })
            }
          />
          <span>Société établie en Alsace-Moselle (Vendredi saint et 26 décembre fériés)</span>
        </label>
      )}
    </div>
  );
}
