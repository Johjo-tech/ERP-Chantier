import { dansLaPlage, estFerie, joursDeLaSemaine, libelleSemaine } from "../domain/calendrier";
import type { CartePlanning } from "../domain/cartes";
import { usePlanningContexte } from "./contexte";
import { adresseDuLieu } from "./format";

const NON_ASSIGNE = "Non assigné";

/**
 * Le planning de la semaine, à imprimer en paysage (PLN-11) : une colonne par
 * équipe (ou sous-traitant) ayant du travail, une ligne par jour. Invisible à
 * l'écran ; seul visible à l'impression.
 */
export function PlanningImprimable({ cartes, lundi, societe }: { cartes: CartePlanning[]; lundi: string; societe: string }) {
  const { affectation, nomEquipe, nomSousTraitant } = usePlanningContexte();
  const jours = joursDeLaSemaine(lundi);
  const semaine = cartes.filter((c) => jours.some((j) => dansLaPlage(j.iso, c.rdv.datePlanifiee, c.rdv.datePlanifieeFin)));
  const colonneDe = (c: CartePlanning) => (affectation === "sous_traitant" ? nomSousTraitant(c.sousTraitantId) : nomEquipe(c.equipeId)) ?? NON_ASSIGNE;
  const colonnes = [...new Set(semaine.map(colonneDe))].sort((a, b) => (a === NON_ASSIGNE ? 1 : b === NON_ASSIGNE ? -1 : a.localeCompare(b, "fr")));
  if (!colonnes.length) colonnes.push(NON_ASSIGNE);
  return (
    <div className="zone-impression hidden print:block">
      <style>{"@media print { @page { size: A4 landscape; margin: 8mm; } body * { visibility: hidden; } .zone-impression, .zone-impression * { visibility: visible; } .zone-impression { position: absolute; inset: 0; } }"}</style>
      <h1 className="mb-2 text-base font-bold">{societe} — Planning {affectation === "sous_traitant" ? "Sous-traitants" : "Techniciens"} — {libelleSemaine(lundi)}</h1>
      <table className="w-full border-collapse text-[10px]">
        <thead>
          <tr>
            <th className="w-20 border" />
            {colonnes.map((c) => <th key={c} className="border px-1">{c}</th>)}
          </tr>
        </thead>
        <tbody>
          {jours.map((j) => (
            <tr key={j.iso}>
              <td className="border px-1 align-top font-semibold">{j.libelle}<br />{j.numero} {j.mois}{estFerie(j.iso) && <><br />Férié</>}</td>
              {colonnes.map((col) => {
                const items = semaine.filter((c) => dansLaPlage(j.iso, c.rdv.datePlanifiee, c.rdv.datePlanifieeFin) && colonneDe(c) === col).sort((a, b) => (a.rdv.heurePlanifiee ?? "").localeCompare(b.rdv.heurePlanifiee ?? ""));
                return (
                  <td key={col} className="border px-1 align-top">
                    {items.length ? items.map((c) => (
                      <div key={c.id} className="mb-1">
                        <b>{c.bon.client_nom}</b> {adresseDuLieu(c)}
                        <br />
                        {c.metier ?? ""}{c.rdv.heurePlanifiee ? ` · ${c.rdv.heurePlanifiee}` : ""}
                      </div>
                    )) : "—"}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
