import { formatDateFr } from "@/lib/dates";
import { afficherToast } from "@/lib/toast";
import { usePermission } from "@/modules/auth-roles/hooks/useSession";
import type { MaterielAvecPrets } from "../api/materiels";
import { etatsProposes } from "../domain/materiel";
import { nomEmprunteur, pretEnCours, retourPrevu } from "../domain/prets";
import { usePersonnes, usePreterMateriel, useReferentielMateriel, useRendreMateriel, useSupprimerPretMateriel } from "../hooks/useMateriel";
import { FormulairePret } from "./FormulairePret";
import { HistoriquePrets } from "./HistoriquePrets";
import { STYLE_BANDEAU_PRET, useToastErreur } from "./communs";

/**
 * La section « 📦 Prêts » de la fiche (VEH-05), au HTML de l'ancien écran
 * (app.js l. 14790) : le bandeau du prêt en cours avec « ✓ Marquer comme
 * rendu », sinon la ligne de prêt, puis l'historique. Les prêts ont leur
 * table : ils survivent au rechargement (VEH-20, D-VEH-01).
 */
export function BlocPretsMateriel({ materiel }: { materiel: MaterielAvecPrets }) {
  const modifiable = usePermission("materiel", "modifier");
  const personnes = usePersonnes();
  const etats = useReferentielMateriel("etat_materiel");
  const preter = usePreterMateriel(materiel.id);
  const rendre = useRendreMateriel(materiel.id);
  const supprimer = useSupprimerPretMateriel(materiel.id);
  useToastErreur(preter.error ?? rendre.error ?? supprimer.error);
  const annuaire = personnes.data ?? [];
  const enCours = pretEnCours(materiel.prets);
  const listeEtats = etatsProposes(etats.data ?? [], materiel.etat_general);

  return (
    <div className="chantier-section" style={{ gridColumn: "1/-1" }}>
      <div className="section-title">📦 Prêts</div>
      {enCours ? (
        <div className="facture-verrou-banner" role="status" style={STYLE_BANDEAU_PRET}>
          <span>
            🔶 Actuellement prêté à <strong>{nomEmprunteur(enCours, annuaire)}</strong> depuis le {formatDateFr(enCours.date_debut)}
            {enCours.duree_jours != null && ` (retour prévu ${formatDateFr(retourPrevu(enCours))})`}
          </span>
          {modifiable && (
            <button
              type="button"
              className="btn small primary"
              disabled={rendre.isPending}
              onClick={() => rendre.mutate(enCours.id, { onSuccess: () => afficherToast("Matériel marqué comme rendu.", "success") })}
            >
              ✓ Marquer comme rendu
            </button>
          )}
        </div>
      ) : (
        modifiable && (
          <FormulairePret
            key={materiel.prets.length}
            id={`pret-${materiel.id}`}
            quoi="ce matériel"
            personnes={annuaire}
            etats={listeEtats}
            etatInitial={materiel.etat_general ?? listeEtats[0] ?? ""}
            enCours={preter.isPending}
            onPreter={(s) => preter.mutate(s, { onSuccess: () => afficherToast("Matériel prêté.", "success") })}
          />
        )
      )}
      <HistoriquePrets prets={materiel.prets} personnes={annuaire} etatAuPret={(p) => p.etat_depart} modifiable={modifiable} onSupprimer={(id) => supprimer.mutate(id)} />
    </div>
  );
}
