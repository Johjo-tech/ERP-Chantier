import { useState } from "react";
import { Link } from "react-router";
import { Chargement } from "@/components/etats/Etats";
import { EnTetePage } from "@/components/page/EnTetePage";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { messageErreur } from "@/lib/erreurs";
import { useFonctionnalite } from "@/modules/societes/hooks/useFonctionnalite";
import { fichierRapport, lireFichierArticles, type LectureFichier } from "../domain/import";
import { useImporterArticles } from "../hooks/useArticles";
import { ApercuImport } from "./ApercuImport";
import { ResultatImport } from "./ResultatImport";
import { telechargerTexte } from "./telechargement";

type Etape = { etape: "fichier" } | { etape: "lecture"; nom: string } | { etape: "apercu"; nom: string; lecture: LectureFichier };

/**
 * Import du catalogue (ART-05) : rien n'est écrit avant l'accord. Le fichier
 * est lu dans le navigateur, on MONTRE ce qu'on en a compris — encodage,
 * rejets, décisions prises à sa place, premiers articles avec leur TVA — puis
 * on écrit par lots, et on dit ce qui a été créé, mis à jour ou refusé.
 */
export function PageImportArticles() {
  const ouvert = useFonctionnalite("import_articles");
  const importer = useImporterArticles();
  const [etat, setEtat] = useState<Etape>({ etape: "fichier" });
  const [erreurLecture, setErreurLecture] = useState<unknown>(null);

  async function lire(fichier: File | undefined) {
    if (!fichier) return;
    setErreurLecture(null);
    importer.reset();
    setEtat({ etape: "lecture", nom: fichier.name });
    try {
      setEtat({ etape: "apercu", nom: fichier.name, lecture: lireFichierArticles(await fichier.arrayBuffer()) });
    } catch (e) {
      console.error("Lecture du fichier d'articles impossible :", e);
      setErreurLecture(e);
      setEtat({ etape: "fichier" });
    }
  }

  const titre = <EnTetePage titre="Importer un catalogue" actions={<Button variant="ghost" asChild><Link to="/articles">Retour au catalogue</Link></Button>} />;
  if (!ouvert) {
    return <>{titre}<Alert>L'import de catalogue n'est pas compris dans l'abonnement de cette société.</Alert></>;
  }

  return (
    <div className="flex max-w-5xl flex-col gap-4">
      {titre}
      <p className="text-sm text-muted-foreground">
        Fichier exporté du logiciel de gestion : colonnes séparées par des points-virgules, reconnues par leur nom — un export
        partiel passe, et ce qui manque vous sera dit avant d'écrire. Rien n'est écrit avant votre accord.
      </p>
      <div>
        <label htmlFor="fichier-articles" className="mb-1 block text-sm font-medium">Fichier à importer</label>
        <input id="fichier-articles" type="file" accept=".csv,.txt,text/csv" disabled={importer.isPending} onChange={(e) => void lire(e.target.files?.[0])} />
      </div>
      {erreurLecture !== null && <Alert variant="erreur">Le fichier n'a pas pu être lu : {messageErreur(erreurLecture)}</Alert>}
      {etat.etape === "lecture" && <Chargement libelle={`Lecture de ${etat.nom}…`} />}
      {etat.etape === "apercu" && !importer.isSuccess && (
        <ApercuImport
          nom={etat.nom}
          lecture={etat.lecture}
          enCours={importer.isPending}
          onImporter={() => importer.mutate(etat.lecture.articles)}
          onRapport={() => telechargerTexte("import-articles-rapport.csv", fichierRapport(etat.lecture))}
        />
      )}
      {importer.isError && <Alert variant="erreur">{messageErreur(importer.error)}</Alert>}
      {etat.etape === "apercu" && importer.isSuccess && (
        <>
          <ResultatImport resultat={importer.data} />
          {(etat.lecture.rejets.length > 0 || etat.lecture.signalements.length > 0) && (
            <div>
              <Button variant="outline" onClick={() => telechargerTexte("import-articles-rapport.csv", fichierRapport(etat.lecture))}>
                Télécharger le rapport
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
