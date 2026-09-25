import { Link } from "react-router";
import { EnTetePage } from "@/components/page/EnTetePage";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { messageErreur } from "@/lib/erreurs";
import { telechargerTexte } from "@/modules/articles/components/telechargement";
import { usePermission } from "@/modules/auth-roles/hooks/useSession";
import { useSauvegarde } from "../hooks/useImportExport";
import { BoutonImport } from "./Recapitulatif";

const telechargerJson = (nom: string, contenu: string) => telechargerTexte(nom, contenu, "application/json");

/**
 * Les entrées et sorties de données en un lieu : les imports vivent aussi à
 * côté de leur liste (Clients, Factures, Articles, fiche chantier pour le DPGF),
 * la sauvegarde est ici — l'ancien la plaçait en tête des Réglages.
 */
export function PageImportExport() {
  const articles = usePermission("articles", "modifier");
  const sauvegarde = useSauvegarde(telechargerJson);
  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <EnTetePage titre="Import / export" />
      <Card className="flex flex-col gap-2 p-4">
        <h2 className="font-semibold">Importer</h2>
        <p className="text-sm text-muted-foreground">Chaque import montre ce qu'il va écrire avant d'écrire, et rend un rapport de ce qu'il a écarté.</p>
        <div className="flex flex-wrap gap-2">
          <BoutonImport module="clients" vers="/clients/import" libelle="Importer des clients" />
          <BoutonImport module="factures" vers="/factures/import" libelle="Reprendre un historique de factures" />
          {articles && <Button variant="outline" asChild><Link to="/articles/import">Importer un catalogue d'articles</Link></Button>}
        </div>
        <p className="text-xs text-muted-foreground">Le DPGF d'un chantier s'importe depuis sa fiche, onglet DPGF.</p>
      </Card>
      <Card className="flex flex-col gap-2 p-4">
        <h2 className="font-semibold">Sauvegarde de vos données</h2>
        <p className="text-sm text-muted-foreground">
          Un fichier JSON de tout ce que vous pouvez lire de cette société : clients, articles, devis, factures et règlements, bons de
          commande, chantiers, salariés, parc. C'est une archive : elle ne se réimporte pas par l'écran.
        </p>
        <div>
          <Button onClick={() => sauvegarde.mutate()} disabled={sauvegarde.isPending}>
            {sauvegarde.isPending ? "Préparation de la sauvegarde…" : "Exporter mes données"}
          </Button>
        </div>
        {sauvegarde.isSuccess && <Alert variant="succes">Sauvegarde téléchargée — gardez ce fichier en lieu sûr.</Alert>}
        {sauvegarde.isError && <Alert variant="erreur">La sauvegarde n'a pas pu être créée : {messageErreur(sauvegarde.error)}</Alert>}
      </Card>
    </div>
  );
}
