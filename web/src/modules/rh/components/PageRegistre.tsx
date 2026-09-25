import { Link } from "react-router";
import { Chargement, Erreur } from "@/components/etats/Etats";
import { EnTetePage } from "@/components/page/EnTetePage";
import { Button } from "@/components/ui/button";
import { Table, TBody, Td, Th, THead, Tr } from "@/components/ui/table";
import { formatDateFr, todayISO } from "@/lib/dates";
import { useSocieteActive } from "@/modules/auth-roles/hooks/useSession";
import { libelleSexe, registreDuPersonnel } from "../domain/salarie";
import { useSalariesRh } from "../hooks/useRh";

/**
 * Le registre unique du personnel (RH-03, C. trav. L.1221-13) : tous les
 * salariés, sortis compris, par ordre d'embauche — à tenir à disposition de
 * l'inspection du travail. Imprimé en paysage (dix colonnes).
 */
export function PageRegistre() {
  const societe = useSocieteActive();
  const salaries = useSalariesRh();
  if (salaries.isPending) return <Chargement />;
  if (salaries.isError) return <Erreur erreur={salaries.error} reessayer={() => void salaries.refetch()} />;
  const liste = registreDuPersonnel(salaries.data);

  return (
    <div>
      <EnTetePage
        titre="Registre unique du personnel"
        sousTitre="Document obligatoire (Code du travail, art. L.1221-13) — liste de tous les salariés par ordre d'embauche, à tenir à disposition de l'inspection du travail."
        actions={
          <>
            <Button asChild variant="ghost"><Link to="/rh">← Retour RH</Link></Button>
            <Button onClick={() => window.print()}>🖨️ Imprimer</Button>
          </>
        }
      />
      <div className="zone-impression overflow-x-auto">
        <style>{"@media print { @page { size: A4 landscape; margin: 8mm; } body * { visibility: hidden; } .zone-impression, .zone-impression * { visibility: visible; } .zone-impression { position: absolute; inset: 0; } }"}</style>
        <h2 className="hidden print:block">{societe.nom} — Registre unique du personnel</h2>
        <p className="hidden text-xs print:block">Document tenu à jour au {formatDateFr(todayISO())} — Code du travail, art. L.1221-13</p>
        <Table>
          <THead>
            <Tr>
              {["N°", "Nom", "Prénom", "Date de naissance", "Nationalité", "Sexe", "Emploi", "Type de contrat", "Date d'entrée", "Date de sortie"].map((t) => (
                <Th key={t}>{t}</Th>
              ))}
            </Tr>
          </THead>
          <TBody>
            {liste.length === 0 ? (
              <Tr><Td colSpan={10}>Aucun salarié enregistré.</Td></Tr>
            ) : (
              liste.map((s, i) => (
                <Tr key={s.id}>
                  <Td>{i + 1}</Td>
                  <Td><strong>{s.nom}</strong></Td>
                  <Td>{s.prenom}</Td>
                  <Td>{formatDateFr(s.dateNaissance)}</Td>
                  <Td>{s.nationalite || "—"}</Td>
                  <Td>{libelleSexe(s.sexe)}</Td>
                  <Td>{s.poste || "—"}</Td>
                  <Td>{s.typeContrat || "—"}</Td>
                  <Td>{formatDateFr(s.dateEntree)}</Td>
                  <Td>{formatDateFr(s.dateSortie)}</Td>
                </Tr>
              ))
            )}
          </TBody>
        </Table>
      </div>
    </div>
  );
}
