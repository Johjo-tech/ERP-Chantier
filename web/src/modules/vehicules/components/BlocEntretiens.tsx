import { useState } from "react";
import { Chargement, Erreur } from "@/components/etats/Etats";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BoutonConfirme } from "@/components/ui/confirmation";
import { formatDateFr } from "@/lib/dates";
import { messageErreur } from "@/lib/erreurs";
import { montant } from "@/lib/money";
import { formatEurosEcran } from "@/lib/modeDiscret";
import { usePermission, useVoitLesPrix } from "@/modules/auth-roles/hooks/useSession";
import { trierEntretiens } from "../domain/entretien";
import { formatKm, type Vehicule } from "../domain/vehicule";
import { useAjouterEntretien, useEntretiens, useModifierEntretien, useSupprimerEntretien } from "../hooks/useVehicules";
import { FormulaireEntretien } from "./FormulaireEntretien";
import { LienFichier } from "./LienFichier";

/** L'historique d'entretien (VEH-03) : le compteur du véhicule monte avec un kilométrage supérieur. */
export function BlocEntretiens({ vehicule }: { vehicule: Vehicule }) {
  const modifiable = usePermission("vehicules", "modifier");
  const voitLesPrix = useVoitLesPrix();
  const entretiens = useEntretiens(vehicule.id);
  const ajouter = useAjouterEntretien(vehicule);
  const corriger = useModifierEntretien(vehicule);
  const supprimer = useSupprimerEntretien(vehicule.id);
  const [enEdition, setEnEdition] = useState<string | null>(null);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Historique d'entretien</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {modifiable && (
          <FormulaireEntretien
            entretien={null}
            kmVehicule={vehicule.kilometrage}
            voitLesPrix={voitLesPrix}
            enCours={ajouter.isPending}
            erreur={ajouter.error}
            onEnregistrer={(saisie, fichier, reussi) => ajouter.mutate({ saisie, fichier }, { onSuccess: reussi })}
          />
        )}
        {supprimer.isError && <Alert variant="erreur">{messageErreur(supprimer.error)}</Alert>}
        {entretiens.isPending && <Chargement />}
        {entretiens.isError && <Erreur erreur={entretiens.error} reessayer={() => void entretiens.refetch()} />}
        {entretiens.isSuccess && !entretiens.data.length && <p className="text-sm text-muted-foreground">Aucun entretien enregistré pour l'instant.</p>}
        {entretiens.isSuccess && entretiens.data.length > 0 && (
          <ul className="divide-y divide-border" aria-label="Entretiens">
            {trierEntretiens(entretiens.data).map((en) =>
              enEdition === en.id ? (
                <li key={en.id} className="py-2">
                  <FormulaireEntretien
                    entretien={en}
                    kmVehicule={vehicule.kilometrage}
                    voitLesPrix={voitLesPrix}
                    enCours={corriger.isPending}
                    erreur={corriger.error}
                    onEnregistrer={(saisie) => corriger.mutate({ id: en.id, saisie }, { onSuccess: () => setEnEdition(null) })}
                    onAnnuler={() => setEnEdition(null)}
                  />
                </li>
              ) : (
                <li key={en.id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
                  <div className="flex-1">
                    <span className="font-medium">{en.designation}</span>
                    {en.kilometrage != null && <span className="text-muted-foreground"> — {formatKm(en.kilometrage)}</span>}
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {formatDateFr(en.date_entretien)}
                      {en.fichier_chemin && <LienFichier chemin={en.fichier_chemin} libelle={`Facture (${en.fichier_nom ?? "fichier"})`} />}
                    </div>
                  </div>
                  {voitLesPrix && <span className="tabular-nums">{formatEurosEcran(montant(en.montant))}</span>}
                  {modifiable && (
                    <>
                      <Button size="sm" variant="ghost" onClick={() => setEnEdition(en.id)} aria-label={`Modifier l'entretien ${en.designation}`}>
                        Modifier
                      </Button>
                      <BoutonConfirme libelle="Supprimer" question={`Supprimer « ${en.designation} » ?`} onConfirmer={() => supprimer.mutate(en)} />
                    </>
                  )}
                </li>
              )
            )}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
