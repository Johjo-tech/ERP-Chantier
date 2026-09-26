import { useState, type ReactNode } from "react";
import { Erreur } from "@/components/etats/Etats";
import { messageErreur } from "@/lib/erreurs";
import { afficherToast } from "@/lib/toast";
import type { Chantier } from "../domain/chantier";
import { ACCEPTE_INSPECTION, FAMILLES, type FamilleDocument } from "../domain/fichiers";
import { useEnregistrerInfosDiverses } from "../hooks/useChantiers";
import { useDroitsChantier } from "../hooks/useDroitsChantier";
import { useDeposerDocument, useDeposerInspection, useDocuments, useInspections, useRedater, useRetirerFichier } from "../hooks/useFiche";
import { BoutonPpsps } from "./BoutonPpsps";
import { AjoutFichier, LignesFichiers } from "./FichiersChantier";

const signaler = (err: unknown) => afficherToast(messageErreur(err));
const TITRE_SOUS = { display: "flex", justifyContent: "space-between", alignItems: "center", fontWeight: 600, fontSize: "12.5px" } as const;

function SousTitre({ titre, style, children }: { titre: string; style?: React.CSSProperties; children?: ReactNode }) {
  return (
    <div className="chantier-subsection-title" style={{ ...TITRE_SOUS, ...style }}>
      <span>{titre}</span>
      {children}
    </div>
  );
}

/** Une famille de documents à date modifiable (PPSPS, DOE), comme `chantierFileListEditableDateHTML`. */
function FamilleDatee({ chantierId, famille }: { chantierId: string; famille: FamilleDocument }) {
  const docs = useDocuments(chantierId);
  const droits = useDroitsChantier();
  const redater = useRedater(chantierId, "chantier_documents");
  const retirer = useRetirerFichier(chantierId, "chantier_documents");
  if (docs.isError) return <Erreur erreur={docs.error} reessayer={() => void docs.refetch()} />;
  if (!docs.isSuccess) return null;
  return (
    <LignesFichiers
      fichiers={docs.data.filter((d) => d.famille === famille).map((d) => ({ id: d.id, nom: d.fichier_nom ?? d.nom, date: d.date_document, chemin: d.fichier_chemin }))}
      modifiable={droits.terrain}
      onRedater={(id, date) => redater.mutate({ id, date }, { onError: signaler })}
      onRetirer={(id) => retirer.mutate(id, { onError: signaler })}
    />
  );
}

/**
 * « 📝 Informations diverses » et, dessous, « 🦺 Sécurité » : visites
 * d'inspection, PPSPS (généré ou déposé), DOE (`chantierInfosDiversesHTML`).
 * Le texte s'enregistre à la sortie du champ, seulement s'il a changé ; en
 * lecture seule sans « chantiers / modifier » (RLS de `chantiers`).
 */
export function BlocInfosDiverses({ chantier, modifiable }: { chantier: Chantier; modifiable: boolean }) {
  const [texte, setTexte] = useState(chantier.infos_diverses);
  const [enregistre, setEnregistre] = useState(chantier.infos_diverses);
  const enregistrer = useEnregistrerInfosDiverses(chantier.id);
  const droits = useDroitsChantier();
  const inspections = useInspections(chantier.id);
  const deposerInspection = useDeposerInspection(chantier.id);
  const deposer = useDeposerDocument(chantier.id);
  const redater = useRedater(chantier.id, "chantier_inspections");
  const retirer = useRetirerFichier(chantier.id, "chantier_inspections");

  function sortir() {
    if (!modifiable || texte === enregistre) return;
    enregistrer.mutate(texte, {
      onSuccess: () => {
        setEnregistre(texte);
        afficherToast("Informations enregistrées.", "success");
      },
      onError: signaler,
    });
  }
  const depot = (famille: FamilleDocument) => (f: File) => deposer.mutate({ famille, fichier: f }, { onError: signaler });

  return (
    <div className="chantier-section">
      <div className="section-title">📝 Informations diverses</div>
      <textarea
        aria-label="Informations diverses"
        rows={4}
        placeholder="Codes d'accès, contacts utiles, remarques, particularités du chantier…"
        style={{ width: "100%" }}
        value={texte}
        readOnly={!modifiable}
        onChange={(e) => setTexte(e.target.value)}
        onBlur={sortir}
      />
      <div className="chantier-subsection-title" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span>🦺 Sécurité</span>
      </div>
      <SousTitre titre="🔍 Visites d'inspection" style={{ marginTop: "6px", borderTop: "none", paddingTop: 0 }}>
        {droits.terrain && <AjoutFichier accepte={ACCEPTE_INSPECTION} enCours={deposerInspection.isPending} onFichier={(f) => deposerInspection.mutate(f, { onError: signaler })} />}
      </SousTitre>
      {inspections.isError && <Erreur erreur={inspections.error} reessayer={() => void inspections.refetch()} />}
      {inspections.isSuccess && (
        <LignesFichiers
          fichiers={inspections.data.map((i) => ({ id: i.id, nom: i.fichier_nom ?? i.objet ?? "Visite", date: i.date_visite, chemin: i.fichier_chemin }))}
          modifiable={droits.terrain}
          onRedater={(id, date) => redater.mutate({ id, date }, { onError: signaler })}
          onRetirer={(id) => retirer.mutate(id, { onError: signaler })}
        />
      )}
      <SousTitre titre="📋 PPSPS">
        <div style={{ display: "flex", gap: "8px" }}>
          <BoutonPpsps chantier={chantier} />
          {droits.terrain && <AjoutFichier libelle="+ Fichier" classe="btn small" accepte={FAMILLES.ppsps.accepte} onFichier={depot("ppsps")} />}
        </div>
      </SousTitre>
      <FamilleDatee chantierId={chantier.id} famille="ppsps" />
      <SousTitre titre="📁 DOE">{droits.terrain && <AjoutFichier accepte={FAMILLES.doe.accepte} onFichier={depot("doe")} />}</SousTitre>
      <FamilleDatee chantierId={chantier.id} famille="doe" />
    </div>
  );
}
