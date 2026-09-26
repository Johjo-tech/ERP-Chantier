import { useState } from "react";
import { useSupprimerTravail } from "@/modules/commandes/hooks/useBons";
import { useAjouterTravail, useTravauxSupplementaires } from "../hooks/usePlanning";
import { usePlanningContexte } from "./contexte";

const SIGNALENT = ["admin", "conducteur", "technicien", "sous_traitant"];
const RETIRENT = ["admin", "conducteur"];
const COULEUR = "#9B6EF0";

/**
 * Les travaux constatés en plus du bon (`addTravailSupplementaire`,
 * `renderTravauxSupplementairesListe`) : le terrain les signale, sans prix —
 * le chiffrage se fait dans Facturation › Validation. `compacte` : la forme
 * de la fiche du sous-traitant (bouton « Ajouter » discret).
 */
export function TravauxSupplementaires({ bcId, tacheId, compacte = false }: { bcId: string; tacheId: string | null; compacte?: boolean }) {
  const { role, signaler } = usePlanningContexte();
  const travaux = useTravauxSupplementaires(bcId, true);
  const ajouter = useAjouterTravail();
  const supprimer = useSupprimerTravail();
  const [libelle, setLibelle] = useState("");
  const origine = role === "admin" || role === "conducteur" ? "conducteur" : "technicien";
  const consigner = () => {
    if (!libelle.trim()) return;
    ajouter.mutate(
      { bcId, tacheId, libelle: libelle.trim(), origine },
      {
        onSuccess: () => {
          setLibelle("");
          signaler("Travail supplémentaire consigné — à chiffrer.");
          void travaux.refetch();
        },
        onError: (err) => signaler("", err),
      }
    );
  };
  const saisie = (
    <>
      <input type="text" aria-label="Travail supplémentaire" placeholder="Ex : Remplacement d'un raccord non prévu…" style={{ flex: 1 }} value={libelle} onChange={(e) => setLibelle(e.target.value)} />
      <button type="button" className={compacte ? "btn small" : "btn primary"} disabled={ajouter.isPending} onClick={consigner}>
        {compacte ? "Ajouter" : "+ Ajouter"}
      </button>
    </>
  );
  const liste = travaux.data ?? [];
  return (
    <>
      {role && SIGNALENT.includes(role) && (compacte ? <div style={{ display: "flex", gap: "6px" }}>{saisie}</div> : <div className="entretien-add-row">{saisie}</div>)}
      <div style={{ marginTop: "8px" }}>
        {travaux.isError && <div className="empty">Liste indisponible.</div>}
        {travaux.isSuccess && !liste.length && <div className="empty">Aucun travail supplémentaire.</div>}
        {liste.map((t) => (
          <div key={t.id} className="achat-row" style={{ "--cat-color": COULEUR } as React.CSSProperties}>
            <div className="achat-row-icon" style={{ background: `${COULEUR}22`, color: COULEUR }}>➕</div>
            <div className="achat-row-main">
              <div className="achat-designation">{t.libelle}</div>
              <div className="achat-date">
                {t.statut === "chiffre" ? "chiffré" : "à chiffrer"} · constaté par {t.origine || "—"}
              </div>
            </div>
            {role && RETIRENT.includes(role) && (
              <button type="button" className="btn small danger" aria-label="Retirer ce travail" onClick={() => supprimer.mutate(t.id, { onSuccess: () => void travaux.refetch(), onError: (e) => signaler("", e) })}>
                ✕
              </button>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
