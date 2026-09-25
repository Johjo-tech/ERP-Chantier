import type { ReactNode } from "react";
import { Erreur } from "@/components/etats/Etats";
import { Alert } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { messageErreur } from "@/lib/erreurs";
import { ACCEPTE_DEVIS_COMPLEMENTAIRE } from "../domain/fichiers";
import { useDroitsChantier } from "../hooks/useDroitsChantier";
import { useDeposerDevisComplementaire, useDevisComplementaires, useRetirerFichier } from "../hooks/useFiche";
import { BoutonDepot, ListeFichiers } from "./Fichiers";

/**
 * Devis complémentaires (CHA-13) : les devis de l'application rattachés au
 * chantier (liste apportée par le module devis, `devisDuChantier`) et les
 * devis reçus en fichier (`chantier_devis_complementaires`, réservée à qui
 * gère le chantier : ce sont des montants).
 */
export function BlocDevisComplementaires({ chantierId, devisDuChantier }: { chantierId: string; devisDuChantier?: ReactNode }) {
  const droits = useDroitsChantier();
  const fichiers = useDevisComplementaires(chantierId);
  const deposer = useDeposerDevisComplementaire(chantierId);
  const retirer = useRetirerFichier(chantierId, "chantier_devis_complementaires");
  return (
    <div className="flex flex-col gap-4">
      {devisDuChantier}
      {droits.gere && (
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Devis reçus en fichier</CardTitle>
            <BoutonDepot libelle="+ Fichier" accepte={ACCEPTE_DEVIS_COMPLEMENTAIRE} onFichier={(f) => deposer.mutate(f)} enCours={deposer.isPending} />
          </CardHeader>
          <CardContent>
            {(deposer.isError || retirer.isError) && <Alert variant="erreur">{messageErreur(deposer.error ?? retirer.error)}</Alert>}
            {fichiers.isError && <Erreur erreur={fichiers.error} reessayer={() => void fichiers.refetch()} />}
            {fichiers.isSuccess && (
              <ListeFichiers
                fichiers={fichiers.data.map((d) => ({ id: d.id, nom: d.fichier_nom ?? d.designation ?? "Devis", date: d.date_document, chemin: d.fichier_chemin }))}
                modifiable
                onRetirer={(id) => retirer.mutate(id)}
              />
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
