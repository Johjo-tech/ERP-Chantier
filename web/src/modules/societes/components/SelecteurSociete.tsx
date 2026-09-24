import { Select } from "@/components/ui/input";
import { useSession } from "@/modules/auth-roles/hooks/useSession";

/** En haut à gauche : la société sur laquelle on travaille. */
export function SelecteurSociete() {
  const { etat, societeActive, choisirSociete } = useSession();
  if (etat.statut !== "connecte" || !societeActive) return null;
  const { societes } = etat.session;

  if (societes.length === 1) {
    return <span className="truncate font-semibold">{societeActive.nom}</span>;
  }
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor="selecteur-societe" className="sr-only">
        Société active
      </label>
      <Select
        id="selecteur-societe"
        value={societeActive.id}
        onChange={(e) => choisirSociete(e.target.value)}
        className="font-semibold"
      >
        {societes.map((s) => (
          <option key={s.id} value={s.id}>
            {s.nom}
          </option>
        ))}
      </Select>
    </div>
  );
}
