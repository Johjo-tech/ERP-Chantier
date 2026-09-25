import { Link } from "react-router";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TBody, Td, Th, THead, Tr } from "@/components/ui/table";
import { formatTaux, montant } from "@/lib/money";
import { formatEurosEcran } from "@/lib/modeDiscret";
import { Can } from "@/modules/auth-roles/components/Can";
import { libelleType, type Article } from "../domain/article";
import { BoutonActifArticle } from "./BoutonActifArticle";

/** Longueur d'aperçu d'une description : assez pour la reconnaître, sans noyer la liste. */
const APERCU_DESCRIPTION = 120;

function apercu(texte: string): string {
  return texte.length > APERCU_DESCRIPTION ? `${texte.slice(0, APERCU_DESCRIPTION)}…` : texte;
}

export function TableArticles({ articles }: { articles: readonly Article[] }) {
  return (
    <Table>
      <THead>
        <Tr>
          <Th>Code</Th>
          <Th>Désignation</Th>
          <Th>Famille</Th>
          <Th>Type</Th>
          <Th>Unité</Th>
          <Th className="text-right">Prix HT</Th>
          <Th className="text-right">TVA</Th>
          <Can module="articles" action="modifier">
            <Th><span className="sr-only">Actions</span></Th>
          </Can>
        </Tr>
      </THead>
      <TBody>
        {articles.map((a) => (
          <Tr key={a.id} className={a.actif ? "" : "opacity-60"}>
            <Td className="font-mono text-xs">
              {a.code}
              {!a.actif && <Badge variant="neutre" className="ml-2">Retiré</Badge>}
            </Td>
            <Td>
              {a.designation}
              {a.description && <span className="block whitespace-pre-wrap text-xs text-muted-foreground">{apercu(a.description)}</span>}
            </Td>
            <Td>{a.famille ?? "—"}</Td>
            <Td>{libelleType(a.type_article)}</Td>
            <Td>{a.unite ?? "—"}</Td>
            <Td className="text-right tabular-nums">{formatEurosEcran(montant(a.prix_unitaire))}</Td>
            <Td className="text-right tabular-nums">{formatTaux(montant(a.tva))}</Td>
            <Can module="articles" action="modifier">
              <Td className="whitespace-nowrap text-right">
                <Button variant="ghost" size="sm" asChild>
                  <Link to={`/articles/${a.id}/modifier`} aria-label={`Modifier ${a.code}`}>Modifier</Link>
                </Button>
                <BoutonActifArticle article={a} />
              </Td>
            </Can>
          </Tr>
        ))}
      </TBody>
    </Table>
  );
}
