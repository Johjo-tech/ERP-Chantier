import type { CartePlanning } from "../domain/cartes";
import { usePlanningContexte } from "./contexte";
import { BarreSav, LignesCarte, MontantCarte, PieceJointeCarte, TitreCarte } from "./InfosCarte";
import { MontantSousTraitant } from "./MontantSousTraitant";
import { ZoneContacts } from "./ZoneContacts";

/**
 * Une carte de la colonne « Non planifiés » (`planningCardHTML`, PLN-04) : à
 * glisser sur une case horaire, ou à dater par son champ — l'heure déjà posée
 * reste alors celle du bon.
 */
export function CarteNonPlanifiee({ carte, onGlisser }: { carte: CartePlanning; onGlisser: (c: CartePlanning) => void }) {
  const { peutPlanifier, ouvrirFiche, dater, couleurMetier } = usePlanningContexte();
  const couleur = couleurMetier(carte.metier);
  return (
    <div
      className={`planning-card ${carte.faite ? "planning-card-fait" : ""}`}
      draggable={peutPlanifier}
      aria-label={`${carte.bon.client_nom} ${carte.bon.numero_bc ?? ""}`.trim()}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", carte.id);
        onGlisser(carte);
      }}
      onClick={(e) => {
        e.stopPropagation();
        ouvrirFiche(carte, null);
      }}
      style={couleur ? { borderRight: `5px solid ${couleur}` } : undefined}
    >
      <TitreCarte carte={carte} />
      <ZoneContacts carte={carte} />
      <LignesCarte carte={carte} avecPiece />
      <MontantSousTraitant carte={carte} />
      {/* Masqué à qui ne planifie pas : la base le refuserait (D-ECR-PLN-03). */}
      {peutPlanifier && (
        <input
          type="date"
          className="planning-quick-date"
          aria-label="Planifier le"
          value=""
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => e.target.value && dater(carte, e.target.value)}
          title="Choisir une date (alternative au glisser-déposer)"
        />
      )}
      <MontantCarte carte={carte} />
      <PieceJointeCarte carte={carte} avecNom />
      <BarreSav carte={carte} />
    </div>
  );
}
