import { Erreur } from "@/components/etats/Etats";
import { messageErreur } from "@/lib/erreurs";
import { afficherToast } from "@/lib/toast";
import { ACCEPTE_COMPTE_RENDU } from "../domain/fichiers";
import { useDroitsChantier } from "../hooks/useDroitsChantier";
import { useComptesRendus, useDeposerCompteRendu, useMarquerCompteRenduVu, useRetirerFichier } from "../hooks/useFiche";
import { AjoutFichier, LignesFichiers } from "./FichiersChantier";

const signaler = (err: unknown) => afficherToast(messageErreur(err));

/**
 * « 📋 Comptes-rendus » (`chantierComptesRendusHTML`, CHA-03). Un compte-rendu
 * déposé est « non lu » (pastille, gras) jusqu'à ce que quelqu'un l'ouvre ;
 * droits du module « rapports », comme la RLS de la table.
 */
export function BlocComptesRendus({ chantierId }: { chantierId: string }) {
  const cr = useComptesRendus(chantierId);
  const droits = useDroitsChantier();
  const deposer = useDeposerCompteRendu(chantierId);
  const vu = useMarquerCompteRenduVu(chantierId);
  const retirer = useRetirerFichier(chantierId, "chantier_comptes_rendus");

  return (
    <div className="chantier-section" style={{ gridColumn: "1/-1" }}>
      <div className="section-title" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span>📋 Comptes-rendus</span>
        {droits.crCreer && <AjoutFichier accepte={ACCEPTE_COMPTE_RENDU} enCours={deposer.isPending} onFichier={(f) => deposer.mutate(f, { onError: signaler })} />}
      </div>
      {cr.isError && <Erreur erreur={cr.error} reessayer={() => void cr.refetch()} />}
      {cr.isSuccess && (
        <LignesFichiers
          fichiers={cr.data.map((c) => ({ id: c.id, nom: c.fichier_nom ?? c.titre ?? "Compte-rendu", date: c.date_compte_rendu, chemin: c.fichier_chemin, nonLu: !c.vu }))}
          modifiable={droits.crSupprimer}
          onOuvert={(f) => f.nonLu && droits.crModifier && vu.mutate(f.id)}
          onRetirer={(id) => retirer.mutate(id, { onError: signaler })}
        />
      )}
    </div>
  );
}
