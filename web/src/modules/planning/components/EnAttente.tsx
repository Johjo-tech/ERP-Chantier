import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router";
import { formatDateFr, todayISO } from "@/lib/dates";
import { messageErreur } from "@/lib/erreurs";
import { montant } from "@/lib/money";
import { formatEurosEcran, useModeDiscret } from "@/lib/modeDiscret";
import { afficherToast } from "@/lib/toast";
import { useSocieteActive } from "@/modules/auth-roles/hooks/useSession";
import { circuitDuBon, etapeWorkflow } from "@/modules/commandes/domain/workflow";
import { useBcRecu } from "@/modules/commandes/hooks/useBons";
import { useRapports } from "@/modules/interventions/hooks/useRapports";
import type { CartePlanning } from "../domain/cartes";
import { ajouterTentative, heureDeParis } from "../domain/contacts";
import { LIBELLES_STATUT, statutDe } from "../domain/taches";
import { clesPlanning, useContacts } from "../hooks/usePlanning";
import { usePlanningContexte } from "./contexte";
import { avecVille, CLASSE_LOGEMENT, LIBELLES_LOGEMENT, libelleDuMetier } from "./format";
import { LignePiece } from "./InfosCarte";
import { ZoneContacts } from "./ZoneContacts";

/** `etapeWorkflow(b).cls` : la variante de l'étape en classe de pastille de l'ancienne feuille. */
const CLASSE_ETAPE: Record<string, string> = { succes: "success", alerte: "warn", default: "info", danger: "danger" };
/** `badgeClass` pour les statuts d'un bon. */
const CLASSE_STATUT: Record<string, string> = { "en cours": "yellow", terminée: "success", terminé: "success", annulé: "danger", brouillon: "gray" };
const DUREE_TOAST_CONTACT_MS = 1800;
/**
 * Un bouton désactivé de l'ancien écran garde l'habit du navigateur : la
 * feuille ne le grise pas. `complements.css` le grise (`.btn:disabled`) ; on
 * revient ici au rendu de l'ancien, sur cette carte qui le reprend.
 */
const DESACTIVE_COMME_L_ANCIEN: React.CSSProperties = { opacity: 1, cursor: "default" };
const arreter = (e: { stopPropagation: () => void }) => e.stopPropagation();

/** `contactBoutonsHTML` : les trois gestes, un compteur à la place de l'historique, et le rappel prévu. */
function BoutonsContact({ carte }: { carte: CartePlanning }) {
  useModeDiscret();
  const { peutContacter, demanderRappel } = usePlanningContexte();
  const { tentatives } = useContacts();
  const n = carte.tentatives.length;
  const noter = (type: "appel" | "sms") =>
    tentatives.mutate(
      { bcId: carte.bcId, tentatives: ajouterTentative(carte.tentatives, type, todayISO(), heureDeParis(new Date()), crypto.randomUUID()) },
      { onSuccess: () => afficherToast(type === "appel" ? "📞 Tentative d'appel enregistrée !" : "💬 SMS enregistré !", "success", DUREE_TOAST_CONTACT_MS), onError: (e) => afficherToast(messageErreur(e)) }
    );
  return (
    <div className="planning-contact-zone" onClick={arreter}>
      {peutContacter && (
        <>
          <button type="button" className="btn-contact btn-contact-appel" onClick={() => noter("appel")} title="Enregistrer une tentative d'appel (maintenant)">📞</button>
          <button type="button" className="btn-contact btn-contact-sms" onClick={() => noter("sms")} title="Enregistrer un SMS envoyé (maintenant)">💬</button>
          <button type="button" className="btn-contact btn-contact-rappel" onClick={() => demanderRappel(carte)} title="Programmer un rappel (ex : le locataire revient de congés)">📅</button>
        </>
      )}
      {n > 0 && <span className="contact-compteur" title={`${n} tentative(s) — le détail est dans la carte dépliée`}>{n}</span>}
      {carte.bon.rappel_date && <span className="contact-tag contact-tag-rappel" title="Rappel programmé">🔄 {formatDateFr(carte.bon.rappel_date)}</span>}
    </div>
  );
}

const DUREE_TOAST_BC_MS = 5000;

