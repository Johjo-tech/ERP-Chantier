import { afficherToast } from "@/lib/toast";
import { definirModeDiscret, useModeDiscret } from "@/lib/modeDiscret";

/** L'ancien écran l'annonçait deux secondes. */
const DUREE_ANNONCE_MS = 2000;

/**
 * L'interrupteur du mode discret (TRV-05, `toggleGhostMode`) : sans libellé à
 * l'écran, comme l'ancien — son infobulle le nomme, et le lecteur d'écran
 * l'entend par son `aria-label`.
 */
export function InterrupteurDiscret({ place }: { place: "Desktop" | "Mobile" }) {
  const discret = useModeDiscret();
  return (
    <label className="ghost-toggle" title="Mode fantôme : masquer les prix à l'écran">
      <input
        type="checkbox"
        id={`ghostModeToggle${place}`}
        aria-label="Mode discret (montants masqués)"
        checked={discret}
        onChange={(e) => {
          definirModeDiscret(e.target.checked);
          afficherToast(e.target.checked ? "Mode discret activé" : "Mode discret désactivé", "success", DUREE_ANNONCE_MS);
        }}
      />
      <span className="ghost-toggle-slider" />
    </label>
  );
}
