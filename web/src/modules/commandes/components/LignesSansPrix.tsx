import { Vide } from "@/components/etats/Etats";
import { Table, TBody, Td, Th, THead, Tr } from "@/components/ui/table";
import type { LigneBonLue } from "../domain/bon";

/**
 * Les travaux du bon pour qui ne voit pas les prix (technicien, sous-traitant) :
 * ce qu'il y a à faire, sans colonne de montant — la vue les rend NULL, et
 * l'éditeur de lignes afficherait des zéros trompeurs.
 */
export function LignesSansPrix({ lignes }: { lignes: readonly LigneBonLue[] }) {
  if (!lignes.length) return <Vide message="Aucune ligne de travaux sur ce bon." />;
  return (
    <Table aria-label="Travaux à réaliser">
      <THead>
        <Tr>
          <Th>Désignation</Th>
          <Th className="text-right">Qté</Th>
          <Th>Unité</Th>
        </Tr>
      </THead>
      <TBody>
        {lignes.map((l) => (
          <Tr key={l.id}>
            <Td className={l.type === "chapitre" ? "font-semibold" : l.type === "commentaire" ? "italic text-muted-foreground" : undefined}>{l.designation}</Td>
            <Td className="text-right tabular-nums">{l.type === "ligne" ? String(l.quantite).replace(".", ",") : ""}</Td>
            <Td>{l.type === "ligne" ? (l.unite ?? "") : ""}</Td>
          </Tr>
        ))}
      </TBody>
    </Table>
  );
}
