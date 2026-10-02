import { useState } from "react";
import { Chargement, Erreur } from "@/components/etats/Etats";
import { formatDateFr } from "@/lib/dates";
import { afficherToast } from "@/lib/toast";
import { usePermission } from "@/modules/auth-roles/hooks/useSession";
import { STYLE_BANDEAU_PRET, useToastErreur } from "@/modules/materiel/components/communs";
import { FormulairePret } from "@/modules/materiel/components/FormulairePret";
import { HistoriquePrets } from "@/modules/materiel/components/HistoriquePrets";
import { etatsProposes } from "@/modules/materiel/domain/materiel";
import { nomEmprunteur, pretEnCours, retourPrevu } from "@/modules/materiel/domain/prets";
import { usePersonnes, useReferentielMateriel } from "@/modules/materiel/hooks/useMateriel";
import type { PretVehicule } from "../api/prets";
import { lireEtatDepart, lireMarquesRetour, type Marque } from "../domain/schema-vehicule";
import type { Vehicule } from "../domain/vehicule";
import { usePretsVehicule, usePreterVehicule, useRendreVehicule, useSupprimerPretVehicule } from "../hooks/useVehicules";
import { SchemaVehicule } from "./SchemaVehicule";

const ROUGE_RETOUR = "#a30f22";
/** L'ancien écran laissait cette bulle-là un peu moins longtemps que les autres. */
const DUREE_TOAST_RETOUR_MS = 4500;

/** Le retour d'un véhicule, dans le bandeau : on relève les NOUVELLES marques, puis on confirme (app.js l. 15037). */
function Retour({ vehiculeId, pret, onFini }: { vehiculeId: string; pret: PretVehicule; onFini: () => void }) {
  const [marques, setMarques] = useState<Marque[]>([]);
  const rendre = useRendreVehicule(vehiculeId);
  useToastErreur(rendre.error);
  return (
    <div style={{ width: "100%", marginTop: "10px" }}>
      <div className="card-sub" style={{ marginBottom: "4px", color: STYLE_BANDEAU_PRET.color }}>
        Cliquez sur le schéma pour marquer les <strong>nouvelles</strong> rayures/chocs constatés au retour :
      </div>
      <SchemaVehicule titre="Nouvelles rayures ou chocs constatés au retour" marques={marques} onChange={setMarques} />
      <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
        <button
          type="button"
          className="btn small primary"
          disabled={rendre.isPending}
          onClick={() =>
            rendre.mutate(
              { pretId: pret.id, marques },
              {
                onSuccess: () => {
                  onFini();
                  const n = marques.length;
                  afficherToast(n ? `Véhicule rendu — ${n} nouvelle(s) marque(s) relevée(s).` : "Véhicule marqué comme rendu, aucune nouvelle marque.", "success", DUREE_TOAST_RETOUR_MS);
                },
              }
            )
          }
        >
          Confirmer le retour
        </button>
        <button type="button" className="btn small ghost" onClick={onFini}>
          Annuler
        </button>
      </div>
    </div>
  );
}

