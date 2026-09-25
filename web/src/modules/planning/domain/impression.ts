import { esc, metierDisplayLabel, withVille } from "@/modules/documents/impression/gabarit";
import type { JourDeSemaine } from "./calendrier";

/** « 2026 » en tête d'une date ISO : le `getFullYear()` du lundi, dans l'ancien. */
const LONGUEUR_ANNEE = 4;

/** Une intervention posée sur la semaine, sous les noms que lit `printPlanning`. */
export interface TravailImprime {
  client: string | null;
  adresse: string | null;
  codePostal: string | null;
  ville: string | null;
  metier: string | null;
  heurePlanifiee: string | null;
}

export interface PlanningAImprimer {
  societeNom: string;
  sousTraitants: boolean;
  jours: readonly JourDeSemaine[];
  /** Les colonnes déjà triées, « Non assigné » en dernier. */
  colonnes: readonly string[];
  /** Le travail d'une case (jour × colonne), déjà trié par heure. */
  travaux: (jour: string, colonne: string) => readonly TravailImprime[];
  estFerie: (jour: string) => boolean;
}

/**
 * Le planning de la semaine imprimé en paysage — PORT LITTÉRAL du HTML de
 * `printPlanning` (app.js l. 5050-5102) : mêmes classes `.p-print-*`, que
 * `documents/impression/impression.css` met en page comme l'ancien.
 */
export function htmlPlanningImprime(p: PlanningAImprimer): string {
  const premier = p.jours[0];
  const dernier = p.jours[p.jours.length - 1];
  const annee = premier ? premier.iso.slice(0, LONGUEUR_ANNEE) : "";
  const weekLabel = premier && dernier ? `${premier.numero} ${premier.mois} — ${dernier.numero} ${dernier.mois} ${annee}` : "";
  const headerRow = `<tr><th style="width:26mm;"></th>${p.colonnes.map((c) => `<th>${esc(c)}</th>`).join("")}</tr>`;
  const bodyRows = p.jours
    .map((d) => {
      const cells = p.colonnes
        .map((col) => {
          const items = p.travaux(d.iso, col);
          return `<td class="p-work-cell">${
            items.length
              ? items
                  .map(
                    (b) => `
        <div class="p-print-job">
          <b>${esc(b.client || "")}</b>
          <span class="p-job-adresse">${esc(withVille(b.adresse, b.codePostal, b.ville))}</span><br>
          <span class="p-job-metier">${b.metier ? esc(metierDisplayLabel(b.metier)) : ""}</span>${b.heurePlanifiee ? " · " + b.heurePlanifiee : ""}
        </div>`
                  )
                  .join("")
              : '<div class="p-print-empty-cell">—</div>'
          }</td>`;
        })
        .join("");
      return `<tr><td class="p-day-cell">${d.libelle}<br>${d.numero} ${d.mois}${p.estFerie(d.iso) ? "<br>Férié" : ""}</td>${cells}</tr>`;
    })
    .join("");
  return `
    <div class="p-print-planning">
      <h1>${esc(p.societeNom)} — Planning ${p.sousTraitants ? "Sous-traitants" : "Techniciens"}</h1>
      <div class="p-print-weeklabel">Semaine du ${weekLabel}</div>
      <table class="p-print-grid">
        <thead>${headerRow}</thead>
        <tbody>${bodyRows}</tbody>
      </table>
    </div>`;
}
