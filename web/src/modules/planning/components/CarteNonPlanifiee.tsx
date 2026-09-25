import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { CartePlanning } from "../domain/cartes";
import { HEURE_DEFAUT } from "../domain/taches";
import { usePlanningContexte } from "./contexte";
import { numeroDeLaCarte } from "./format";
import { InfosCarte, MontantCarte } from "./InfosCarte";
import { MontantSousTraitant } from "./MontantSousTraitant";
import { ZoneContacts } from "./ZoneContacts";

/** Une carte de la colonne « Non planifiés » : à glisser sur la grille, ou à dater au clavier (PLN-04). */
export function CarteNonPlanifiee({ carte, onGlisser }: { carte: CartePlanning; onGlisser: (c: CartePlanning) => void }) {
  const { peutPlanifier, ouvrirFiche, poser, couleurMetier } = usePlanningContexte();
  const couleur = couleurMetier(carte.metier);
  return (
    <li
      aria-label={`${carte.bon.client_nom}, ${numeroDeLaCarte(carte)}`}
      draggable={peutPlanifier}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", carte.id);
        onGlisser(carte);
      }}
      style={couleur ? { borderRightColor: couleur, borderRightWidth: 5 } : undefined}
      className={cn("relative flex cursor-pointer flex-col gap-1 rounded-md border bg-card p-2 shadow-sm", carte.faite && "bg-emerald-50", carte.isSav && "border-l-4 border-l-destructive")}
      onClick={() => ouvrirFiche(carte, null)}
    >
      <InfosCarte carte={carte} />
      <ZoneContacts carte={carte} />
      <MontantSousTraitant carte={carte} />
      {peutPlanifier && (
        <label className="flex items-center gap-1 text-xs" onClick={(e) => e.stopPropagation()}>
          Planifier le
          <Input type="date" className="h-7 w-36 px-1 text-xs" value="" onChange={(e) => e.target.value && poser(carte, e.target.value, carte.rdv.heurePlanifiee ?? HEURE_DEFAUT)} />
        </label>
      )}
      <MontantCarte carte={carte} />
    </li>
  );
}
