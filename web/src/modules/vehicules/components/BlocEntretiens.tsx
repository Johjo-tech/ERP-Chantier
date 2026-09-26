import { useState, type CSSProperties } from "react";
import { Chargement, Erreur } from "@/components/etats/Etats";
import { formatDateFr } from "@/lib/dates";
import { montant } from "@/lib/money";
import { formatEurosEcran, useModeDiscret } from "@/lib/modeDiscret";
import { afficherToast } from "@/lib/toast";
import { usePermission, useVoitLesPrix } from "@/modules/auth-roles/hooks/useSession";
import { useToastErreur } from "@/modules/materiel/components/communs";
import { trierEntretiens, type Entretien } from "../domain/entretien";
import type { Vehicule } from "../domain/vehicule";
import { useAjouterEntretien, useEntretiens, useModifierEntretien, useSupprimerEntretien } from "../hooks/useVehicules";
import { AjoutEntretien, EditionEntretien } from "./FormulaireEntretien";
import { LienFichier } from "./LienFichier";

/** La pastille verte des entretiens (`--cat-color:#5BC97A` de l'ancien écran). */
const VERT_ENTRETIEN = "#5BC97A";
const LIGNE = { "--cat-color": VERT_ENTRETIEN } as CSSProperties;

function LigneEntretien({ en, voitLesPrix, modifiable, onModifier, onSupprimer }: { en: Entretien; voitLesPrix: boolean; modifiable: boolean; onModifier: () => void; onSupprimer: () => void }) {
  useModeDiscret();
  return (
    <div className="achat-row" style={LIGNE}>
      <div className="achat-row-icon" style={{ background: `${VERT_ENTRETIEN}22`, color: VERT_ENTRETIEN }}>
        🔧
      </div>
      <div className="achat-row-main">
        <div className="achat-designation">
          {en.designation}
          {en.kilometrage != null && (
            <>
              {" "}
              <span className="card-sub">— {en.kilometrage.toLocaleString("fr-FR")} km</span>
            </>
          )}
          {en.fichier_chemin && (
            <>
              {" · "}
              <LienFichier chemin={en.fichier_chemin} libelle="📎 facture" />
            </>
          )}
        </div>
        <div className="achat-date">{formatDateFr(en.date_entretien)}</div>
      </div>
      {voitLesPrix && <div className="achat-montant">{formatEurosEcran(montant(en.montant))}</div>}
      {modifiable && (
        <>
          <button type="button" className="todo-remove" title="Modifier" aria-label={`Modifier l'entretien ${en.designation}`} onClick={onModifier}>
            ✏️
          </button>
          <button type="button" className="todo-remove" title="Supprimer" aria-label={`Supprimer l'entretien ${en.designation}`} onClick={onSupprimer}>
            ✕
          </button>
        </>
      )}
    </div>
  );
}

/**
 * La section « 🔧 Historique d'entretien » (VEH-03), au HTML de l'ancien écran
 * (app.js l. 15080) : ligne d'ajout, puis `.achats-list`, la ligne en cours de
 * correction à sa place. Le compteur du véhicule monte avec un kilométrage
 * supérieur. Supprimer demande confirmation (D-VEH-07).
 */
export function BlocEntretiens({ vehicule }: { vehicule: Vehicule }) {
  useModeDiscret();
  const modifiable = usePermission("vehicules", "modifier");
  const voitLesPrix = useVoitLesPrix();
  const entretiens = useEntretiens(vehicule.id);
  const ajouter = useAjouterEntretien(vehicule);
  const corriger = useModifierEntretien(vehicule);
  const supprimer = useSupprimerEntretien(vehicule.id);
  useToastErreur(ajouter.error ?? corriger.error ?? supprimer.error);
  const [enEdition, setEnEdition] = useState<string | null>(null);

  return (
    <div className="chantier-section" style={{ gridColumn: "1/-1" }}>
      <div className="section-title" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span>🔧 Historique d&apos;entretien</span>
      </div>
      {modifiable && (
        <AjoutEntretien
          vehiculeId={vehicule.id}
          kmVehicule={vehicule.kilometrage}
          voitLesPrix={voitLesPrix}
          enCours={ajouter.isPending}
          onAjouter={(saisie, fichier, reussi) =>
            ajouter.mutate(
              { saisie, fichier },
              {
                onSuccess: () => {
                  reussi();
                  afficherToast("Entretien enregistré.", "success");
                },
              }
            )
          }
        />
      )}
      <div className="achats-list">
        {entretiens.isPending && <Chargement />}
        {entretiens.isError && <Erreur erreur={entretiens.error} reessayer={() => void entretiens.refetch()} />}
        {entretiens.isSuccess && !entretiens.data.length && <div className="empty">Aucun entretien enregistré pour l&apos;instant.</div>}
        {entretiens.isSuccess &&
          trierEntretiens(entretiens.data).map((en) =>
            enEdition === en.id ? (
              <EditionEntretien
                key={en.id}
                entretien={en}
                voitLesPrix={voitLesPrix}
                enCours={corriger.isPending}
                onAnnuler={() => setEnEdition(null)}
                onEnregistrer={(saisie) =>
                  corriger.mutate(
                    { id: en.id, saisie },
                    {
                      onSuccess: () => {
                        setEnEdition(null);
                        afficherToast("Entretien modifié.", "success");
                      },
                    }
                  )
                }
              />
            ) : (
              <LigneEntretien
                key={en.id}
                en={en}
                voitLesPrix={voitLesPrix}
                modifiable={modifiable}
                onModifier={() => setEnEdition(en.id)}
                onSupprimer={() => {
                  if (window.confirm(`Supprimer « ${en.designation} » ?`)) supprimer.mutate(en);
                }}
              />
            )
          )}
      </div>
    </div>
  );
}
