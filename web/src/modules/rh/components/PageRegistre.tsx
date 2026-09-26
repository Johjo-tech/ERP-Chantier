import { Link } from "react-router";
import { Chargement, Erreur } from "@/components/etats/Etats";
import { formatDateFr, todayISO } from "@/lib/dates";
import { useSocieteActive } from "@/modules/auth-roles/hooks/useSession";
import { imprimerZonePaysage } from "@/modules/documents/impression/zone";
import { htmlRegistreImprime } from "../domain/impression";
import { libelleSexe, registreDuPersonnel } from "../domain/salarie";
import { useSalariesRh } from "../hooks/useRh";

const COLONNES = ["N°", "Nom", "Prénom", "Date de naissance", "Nationalité", "Sexe", "Emploi", "Type de contrat", "Date d'entrée", "Date de sortie"] as const;
const date = (d: string | null) => (d ? formatDateFr(d) : "—");

/**
 * Le registre unique du personnel (RH-03, C. trav. L.1221-13), au HTML de
 * `renderRegistreUniquePersonnel` (app.js l. 15579) : tous les salariés,
 * sortis compris, par ordre d'embauche. Imprimé en paysage (D-PDF-07).
 */
export function PageRegistre() {
  const societe = useSocieteActive();
  const salaries = useSalariesRh();
  if (salaries.isPending) return <Chargement />;
  if (salaries.isError) return <Erreur erreur={salaries.error} reessayer={() => void salaries.refetch()} />;
  const liste = registreDuPersonnel(salaries.data);

  return (
    <>
      <div className="page-head">
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          <Link className="btn small" to="/rh">
            ← Retour RH
          </Link>
          <h1 style={{ margin: 0 }}>Registre unique du personnel</h1>
        </div>
        <button
          type="button"
          className="btn primary"
          onClick={() =>
            // La feuille de l'ancien (`imprimerRegistrePersonnel`), pas l'écran : en-têtes abrégés, paysage.
            void imprimerZonePaysage(htmlRegistreImprime(societe.nom, salaries.data, todayISO())).catch((e: unknown) => console.error("Registre non imprimé", e))
          }
        >
          🖨️ Imprimer
        </button>
      </div>
      <div className="card-sub" style={{ marginBottom: "16px" }}>
        Document obligatoire (Code du travail, art. L.1221-13) — liste de tous les salariés par ordre d&apos;embauche, à tenir à disposition de l&apos;inspection du travail.
      </div>
      <div className="vehicule-liste-wrap">
        <table className="stats-table" id="registrePersonnelTable">
          <thead>
            <tr>
              {COLONNES.map((t) => (
                <th key={t}>{t}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {liste.length === 0 ? (
              <tr>
                <td colSpan={COLONNES.length} className="empty">
                  Aucun salarié enregistré.
                </td>
              </tr>
            ) : (
              liste.map((s, i) => (
                <tr key={s.id}>
                  <td>{i + 1}</td>
                  <td>
                    <strong>{s.nom}</strong>
                  </td>
                  <td>{s.prenom}</td>
                  <td>{date(s.dateNaissance)}</td>
                  <td>{s.nationalite || "—"}</td>
                  <td>{libelleSexe(s.sexe)}</td>
                  <td>{s.poste || "—"}</td>
                  <td>{s.typeContrat || "—"}</td>
                  <td>{date(s.dateEntree)}</td>
                  <td>{date(s.dateSortie)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