/** Le prêt en cours : le bandeau orangé de l'ancien écran, en colonne pour accueillir le relevé du retour. */
function PretEnCours({ vehiculeId, pret, emprunteur, modifiable }: { vehiculeId: string; pret: PretVehicule; emprunteur: string; modifiable: boolean }) {
  const [enRetour, setEnRetour] = useState(false);
  return (
    <div className="facture-verrou-banner" role="status" style={{ ...STYLE_BANDEAU_PRET, flexDirection: "column", alignItems: "flex-start" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", flexWrap: "wrap", gap: "10px" }}>
        <span>
          🔶 Actuellement prêté à <strong>{emprunteur}</strong> depuis le {formatDateFr(pret.date_debut)}
          {pret.duree_jours != null && ` (retour prévu ${formatDateFr(retourPrevu(pret))})`}
        </span>
        {modifiable && !enRetour && (
          <button type="button" className="btn small primary" onClick={() => setEnRetour(true)}>
            ✓ Marquer comme rendu
          </button>
        )}
      </div>
      {enRetour && <Retour vehiculeId={vehiculeId} pret={pret} onFini={() => setEnRetour(false)} />}
    </div>
  );
}

/**
 * La section « 📦 Prêts du véhicule » (VEH-03), au HTML de l'ancien écran
 * (app.js l. 15030) : prêt en cours ou ligne de prêt et schéma de départ, puis
 * l'historique avec ses boutons « 📋 État au départ » / « ⚠ État au retour »
 * — un seul schéma ouvert à la fois, comme `state.pretSchemaOuvert`.
 */
export function BlocPretsVehicule({ vehicule }: { vehicule: Vehicule }) {
  const modifiable = usePermission("vehicules", "modifier");
  const prets = usePretsVehicule(vehicule.id);
  const personnes = usePersonnes();
  const etats = useReferentielMateriel("etat_materiel");
  const preter = usePreterVehicule(vehicule.id);
  const supprimer = useSupprimerPretVehicule(vehicule.id);
  useToastErreur(preter.error ?? supprimer.error);
  const [marquesDepart, setMarquesDepart] = useState<Marque[]>([]);
  const [schemaOuvert, setSchemaOuvert] = useState<string | null>(null);
  const annuaire = personnes.data ?? [];
  const listeEtats = etatsProposes(etats.data ?? [], null);
  const basculer = (cle: string) => setSchemaOuvert((c) => (c === cle ? null : cle));

  if (prets.isPending) return <Chargement />;
  if (prets.isError) return <Erreur erreur={prets.error} reessayer={() => void prets.refetch()} />;
  const enCours = pretEnCours(prets.data);

  return (
    <div className="chantier-section" style={{ gridColumn: "1/-1" }}>
      <div className="section-title">📦 Prêts du véhicule</div>
      {enCours && <PretEnCours vehiculeId={vehicule.id} pret={enCours} emprunteur={nomEmprunteur(enCours, annuaire)} modifiable={modifiable} />}
      {!enCours && !vehicule.vendu && modifiable && (
        <FormulairePret
          key={prets.data.length}
          id={`pretVeh-${vehicule.id}`}
          quoi="ce véhicule"
          personnes={annuaire}
          etats={listeEtats}
          etatInitial={listeEtats[0] ?? ""}
          enCours={preter.isPending}
          onPreter={(saisie) =>
            preter.mutate(
              { saisie, marques: marquesDepart },
              {
                onSuccess: () => {
                  setMarquesDepart([]);
                  afficherToast("Véhicule prêté.", "success");
                },
              }
            )
          }
          complement={
            <>
              <div className="card-sub" style={{ margin: "10px 0 4px" }}>
                Cliquez sur le schéma pour marquer l&apos;état du véhicule au départ (rayures, chocs…) :
              </div>
              <SchemaVehicule titre="État du véhicule au départ" marques={marquesDepart} onChange={setMarquesDepart} />
            </>
          }
        />
      )}
      <HistoriquePrets
        prets={prets.data}
        personnes={annuaire}
        etatAuPret={(p) => lireEtatDepart(p.etat_depart).etat}
        modifiable={modifiable}
        onSupprimer={(id) => supprimer.mutate(id)}
        suiteDate={(p) => {
          const n = lireMarquesRetour(p.etat_retour).length;
          return n ? ` · ⚠ ${n} nouvelle(s) marque(s) au retour` : "";
        }}
        boutons={(p) => (
          <>
            {lireEtatDepart(p.etat_depart).marques.length > 0 && (
              <button type="button" className="btn small ghost" aria-expanded={schemaOuvert === `${p.id}_depart`} onClick={() => basculer(`${p.id}_depart`)}>
                📋 État au départ
              </button>
            )}
            {lireMarquesRetour(p.etat_retour).length > 0 && (
              <button type="button" className="btn small danger" aria-expanded={schemaOuvert === `${p.id}_retour`} onClick={() => basculer(`${p.id}_retour`)}>
                ⚠ État au retour
              </button>
            )}
          </>
        )}
        dessous={(p) => (
          <>
            {schemaOuvert === `${p.id}_depart` && (
              <div style={{ width: "100%", marginTop: "10px" }}>
                <div className="card-sub" style={{ marginBottom: "4px" }}>
                  État constaté au départ :
                </div>
                <SchemaVehicule titre="État constaté au départ" marques={lireEtatDepart(p.etat_depart).marques} />
              </div>
            )}
            {schemaOuvert === `${p.id}_retour` && (
              <div style={{ width: "100%", marginTop: "10px" }}>
                <div className="card-sub" style={{ marginBottom: "4px", color: ROUGE_RETOUR }}>
                  Nouvelles marques constatées au retour :
                </div>
                <SchemaVehicule titre="Nouvelles marques constatées au retour" marques={lireMarquesRetour(p.etat_retour)} />
              </div>
            )}
          </>
        )}
      />
    </div>
  );
}
