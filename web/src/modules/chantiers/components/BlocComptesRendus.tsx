import { Chargement, Erreur } from "@/components/etats/Etats";
import { Alert } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { messageErreur } from "@/lib/erreurs";
import { ACCEPTE_COMPTE_RENDU } from "../domain/fichiers";
import { useDroitsChantier } from "../hooks/useDroitsChantier";
import { useComptesRendus, useDeposerCompteRendu, useMarquerCompteRenduVu, useRedater, useRetirerFichier } from "../hooks/useFiche";
import { BoutonDepot, ListeFichiers } from "./Fichiers";

/**
 * Les comptes-rendus de chantier (CHA-03). Un compte-rendu déposé est « non
 * lu » (pastille) jusqu'à ce que quelqu'un l'ouvre ; droits du module
 * « rapports », comme la RLS de la table.
 */
export function BlocComptesRendus({ chantierId }: { chantierId: string }) {
  const cr = useComptesRendus(chantierId);
  const droits = useDroitsChantier();
  const deposer = useDeposerCompteRendu(chantierId);
  const vu = useMarquerCompteRenduVu(chantierId);
  const redater = useRedater(chantierId, "chantier_comptes_rendus");
  const retirer = useRetirerFichier(chantierId, "chantier_comptes_rendus");
  const erreur = deposer.error ?? redater.error ?? retirer.error ?? vu.error;

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Comptes-rendus</CardTitle>
        {droits.crCreer && <BoutonDepot libelle="+ Ajouter" accepte={ACCEPTE_COMPTE_RENDU} onFichier={(f) => deposer.mutate(f)} enCours={deposer.isPending} />}
      </CardHeader>
      <CardContent>
        {erreur && <Alert variant="erreur">{messageErreur(erreur)}</Alert>}
        {cr.isPending && <Chargement />}
        {cr.isError && <Erreur erreur={cr.error} reessayer={() => void cr.refetch()} />}
        {cr.isSuccess && (
          <ListeFichiers
            fichiers={cr.data.map((c) => ({ id: c.id, nom: c.fichier_nom ?? c.titre ?? "Compte-rendu", date: c.date_compte_rendu, chemin: c.fichier_chemin, nonLu: !c.vu }))}
            modifiable={droits.crSupprimer || droits.crModifier}
            dateModifiable={droits.crModifier}
            onOuvert={(f) => f.nonLu && droits.crModifier && vu.mutate(f.id)}
            onRedater={(id, date) => redater.mutate({ id, date })}
            onRetirer={droits.crSupprimer ? (id) => retirer.mutate(id) : undefined}
          />
        )}
      </CardContent>
    </Card>
  );
}
