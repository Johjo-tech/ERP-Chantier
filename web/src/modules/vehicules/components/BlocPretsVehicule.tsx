import { useState } from "react";
import { Chargement, Erreur } from "@/components/etats/Etats";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateFr } from "@/lib/dates";
import { messageErreur } from "@/lib/erreurs";
import { usePermission } from "@/modules/auth-roles/hooks/useSession";
import { FormulairePret } from "@/modules/materiel/components/FormulairePret";
import { HistoriquePrets } from "@/modules/materiel/components/HistoriquePrets";
import { etatsProposes } from "@/modules/materiel/domain/materiel";
import { nomEmprunteur, pretEnCours, retourPrevu } from "@/modules/materiel/domain/prets";
import { usePersonnes, useReferentielMateriel } from "@/modules/materiel/hooks/useMateriel";
import type { PretVehicule } from "../api/prets";
import { lireEtatDepart, lireMarquesRetour, type Marque } from "../domain/schema-vehicule";
import type { Vehicule } from "../domain/vehicule";
import { usePretsVehicule, usePreterVehicule, useRendreVehicule, useSupprimerPretVehicule } from "../hooks/useVehicules";
import { MarquesDuPret } from "./MarquesDuPret";
import { SchemaVehicule } from "./SchemaVehicule";

/** Le retour d'un véhicule : on relève les NOUVELLES marques, puis on confirme. */
function Retour({ vehiculeId, pret, onFini }: { vehiculeId: string; pret: PretVehicule; onFini: () => void }) {
  const [marques, setMarques] = useState<Marque[]>([]);
  const rendre = useRendreVehicule(vehiculeId);
  return (
    <div className="flex flex-col gap-2">
      {rendre.isError && <Alert variant="erreur">{messageErreur(rendre.error)}</Alert>}
      <SchemaVehicule titre="Nouvelles rayures ou chocs constatés au retour" marques={marques} onChange={setMarques} />
      <div className="flex gap-2">
        <Button size="sm" disabled={rendre.isPending} onClick={() => rendre.mutate({ pretId: pret.id, marques }, { onSuccess: onFini })}>
          Confirmer le retour
        </Button>
        <Button size="sm" variant="ghost" onClick={onFini}>Annuler</Button>
      </div>
    </div>
  );
}

/** Prêts d'un véhicule, avec le schéma de l'état au départ et au retour (VEH-03). */
export function BlocPretsVehicule({ vehicule }: { vehicule: Vehicule }) {
  const modifiable = usePermission("vehicules", "modifier");
  const prets = usePretsVehicule(vehicule.id);
  const personnes = usePersonnes();
  const etats = useReferentielMateriel("etat_materiel");
  const preter = usePreterVehicule(vehicule.id);
  const supprimer = useSupprimerPretVehicule(vehicule.id);
  const [marquesDepart, setMarquesDepart] = useState<Marque[]>([]);
  const [enRetour, setEnRetour] = useState(false);
  const annuaire = personnes.data ?? [];
  const listeEtats = etatsProposes(etats.data ?? [], null);

  if (prets.isPending) return <Chargement />;
  if (prets.isError) return <Erreur erreur={prets.error} reessayer={() => void prets.refetch()} />;
  const enCours = pretEnCours(prets.data);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Prêts du véhicule</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {supprimer.isError && <Alert variant="erreur">{messageErreur(supprimer.error)}</Alert>}
        {enCours && (
          <div role="status" className="flex flex-col gap-3 rounded-md border border-warning/40 bg-warning/10 px-4 py-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span>
                Actuellement prêté à <strong>{nomEmprunteur(enCours, annuaire)}</strong> depuis le {formatDateFr(enCours.date_debut)}
                {enCours.duree_jours != null && ` (retour prévu ${formatDateFr(retourPrevu(enCours))})`}
              </span>
              {modifiable && !enRetour && <Button size="sm" onClick={() => setEnRetour(true)}>Marquer comme rendu</Button>}
            </div>
            {enRetour && <Retour vehiculeId={vehicule.id} pret={enCours} onFini={() => setEnRetour(false)} />}
          </div>
        )}
        {!enCours && !vehicule.vendu && modifiable && (
          <FormulairePret
            personnes={annuaire}
            etats={listeEtats}
            etatInitial={listeEtats[0] ?? ""}
            enCours={preter.isPending}
            erreur={preter.error}
            onPreter={(saisie) => preter.mutate({ saisie, marques: marquesDepart }, { onSuccess: () => setMarquesDepart([]) })}
            complement={<SchemaVehicule titre="État du véhicule au départ : cliquez pour marquer rayures et chocs" marques={marquesDepart} onChange={setMarquesDepart} />}
          />
        )}
        <HistoriquePrets
          prets={prets.data}
          personnes={annuaire}
          etatAuPret={(p) => lireEtatDepart(p.etat_depart).etat}
          modifiable={modifiable}
          onSupprimer={(id) => supprimer.mutate(id)}
          complement={(p) => <MarquesDuPret depart={lireEtatDepart(p.etat_depart).marques} retour={lireMarquesRetour(p.etat_retour)} />}
        />
      </CardContent>
    </Card>
  );
}
