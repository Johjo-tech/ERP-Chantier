import { useState } from "react";
import { Modale } from "@/components/ui/modale";
import { formatDateFr } from "@/lib/dates";
import type { Constats } from "../api/planning";
import { tacheDuJour, tachesHorsMetier, type CartePlanning, type TachePlanning } from "../domain/cartes";
import { planMaterialiser } from "../domain/planification";
import { actionsTache, appartenanceDe } from "../domain/taches";
import { useSauvegarderTerrain } from "../hooks/usePlanning";
import { BandeauTache } from "./BandeauTache";
import { usePlanningContexte } from "./contexte";
import { Croquis } from "./Croquis";
import { FicheSousTraitant } from "./FicheSousTraitant";
import { autresDates, constatsInitiaux, journeeSupplementaire } from "./fiche";
import { avecVille, libelleDuMetier } from "./format";
import { PhotosTerrain } from "./PhotosTerrain";
import { TravauxPrevus } from "./TravauxPrevus";
import { TravauxSupplementaires } from "./TravauxSupplementaires";
import { ZoneContacts } from "./ZoneContacts";

/** Ceux qui créent une tâche manquante (`peut_ecrire`) — l'écran historique la créait à l'ouverture (D-PLN-02). */
const PREPARENT = ["admin", "conducteur", "technicien"];
const TOILE = { largeur: 540, hauteur: 280 };

function Titre({ texte, pourToutLeBon = false, style }: { texte: string; pourToutLeBon?: boolean; style?: React.CSSProperties }) {
  return (
    <div className="section-title" style={style ?? { marginTop: "16px" }}>
      {texte}
      {pourToutLeBon && (
        <>
          {" "}
          <span className="tout-le-bon">pour tout le bon</span>
        </>
      )}
    </div>
  );
}

interface Props {
  carte: CartePlanning;
  jour: string | null;
  onFermer: () => void;
}

/**
 * La fiche d'intervention d'une carte (`technicienInterventionModal`, PLN-08,
 * PLN-09) : le circuit de la tâche de CE métier, les contacts, la journée, le
 * commentaire, la pièce, les travaux en plus, les photos et le croquis. Le
 * sous-traitant ouvre sa propre fenêtre, « Valider les travaux ». Aucun prix.
 */
export function FicheIntervention({ carte, jour, onFermer }: Props) {
  const { role } = usePlanningContexte();
  if (role === "sous_traitant") return <FicheSousTraitant carte={carte} jour={jour} onFermer={onFermer} />;
  return <FicheTechnicien carte={carte} jour={jour} onFermer={onFermer} />;
}