/**
 * « Le bon de commande est arrivé ? » (`enregistrerBCRecu`) : le numéro arrive
 * par courriel ou par courrier, et ouvrir le bon pour taper cinq caractères
 * est un détour.
 */
function ZoneBcRecu({ bcId }: { bcId: string }) {
  useModeDiscret();
  const [numero, setNumero] = useState("");
  const bcRecu = useBcRecu();
  const societe = useSocieteActive();
  const qc = useQueryClient();
  const enregistrer = () => {
    const n = numero.trim();
    if (!n) return afficherToast("Indiquez le numéro figurant sur le bon du client.");
    bcRecu.mutate(
      { id: bcId, numero: n },
      {
        onSuccess: () => afficherToast(`Bon de commande n° ${n} enregistré — ce bon n'est plus en attente, et le numéro partira sur sa facture.`, "success", DUREE_TOAST_BC_MS),
        onError: (e) => afficherToast(messageErreur(e)),
        onSettled: () => void qc.invalidateQueries({ queryKey: clesPlanning.racine(societe.id) }),
      }
    );
  };
  return (
    <div className="piece-replanifier-zone">
      <span className="card-sub" style={{ margin: 0 }}>📄 Le bon de commande est arrivé ?</span>
      <input type="text" aria-label="N° indiqué sur le bon du client" placeholder="N° indiqué sur le bon du client" style={{ minWidth: "200px" }} value={numero} onChange={(e) => setNumero(e.target.value)} onClick={arreter} />
      <button type="button" className="btn small primary" onClick={(e) => (e.stopPropagation(), enregistrer())}>✓ BC reçu</button>
    </div>
  );
}

/**
 * La carte d'un bon « En attente » (`bonCommandeCardHTML(b, 'attente')`) :
 * repliée, l'identité, les contacts, le montant et les pastilles, puis les
 * gestes du bon ; dépliée, le détail et l'état de chaque tâche. Les gestes qui
 * appartiennent au bon mènent à sa fiche (D-ECR-PLN-04).
 */
