import type { ReactNode } from "react";
import { Chargement, Erreur } from "@/components/etats/Etats";
import { Alert } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { messageErreur } from "@/lib/erreurs";
import type { DocumentChantier } from "../api/documents";
import type { Chantier } from "../domain/chantier";
import { ACCEPTE_INSPECTION, FAMILLES, FAMILLES_MARCHE, type FamilleDocument } from "../domain/fichiers";
import { estAnalysable } from "../domain/import-dpgf";
import { useDroitsChantier } from "../hooks/useDroitsChantier";
import { useDeposerDocument, useDeposerInspection, useDocuments, useInspections, useRedater, useRetirerFichier } from "../hooks/useFiche";
import { BoutonPpsps } from "./BoutonPpsps";
import { BoutonDepot, ListeFichiers } from "./Fichiers";

function SousSection({ titre, action, children }: { titre: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-1 border-t border-border pt-3 first:border-t-0 first:pt-0" aria-label={titre}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{titre}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

interface PropsFamille {
  chantierId: string;
  famille: FamilleDocument;
  documents: readonly DocumentChantier[];
  dateModifiable?: boolean;
  onDepose?: (f: File) => void;
  extra?: ReactNode;
}

function Famille({ chantierId, famille, documents, dateModifiable = false, onDepose, extra }: PropsFamille) {
  const droits = useDroitsChantier();
  const deposer = useDeposerDocument(chantierId);
  const redater = useRedater(chantierId, "chantier_documents");
  const retirer = useRetirerFichier(chantierId, "chantier_documents");
  const erreur = deposer.error ?? redater.error ?? retirer.error;
  const depot = (f: File) => deposer.mutate({ famille, fichier: f }, { onSuccess: () => onDepose?.(f) });
  return (
    <SousSection
      titre={FAMILLES[famille].libelle}
      action={
        <span className="flex gap-2">
          {extra}
          {droits.terrain && <BoutonDepot libelle="+ Ajouter" accepte={FAMILLES[famille].accepte} onFichier={depot} enCours={deposer.isPending} />}
        </span>
      }
    >
      {erreur && <Alert variant="erreur">{messageErreur(erreur)}</Alert>}
      <ListeFichiers
        fichiers={documents.filter((d) => d.famille === famille).map((d) => ({ id: d.id, nom: d.fichier_nom ?? d.nom, date: d.date_document, chemin: d.fichier_chemin }))}
        modifiable={droits.terrain}
        dateModifiable={dateModifiable}
        onRedater={(id, date) => redater.mutate({ id, date })}
        onRetirer={(id) => retirer.mutate(id)}
      />
    </SousSection>
  );
}

/**
 * Pièces du marché (CHA-04) : DPGF, CCTP, CCAP, Avenant, DGD. Un DPGF déposé en
 * Excel ou CSV est aussi proposé à l'analyse (`onAnalyserDpgf`), sinon archivé.
 */
export function BlocPiecesMarche({ chantierId, onAnalyserDpgf }: { chantierId: string; onAnalyserDpgf?: (f: File) => void }) {
  const docs = useDocuments(chantierId);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Pièces du marché</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {docs.isPending && <Chargement />}
        {docs.isError && <Erreur erreur={docs.error} reessayer={() => void docs.refetch()} />}
        {docs.isSuccess &&
          FAMILLES_MARCHE.map((f) => (
            <Famille
              key={f}
              chantierId={chantierId}
              famille={f}
              documents={docs.data}
              onDepose={f === "dpgf" && onAnalyserDpgf ? (fichier) => estAnalysable(fichier.name) && onAnalyserDpgf(fichier) : undefined}
            />
          ))}
        {onAnalyserDpgf && <p className="text-xs text-muted-foreground">Un DPGF déposé en Excel (.xlsx) ou CSV est analysé ; un PDF est seulement archivé.</p>}
      </CardContent>
    </Card>
  );
}

/** Sécurité (CHA-03, CHA-05) : visites d'inspection, PPSPS (généré ou déposé), DOE — dates modifiables. */
export function BlocSecurite({ chantier }: { chantier: Chantier }) {
  const docs = useDocuments(chantier.id);
  const inspections = useInspections(chantier.id);
  const droits = useDroitsChantier();
  const deposerInspection = useDeposerInspection(chantier.id);
  const redater = useRedater(chantier.id, "chantier_inspections");
  const retirer = useRetirerFichier(chantier.id, "chantier_inspections");
  const erreur = deposerInspection.error ?? redater.error ?? retirer.error;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Sécurité</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <SousSection
          titre="Visites d'inspection"
          action={droits.terrain && <BoutonDepot libelle="+ Ajouter" accepte={ACCEPTE_INSPECTION} onFichier={(f) => deposerInspection.mutate(f)} enCours={deposerInspection.isPending} />}
        >
          {erreur && <Alert variant="erreur">{messageErreur(erreur)}</Alert>}
          {inspections.isError && <Erreur erreur={inspections.error} reessayer={() => void inspections.refetch()} />}
          {inspections.isSuccess && (
            <ListeFichiers
              fichiers={inspections.data.map((i) => ({ id: i.id, nom: i.fichier_nom ?? i.objet ?? "Visite", date: i.date_visite, chemin: i.fichier_chemin }))}
              modifiable={droits.terrain}
              dateModifiable
              onRedater={(id, date) => redater.mutate({ id, date })}
              onRetirer={(id) => retirer.mutate(id)}
            />
          )}
        </SousSection>
        {docs.isError && <Erreur erreur={docs.error} reessayer={() => void docs.refetch()} />}
        {docs.isSuccess && (
          <>
            <Famille chantierId={chantier.id} famille="ppsps" documents={docs.data} dateModifiable extra={<BoutonPpsps chantier={chantier} />} />
            <Famille chantierId={chantier.id} famille="doe" documents={docs.data} dateModifiable />
          </>
        )}
      </CardContent>
    </Card>
  );
}
