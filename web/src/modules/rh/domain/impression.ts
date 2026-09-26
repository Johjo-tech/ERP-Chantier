import { esc, fmtDate } from "@/modules/documents/impression/gabarit";
import { registreDuPersonnel, type Salarie } from "./salarie";

type SalarieDuRegistre = Pick<Salarie, "nom" | "prenom" | "dateNaissance" | "nationalite" | "sexe" | "poste" | "typeContrat" | "dateEntree" | "dateSortie">;

/**
 * Le registre unique du personnel imprimé en paysage — PORT LITTÉRAL du HTML
 * d'`imprimerRegistrePersonnel` (app.js l. 15535-15567) : tous les salariés,
 * sortis compris, par ordre d'embauche, en-têtes abrégés (« Naissance »,
 * « Contrat ») et sexe en une lettre, comme sur la feuille de l'ancien.
 */
export function htmlRegistreImprime(societeNom: string, salaries: readonly SalarieDuRegistre[], aujourdhui: string): string {
  const list = registreDuPersonnel(salaries);
  return `
    <div class="p-print-planning">
      <h1>${esc(societeNom)} — Registre unique du personnel</h1>
      <div class="p-print-weeklabel">Document tenu à jour au ${fmtDate(aujourdhui)} — Code du travail, art. L.1221-13</div>
      <table class="p-print-grid" style="table-layout:auto;">
        <thead><tr><th>N°</th><th>Nom</th><th>Prénom</th><th>Naissance</th><th>Nationalité</th><th>Sexe</th><th>Emploi</th><th>Contrat</th><th>Entrée</th><th>Sortie</th></tr></thead>
        <tbody>
          ${list
            .map(
              (s, i) => `<tr>
            <td>${i + 1}</td><td>${esc(s.nom)}</td><td>${esc(s.prenom)}</td>
            <td>${s.dateNaissance ? fmtDate(s.dateNaissance) : "—"}</td>
            <td>${esc(s.nationalite) || "—"}</td>
            <td>${s.sexe === "F" ? "F" : s.sexe === "M" ? "M" : "—"}</td>
            <td>${esc(s.poste) || "—"}</td><td>${esc(s.typeContrat) || "—"}</td>
            <td>${s.dateEntree ? fmtDate(s.dateEntree) : "—"}</td>
            <td>${s.dateSortie ? fmtDate(s.dateSortie) : "—"}</td>
          </tr>`
            )
            .join("")}
        </tbody>
      </table>
    </div>`;
}
