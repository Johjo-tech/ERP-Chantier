import { useState } from "react";
import { Link } from "react-router";
import { messageErreur } from "@/lib/erreurs";
import { useFonctionnalite } from "@/modules/societes/hooks/useFonctionnalite";
import { fichierRapport, lireFichierArticles, type LectureFichier } from "../domain/import";
import { useImporterArticles } from "../hooks/useArticles";
import { ApercuImport } from "./ApercuImport";
import { CadreCatalogue } from "./CadreCatalogue";
import { ResultatImport } from "./ResultatImport";
import { telechargerTexte } from "./telechargement";

type Etape = { etape: "fichier" } | { etape: "lecture"; nom: string } | { etape: "apercu"; nom: string; lecture: LectureFichier };

const NOM_RAPPORT = "import-articles-rapport.csv";

/**
 * Import du catalogue (ART-05), au HTML de l'ancien (`importCatalogueHTML`) :
 * rien n'est écrit avant l'accord. Le fichier est lu dans le navigateur, on
 * MONTRE ce qu'on en a compris, puis on écrit par lots, et on dit ce qui a été
 * créé, mis à jour ou refusé.
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

  const retour = (
    <Link className="btn ghost" to="/articles">
      Retour au catalogue
    </Link>
  );
  const rapport = (l: LectureFichier) => () => telechargerTexte(NOM_RAPPORT, fichierRapport(l));

  let contenu;
  if (!ouvert) {
    contenu = (
      <div className="form-panel">
        <div className="wf-banner alerte">L'import de catalogue n'est pas compris dans l'abonnement de cette société.</div>
        <div style={{ marginTop: "12px" }}>{retour}</div>
      </div>
    );
  } else if (erreurLecture !== null || importer.isError) {
    contenu = (
      <div className="form-panel">
        <div role="alert" className="wf-banner alerte">
          <b>Import impossible</b>
          <div>{messageErreur(erreurLecture ?? importer.error)}</div>
        </div>
        <div style={{ marginTop: "12px" }}>{retour}</div>
      </div>
    );
  } else if (etat.etape === "lecture" || importer.isPending) {
    contenu = (
      <div className="form-panel">
        <div className="empty" role="status">
          Traitement de {etat.etape === "fichier" ? "votre fichier" : etat.nom}…
        </div>
      </div>
    );
  } else if (etat.etape === "apercu" && importer.isSuccess) {
    const aRapport = etat.lecture.rejets.length > 0 || etat.lecture.signalements.length > 0;
    contenu = <ResultatImport resultat={importer.data} rapport={aRapport ? rapport(etat.lecture) : null} retour={retour} />;
  } else if (etat.etape === "apercu") {
    contenu = <ApercuImport nom={etat.nom} lecture={etat.lecture} onImporter={() => importer.mutate(etat.lecture.articles)} onRapport={rapport(etat.lecture)} retour={retour} />;
  } else {
    contenu = (
      <div className="form-panel">
        <h3>Importer un catalogue</h3>
        <p className="card-sub">
          Fichier exporté du logiciel de gestion : colonnes séparées par des points-virgules, encodage Windows‑1252. Les colonnes sont reconnues par leur nom — un export partiel passe, ce qui manque vous sera dit avant d'écrire. Rien n'est écrit avant votre accord.
        </p>
        <div style={{ margin: "16px 0" }}>
          <input type="file" aria-label="Fichier à importer" accept=".csv,.txt,text/csv" onChange={(e) => void lire(e.target.files?.[0])} />
        </div>
        {retour}
      </div>
    );
  }
  return <CadreCatalogue>{contenu}</CadreCatalogue>;
}
