import { Link } from "react-router";
import { montant } from "@/lib/money";
import { formatEurosEcran, useModeDiscret } from "@/lib/modeDiscret";
import { usePermission } from "@/modules/auth-roles/hooks/useSession";
import { libelleType, type Article } from "../domain/article";
import { BoutonActifArticle } from "./BoutonActifArticle";
import { libelleTaux } from "./taux";

/** Longueur d'aperçu d'une description : assez pour la reconnaître, sans noyer la liste. */
const APERCU_DESCRIPTION = 120;

function apercu(texte: string): string {
  return texte.length > APERCU_DESCRIPTION ? `${texte.slice(0, APERCU_DESCRIPTION)}…` : texte;
}

/** La table de l'ancien catalogue (`.lignes-table` sur fond blanc) ; un article retiré s'y voit estompé. */
export function TableArticles({ articles }: { articles: readonly Article[] }) {
  useModeDiscret();
  const peutEcrire = usePermission("articles", "modifier");
  return (
    <table className="lignes-table" style={{ background: "#fff" }}>
      <thead>
        <tr>
          <th style={{ width: "14%" }}>Code</th>
          <th>Désignation</th>
          <th style={{ width: "12%" }}>Famille</th>
          <th style={{ width: "10%" }}>Type</th>
          <th className="num" style={{ width: "8%" }}>
            Unité
          </th>
          <th className="num" style={{ width: "10%" }}>
            Prix HT
          </th>
          <th className="num" style={{ width: "7%" }}>
            TVA
          </th>
          <th style={{ width: "14%" }}>
            <span className="sr-only">Actions</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {articles.map((a) => (
          <tr key={a.id} style={a.actif ? undefined : { opacity: 0.55 }}>
            <td>
              <span className="numref">{a.code}</span>
            </td>
            <td>
              {a.designation}
              {a.description && (
                <div className="card-sub" style={{ whiteSpace: "pre-wrap" }}>
                  {apercu(a.description)}
                </div>
              )}
            </td>
            <td>{a.famille ?? ""}</td>
            <td>{libelleType(a.type_article)}</td>
            <td className="num">{a.unite ?? ""}</td>
            <td className="num">{formatEurosEcran(montant(a.prix_unitaire))}</td>
            <td className="num">{libelleTaux(a.tva)}</td>
            <td style={{ whiteSpace: "nowrap" }}>
              {peutEcrire && (
                <>
                  <Link className="btn small" to={`/articles/${a.id}/modifier`} aria-label={`Modifier ${a.code}`}>
                    Modifier
                  </Link>{" "}
                  <BoutonActifArticle article={a} />
                </>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