function CarteBonAttente({ carte }: { carte: CartePlanning }) {
  useModeDiscret();
  const { donnees, voitPrix, nomEquipe, nomSousTraitant } = usePlanningContexte();
  const rapports = useRapports();
  const [ouverte, setOuverte] = useState(false);
  const b = carte.bon;
  const taches = donnees.taches.filter((t) => t.bon_commande_id === carte.bcId);
  const facture = b.statut_workflow === "facture";
  const etape = etapeWorkflow(circuitDuBon(taches, b.statut_workflow), facture);
  // Un bon qui a déjà son SAV n'en crée pas un second (`savLie`).
  const savLie = donnees.bons.some((x) => x.bon_commande_parent_id === carte.bcId);
  const rapportLie = (rapports.data ?? []).find((r) => r.bon_commande_id === carte.bcId);
  const metiers = (Array.isArray(b.metiers) && b.metiers.length ? (b.metiers as string[]) : b.metier ? [b.metier] : []).map(libelleDuMetier).join(", ");
  const statut = b.statut ?? "";
  return (
    <div className={`card bc-card ${ouverte ? "est-ouverte" : ""}`} id={`bonCommande-card-${carte.bcId}`} data-wf="attente">
      <div className="bc-tete">
        <button type="button" className="bc-chevron" onClick={(e) => (e.stopPropagation(), setOuverte(!ouverte))} title={ouverte ? "Replier" : "Tout afficher"} aria-expanded={ouverte}>
          {ouverte ? "▾" : "▸"}
        </button>
        <div className="bc-ident">
          <div className="card-title">
            {b.client_nom}
            {facture && (
              <>
                {" "}
                <span className="badge success" style={{ marginLeft: "6px" }} title="Facture émise : le bon ne se modifie plus">🔒 Facturé</span>
              </>
            )}
          </div>
          <div className="card-sub">
            <span className="numref-lg" style={{ whiteSpace: "pre-line" }}>{b.numero_bc ?? ""}</span>
            {b.conducteur ? ` · 🦺 ${b.conducteur}` : ""}
          </div>
          <div className="card-sub">{avecVille(b.adresse, b.code_postal, b.ville)}</div>
          {ouverte && (
            <>
              <div className="card-sub">
                {b.interlocuteur ? `👤 ${b.interlocuteur}` : ""}
                {b.interlocuteur && metiers ? " · " : ""}
                {metiers ? `🔧 ${metiers}` : ""}
              </div>
              <ZoneContacts carte={carte} lectureSeule />
              {rapportLie && (
                <div className="card-sub">
                  Rapport lié : <Link to={`/rapports/${rapportLie.id}/apercu`} style={{ color: "var(--accent-2)", textDecoration: "underline" }}>{rapportLie.numero}</Link>
                </div>
              )}
              <LignePiece carte={carte} classe="card-sub" />
              {b.date_planification_initiale && <div className="card-sub">🕓 Planifiée une première fois le {formatDateFr(b.date_planification_initiale)} (reportée pour attente de pièce)</div>}
            </>
          )}
        </div>
        <div className="bc-contact">
          <BoutonsContact carte={carte} />
        </div>
        <div className="bc-etat">
          <div className="amount">{voitPrix && b.montant !== null ? formatEurosEcran(montant(b.montant)) : ""}</div>
          <div className="bc-etat-badges">
            {b.logement_statut && LIBELLES_LOGEMENT[b.logement_statut] && <span className={`badge ${CLASSE_LOGEMENT[b.logement_statut] ?? "info"}`}>{LIBELLES_LOGEMENT[b.logement_statut]}</span>}
            <span className={`badge ${CLASSE_ETAPE[etape.variante] ?? "info"}`} title="Étape du circuit de validation">{etape.libelle}</span>
            <span className={`badge ${CLASSE_STATUT[statut] ?? "gray"}`}>{statut}</span>
          </div>
        </div>
      </div>
      {b.en_attente_bc && !facture && <ZoneBcRecu bcId={carte.bcId} />}
      <div className="bc-actions-bas">
        <Link className="btn small" to={`/commandes/${carte.bcId}`}>{facture ? "👁 Consulter" : "Modifier"}</Link>
        {!facture && (
          <button type="button" className="btn small" disabled title="La pré-facture doit être validée avant de facturer" style={DESACTIVE_COMME_L_ANCIEN}>
            🧾 Créer la facture
          </button>
        )}
        {!savLie && <Link className="btn small" to={`/commandes/${carte.bcId}/sav`}>Créer un SAV</Link>}
        <Link className="btn small ghost" to={`/commandes/${carte.bcId}`}>{rapportLie ? "🔗 Modifier le lien rapport" : "🔗 Lier un rapport"}</Link>
        <button type="button" className="btn small danger" disabled title="La suppression d'un bon n'est pas encore reprise dans cette application." style={DESACTIVE_COMME_L_ANCIEN}>
          Supprimer
        </button>
      </div>
      {ouverte && (
        <>
          <div className="bc-metiers-checklist" style={{ marginTop: "8px" }}>
            {taches.map((t) => (
              <div key={t.id} className="card-sub">
                {libelleDuMetier(t.metier) || "Sans métier"} : {LIBELLES_STATUT[statutDe(t.statut)]}
                {t.date_tache ? ` (${formatDateFr(t.date_tache)})` : ""} — {nomEquipe(t.technicien_id) ?? nomSousTraitant(t.sous_traitant_id) ?? "non affectée"}
              </div>
            ))}
          </div>
          <div className="bc-attente-message" style={{ marginTop: "8px" }}>
            ⏳ En attente — la validation du conducteur puis du directeur est requise avant de pouvoir facturer ce bon de commande.
          </div>
        </>
      )}
    </div>
  );
}

/**
 * « En attente technicien / sous-traitant » (`renderPlanningEnAttente`) : les
 * bons dont le terrain n'a pas fini (ni SAV, ni circuit clos, ni tout validé).
 */
export function EnAttente({ cartes, mode }: { cartes: CartePlanning[]; mode: "equipe" | "sous_traitant" }) {
  useModeDiscret();
  return (
    <>
      <div className="card-sub" style={{ marginBottom: "12px" }}>
        {mode === "sous_traitant" ? "Bons de commande assignés à un sous-traitant, en attente de validation." : "Bons de commande gérés en interne (techniciens), en attente de validation."}
      </div>
      <div>{cartes.length ? cartes.map((c) => <CarteBonAttente key={c.bcId} carte={c} />) : <div className="empty">Aucun bon de commande ne correspond.</div>}</div>
    </>
  );
}
