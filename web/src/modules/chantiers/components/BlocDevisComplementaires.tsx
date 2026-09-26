import { Link } from "react-router";
import { Erreur } from "@/components/etats/Etats";
import { messageErreur } from "@/lib/erreurs";
import { montant } from "@/lib/money";
import { formatEurosEcran, useModeDiscret } from "@/lib/modeDiscret";
import { afficherToast } from "@/lib/toast";
import { usePermission } from "@/modules/auth-roles/hooks/useSession";
import type { Chantier } from "../domain/chantier";
import { ACCEPTE_DEVIS_COMPLEMENTAIRE } from "../domain/fichiers";
import { lienDevisComplementaire } from "../domain/liens";
import { useDroitsChantier } from "../hooks/useDroitsChantier";
import { useDeposerDevisComplementaire, useDevisComplementaires, useDevisDuChantier, useRetirerFichier } from "../hooks/useFiche";
import { AjoutFichier, LignesFichiers } from "./FichiersChantier";

const signaler = (err: unknown) => afficherToast(messageErreur(err));

/** Même code couleur que l'ancien badge de devis : accepté = success, refusé = danger, sinon info. */
function classeDevis(statut: string | null): string {
  if (statut === "accepté") return "success";
  if (statut === "refusé") return "danger";
  return "info";
}

/**
 * « 📄 Devis complémentaires » (`chantierDevisComplHTML`, CHA-13) : les devis
 * de l'application rattachés au chantier, puis les devis reçus en fichier
 * (`chantier_devis_complementaires`, réservée à qui gère le chantier : ce sont
 * des montants). « Envoyer par email » ouvre le devis, où vit l'envoi.
 */
export function BlocDevisComplementaires({ chantier }: { chantier: Chantier }) {
  useModeDiscret();
  const droits = useDroitsChantier();
  const voitDevis = usePermission("devis", "voir");
  const creeDevis = usePermission("devis", "creer");
  const devis = useDevisDuChantier(chantier.id);
  const fichiers = useDevisComplementaires(chantier.id);
  const deposer = useDeposerDevisComplementaire(chantier.id);
  const retirer = useRetirerFichier(chantier.id, "chantier_devis_complementaires");

  return (
    <div className="chantier-section">
      <div className="section-title" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span>📄 Devis complémentaires</span>
        <div style={{ display: "flex", gap: "8px" }}>
          {creeDevis && (
            <Link className="btn small primary" to={lienDevisComplementaire(chantier)}>
              + Nouveau devis
            </Link>
          )}
          {droits.gere && <AjoutFichier libelle="+ Fichier" classe="btn small" accepte={ACCEPTE_DEVIS_COMPLEMENTAIRE} enCours={deposer.isPending} onFichier={(f) => deposer.mutate(f, { onError: signaler })} />}
        </div>
      </div>
      {voitDevis && devis.isError && <Erreur erreur={devis.error} reessayer={() => void devis.refetch()} />}
      {voitDevis &&
        devis.data?.map((d) => (
          <div key={d.id} className="chantier-file-row" style={{ flexWrap: "wrap" }}>
            <Link to={`/devis/${d.id}`}>
              📄 {d.numero ?? ""} — {d.ht == null ? "—" : formatEurosEcran(montant(d.ht))} HT
            </Link>
            <span className={`badge ${classeDevis(d.statut)}`}>{d.statut || "brouillon"}</span>
            <Link className="btn small" to={`/devis/${d.id}/apercu`}>
              Imprimer / PDF
            </Link>
            <Link className="btn small" to={`/devis/${d.id}`}>
              Envoyer par email
            </Link>
          </div>
        ))}
      {fichiers.isError && <Erreur erreur={fichiers.error} reessayer={() => void fichiers.refetch()} />}
      {droits.gere && fichiers.isSuccess && (
        <LignesFichiers
          fichiers={fichiers.data.map((d) => ({ id: d.id, nom: d.fichier_nom ?? d.designation ?? "Devis", date: d.date_document, chemin: d.fichier_chemin }))}
          modifiable
          onRetirer={(id) => retirer.mutate(id, { onError: signaler })}
        />
      )}
    </div>
  );
}