function FicheTechnicien({ carte, jour, onFermer }: Props) {
  const { role, donnees, peutPlanifier, appliquer, demanderDate, signaler } = usePlanningContexte();
  const sauver = useSauvegarderTerrain();
  const suppl = journeeSupplementaire(carte, jour);
  const jourVise = suppl ?? carte.rdv.datePlanifiee;
  const entrees = carte.metiersDeLaCarte.map((m) => ({ metier: m, tache: tacheDuJour(carte, m, jourVise) }));
  const hors = carte.positionLiee <= 1 ? tachesHorsMetier(carte) : [];
  const principale = entrees.find((e) => e.tache)?.tache ?? hors[0] ?? null;
  const [constats, setConstats] = useState<Constats>(() => constatsInitiaux(principale));
  const toutes = [...entrees.map((e) => e.tache).filter((t): t is TachePlanning => !!t), ...hors];
  const toutesValidees = toutes.length > 0 && toutes.every((t) => t.statut === "validee");
  const saisissable = !!principale && actionsTache(principale.statut, role, appartenanceDe(principale, donnees.monEquipeId, donnees.monSousTraitantId)).peutSaisir;
  const journeeFaite = suppl ? !!carte.suppl.find((d) => d.date === suppl)?.fait : toutes.length > 0 && toutes.every((t) => t.statut === "realisee" || t.statut === "validee");
  const titre = `${carte.bon.numero_bc || carte.bon.client_nom}${carte.metierKey ? ` — ${libelleDuMetier(carte.metierKey)}` : ""}${suppl ? ` — ${formatDateFr(suppl)}` : ""}`;
  const rien = !carte.tentatives.length && !carte.bon.rappel_date;

  const enregistrer = () => {
    if (!principale || !saisissable) return onFermer();
    sauver.mutate(
      { tacheId: principale.id, constats },
      {
        onSuccess: () => {
          onFermer();
          signaler("Intervention enregistrée.");
        },
        onError: (e) => signaler("", e),
      }
    );
  };

  return (
    <Modale titre={titre} onFermer={onFermer} largeurMax="600px">
      <p className="card-sub">
        {carte.bon.client_nom} — {avecVille(carte.bon.adresse, carte.bon.code_postal, carte.bon.ville)}
      </p>

      <Titre texte="🔧 Métier de cette carte" style={{ marginTop: "14px" }} />
      <div style={{ marginTop: "12px" }}>
        {entrees.map(({ metier, tache }) =>
          tache ? (
            <BandeauTache key={tache.id} tache={tache} metier={metier} travaux={<TravauxPrevus carte={carte} />} constats={constats} />
          ) : (
            <div key={metier ?? "sans-metier"} className="wf-bandeau">
              {metier && <div className="wf-metier">{libelleDuMetier(metier)}</div>}
              <TravauxPrevus carte={carte} />
              <div className="wf-meta">Aucune journée enregistrée{jourVise ? ` le ${formatDateFr(jourVise)}` : ""}.</div>
              {jourVise && role && PREPARENT.includes(role) && (
                <div className="wf-actions">
                  <button type="button" className="btn" onClick={() => appliquer(carte, () => planMaterialiser(carte, metier, jourVise))}>
                    Préparer la fiche de ce jour
                  </button>
                </div>
              )}
            </div>
          )
        )}
        {hors.map((t) => (
          <BandeauTache key={t.id} tache={t} metier={t.metier} horsMetier constats={constats} />
        ))}
        {toutesValidees && (
          <div className="wf-bandeau">
            <span className="wf-meta">
              ✓ Tous les métiers sont validés — le bon attend son chiffrage dans <b>Facturation › Validation</b>.
            </span>
          </div>
        )}
      </div>

      <Titre texte="📞 Contacts et relances" pourToutLeBon />
      <ZoneContacts carte={carte} />
      {rien && <p className="card-sub">Aucun appel ni relance enregistré pour ce bon.</p>}

      <Titre texte="📅 Cette date" pourToutLeBon />
      {/* Cochée d'après les tâches : la journée se clôt par « ✓ Travaux terminés » (D-ECR-PLN-06). */}
      <label className="bc-tache-row" style={{ background: "var(--surface-2)", borderRadius: "8px" }}>
        <input type="checkbox" checked={journeeFaite} readOnly disabled title="Se coche par « ✓ Travaux terminés »" />
        <span style={{ flex: 1 }}>Cette date est terminée</span>
      </label>
      <p className="card-sub">{autresDates(carte, jourVise)}</p>
      {peutPlanifier && carte.rdv.datePlanifiee && (
        <button type="button" className="btn small ghost" onClick={() => demanderDate(carte)} title="Planifier ce même bon de commande sur un jour de plus">
          + Ajouter une journée
        </button>
      )}

      <Titre texte="💬 Commentaire" pourToutLeBon />
      <textarea rows={3} aria-label="Commentaire" placeholder="Remarque sur l'intervention (optionnel)…" style={{ width: "100%" }} value={constats.commentaire} disabled={!saisissable} onChange={(e) => setConstats({ ...constats, commentaire: e.target.value })} />

      <Titre texte="📦 Pièce" pourToutLeBon />
      <label className="bc-tache-row" style={{ background: "var(--surface-2)", borderRadius: "8px" }}>
        <input type="checkbox" checked={constats.pieceACommander} disabled={!saisissable} onChange={(e) => setConstats({ ...constats, pieceACommander: e.target.checked })} />
        <span style={{ flex: 1 }}>Pièce à commander</span>
      </label>
      <input type="text" aria-label="Pièce à commander" placeholder="Laquelle ? (référence, description…)" style={{ width: "100%", marginTop: "6px", display: constats.pieceACommander ? "block" : "none" }} value={constats.pieceDescription} disabled={!saisissable} onChange={(e) => setConstats({ ...constats, pieceDescription: e.target.value })} />

      <Titre texte="➕ Travail effectué en plus (sans prix)" />
      <p className="card-sub">Pour signaler un travail réalisé en plus de ce qui était prévu, sans montant associé.</p>
      <TravauxSupplementaires bcId={carte.bcId} tacheId={principale?.id ?? null} />

      <Titre texte="📷 Photos" />
      <PhotosTerrain bcId={carte.bcId} />

      <Titre texte="✏️ Dessin / croquis" />
      <p className="card-sub">Utile pour schématiser un problème ou un emplacement.</p>
      <Croquis
        {...TOILE}
        id="techDessinCanvas"
        libelle="Dessin / croquis"
        valeur={constats.croquis}
        desactive={!saisissable}
        onChange={(croquis) => setConstats({ ...constats, croquis })}
        style={{ width: "100%", touchAction: "none", border: "1px solid var(--border)", borderRadius: "10px", background: "#fff" }}
        effacer={{ libelle: "Effacer le dessin", classe: "btn small ghost", style: { marginTop: "6px" } }}
      />

      <div style={{ display: "flex", gap: "10px", marginTop: "18px" }}>
        <button type="button" className="btn primary" disabled={sauver.isPending} onClick={enregistrer}>
          ✓ Enregistrer
        </button>
        <button type="button" className="btn ghost" onClick={onFermer}>
          Annuler
        </button>
      </div>
    </Modale>
  );
}

