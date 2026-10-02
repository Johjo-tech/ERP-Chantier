import { Fragment } from "react";
import { Erreur } from "@/components/etats/Etats";
import { messageErreur } from "@/lib/erreurs";
import { afficherToast } from "@/lib/toast";
import { FAMILLES, type FamilleDocument } from "../domain/fichiers";
import { estAnalysable } from "../domain/import-dpgf";
import { useDroitsChantier } from "../hooks/useDroitsChantier";
import { useDeposerDocument, useDocuments, useRetirerFichier } from "../hooks/useFiche";
import { AjoutFichier, LignesFichiers } from "./FichiersChantier";
import { BULLE_CONSIGNE_MS } from "./durees";

const signaler = (err: unknown) => afficherToast(messageErreur(err));

/** Les sous-sections de l'ancienne section « 📊 DPGF », avec leur pictogramme (`chantierDpgfHTML`). */
const SOUS_SECTIONS: readonly { famille: FamilleDocument; titre: string }[] = [
  { famille: "cctp", titre: "📃 CCTP" },
  { famille: "ccap", titre: "📑 CCAP" },
  { famille: "avenant", titre: "📝 Avenant" },
  { famille: "dgd", titre: "📕 DGD" },
];

/**
 * Pièces du marché (CHA-04) : la section « 📊 DPGF » de l'ancienne fiche, puis
 * CCTP, CCAP, Avenant, DGD. Un DPGF déposé en Excel ou CSV est aussi proposé à
 * l'analyse (`onAnalyserDpgf`) ; un PDF est seulement archivé, et on le dit.
 */
export function BlocPiecesMarche({ chantierId, onAnalyserDpgf }: { chantierId: string; onAnalyserDpgf?: ((f: File) => void) | undefined }) {
  const docs = useDocuments(chantierId);
  const droits = useDroitsChantier();
  const deposer = useDeposerDocument(chantierId);
  const retirer = useRetirerFichier(chantierId, "chantier_documents");

  function deposerDpgf(f: File) {
    deposer.mutate(
      { famille: "dpgf", fichier: f },
      {
        onSuccess: () => {
          if (estAnalysable(f.name) && onAnalyserDpgf) onAnalyserDpgf(f);
          else afficherToast("Fichier PDF archivé. L'analyse automatique des travaux facturables nécessite un fichier Excel ou CSV.", "success", BULLE_CONSIGNE_MS);
        },
        onError: signaler,
      }
    );
  }
  const liste = (famille: FamilleDocument) =>
    docs.isSuccess ? (
      <LignesFichiers
        fichiers={docs.data.filter((d) => d.famille === famille).map((d) => ({ id: d.id, nom: d.fichier_nom ?? d.nom, date: d.date_document, chemin: d.fichier_chemin }))}
        modifiable={droits.terrain}
        onRetirer={(id) => retirer.mutate(id, { onError: signaler })}
      />
    ) : null;

  return (
    <div className="chantier-section">
      <div className="section-title" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span>📊 DPGF</span>
        {droits.terrain && <AjoutFichier accepte={FAMILLES.dpgf.accepte} enCours={deposer.isPending} onFichier={deposerDpgf} />}
      </div>
      {docs.isError && <Erreur erreur={docs.error} reessayer={() => void docs.refetch()} />}
      {liste("dpgf")}
      {SOUS_SECTIONS.map(({ famille, titre }) => (
        <Fragment key={famille}>
          <div className="chantier-subsection-title" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>{titre}</span>
            {droits.terrain && (
              <AjoutFichier accepte={FAMILLES[famille].accepte} onFichier={(f) => deposer.mutate({ famille, fichier: f }, { onError: signaler })} />
            )}
          </div>
          {liste(famille)}
        </Fragment>
      ))}
    </div>
  );
}
