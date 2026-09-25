import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateFr } from "@/lib/dates";
import { messageErreur } from "@/lib/erreurs";
import { usePermission } from "@/modules/auth-roles/hooks/useSession";
import type { MaterielAvecPrets } from "../api/materiels";
import { etatsProposes } from "../domain/materiel";
import { nomEmprunteur, pretEnCours, retourPrevu } from "../domain/prets";
import { usePersonnes, usePreterMateriel, useReferentielMateriel, useRendreMateriel, useSupprimerPretMateriel } from "../hooks/useMateriel";
import { FormulairePret } from "./FormulairePret";
import { HistoriquePrets } from "./HistoriquePrets";

/** Prêter, marquer rendu, l'historique (VEH-05). Les prêts ont leur table : ils survivent au rechargement (VEH-20). */
export function BlocPretsMateriel({ materiel }: { materiel: MaterielAvecPrets }) {
  const modifiable = usePermission("materiel", "modifier");
  const personnes = usePersonnes();
  const etats = useReferentielMateriel("etat_materiel");
  const preter = usePreterMateriel(materiel.id);
  const rendre = useRendreMateriel(materiel.id);
  const supprimer = useSupprimerPretMateriel(materiel.id);
  const annuaire = personnes.data ?? [];
  const enCours = pretEnCours(materiel.prets);
  const listeEtats = etatsProposes(etats.data ?? [], materiel.etat_general);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Prêts</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {(rendre.isError || supprimer.isError) && <Alert variant="erreur">{messageErreur(rendre.error ?? supprimer.error)}</Alert>}
        {enCours ? (
          <div role="status" className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-warning/40 bg-warning/10 px-4 py-3 text-sm">
            <span>
              Actuellement prêté à <strong>{nomEmprunteur(enCours, annuaire)}</strong> depuis le {formatDateFr(enCours.date_debut)}
              {enCours.duree_jours != null && ` (retour prévu ${formatDateFr(retourPrevu(enCours))})`}
            </span>
            {modifiable && (
              <Button size="sm" onClick={() => rendre.mutate(enCours.id)} disabled={rendre.isPending}>
                Marquer comme rendu
              </Button>
            )}
          </div>
        ) : (
          modifiable && (
            <FormulairePret
              personnes={annuaire}
              etats={listeEtats}
              etatInitial={materiel.etat_general ?? listeEtats[0] ?? ""}
              enCours={preter.isPending}
              erreur={preter.error}
              onPreter={(s) => preter.mutate(s)}
            />
          )
        )}
        <HistoriquePrets
          prets={materiel.prets}
          personnes={annuaire}
          etatAuPret={(p) => p.etat_depart}
          modifiable={modifiable}
          onSupprimer={(id) => supprimer.mutate(id)}
        />
      </CardContent>
    </Card>
  );
}
