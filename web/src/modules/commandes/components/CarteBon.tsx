import { useState } from "react";
import { useNavigate } from "react-router";
import { messageErreur } from "@/lib/erreurs";
import { formatDateFr } from "@/lib/dates";
import { formatEuros, montant } from "@/lib/money";
import { formatEurosEcran, useModeDiscret } from "@/lib/modeDiscret";
import { origineDeLaCorrespondance } from "@/lib/recherche";
import { cn } from "@/lib/utils";
import { CLASSE_EN_EVIDENCE } from "@/lib/useRecherche";
import { afficherToast } from "@/lib/toast";
import { Can } from "@/modules/auth-roles/components/Can";
import { usePermission, useSession, useVoitLesPrix } from "@/modules/auth-roles/hooks/useSession";
import { totauxDocument } from "@/modules/documents/domain/totaux";
import type { Apport } from "@/modules/facturation/domain/croisement";
import type { BonDeLaListe } from "../api/bons";
import { champsCherchesDuBon } from "../domain/filtres";
import { estSav } from "../domain/bon";
import { avecVille, classeLogement, classeStatut, libelleLogement, ligneDates, ligneInterlocuteurMetiers, ligneLocataire, messageAttenteFacturation, pieceAttendue, type ContexteCarte } from "../domain/carte";
import { circuitTermine, MOTIF_CLOTURE_DEFAUT } from "../domain/circuit";
import { verrouBonCommande } from "../domain/verrou";
import { etapeWorkflow } from "../domain/workflow";
import { useBcRecu, useCloturerGratuit, useGenererFacture, useSupprimerBon } from "../hooks/useBons";
import { ContactsBon, TraceContactsBon } from "./ContactsBon";
import { LienRapport } from "./LienRapport";
import { ZonePieceCarte } from "./ZonePieceCarte";

/** Les documents voisins que la carte cite, retrouvés par la page (elle seule a toutes les listes). */
export interface LiensDuBon {
  origine: { id: string; numero_bc: string | null } | null;
  savLie: { id: string; numero_bc: string | null } | null;
  devis: { id: string; numero: string | null } | null;
  rapport: { id: string; numero: string | null } | null;
}

interface Props {
  bon: BonDeLaListe;
  contexte: ContexteCarte;
  ouverte: boolean;
  onBasculer: () => void;
  liens: LiensDuBon;
  lienOuvert: boolean;
  onLien: (ouvert: boolean) => void;
  recherche: { requete: string; apports: readonly Apport[] };
  /** Les fournisseurs déjà écrits sur des commandes, pour le sélecteur de la pièce (`fournisseursEmployes`). */
  fournisseursEmployes?: readonly string[];
  idDom?: string;
  enEvidence?: boolean;
}

/** Les durées des messages de l'ancien : le numéro reçu se relit (5 s), un refus de suppression aussi (8 s). */
const DUREE_TOAST_BC_RECU_MS = 5000;
const DUREE_TOAST_REFUS_MS = 8000;

const arreter = (e: { stopPropagation: () => void }) => e.stopPropagation();

/** Un lien « à la manière de l'ancien » : souligné, couleur d'accent, sans changer de page tant qu'on ne clique pas. */
function LienCarte({ texte, vers }: { texte: string | null; vers: string }) {
  useModeDiscret();
  const navigate = useNavigate();
  return (
    <a href={vers} onClick={(e) => { e.preventDefault(); void navigate(vers); }} style={{ color: "var(--accent-2)", textDecoration: "underline" }}>
      {texte ?? ""}
    </a>
  );
}

/**
 * « 📋 Fiche d'intervention du technicien » : ce que le terrain a laissé —
 * son commentaire, la pièce qu'il a signalée. Repliée par défaut.
 */
function FicheTechnicien({ bon }: { bon: BonDeLaListe }) {
  useModeDiscret();
  const [ouverte, setOuverte] = useState(false);
  const { commentaireTerrain, piece } = bon.circuit;
  if (!commentaireTerrain && !piece.description) return null;
  return (
    <div className="tech-fiche-zone">
      <button type="button" className="btn small ghost" aria-expanded={ouverte} onClick={(e) => { arreter(e); setOuverte(!ouverte); }}>📋 Fiche d&apos;intervention du technicien {ouverte ? "▲" : "▼"}</button>
      {ouverte && (
        <div className="tech-fiche-detail">
          {commentaireTerrain && <div className="tech-fiche-commentaire">💬 {commentaireTerrain}</div>}
          {piece.description && (
            <div className="tech-fiche-commentaire" style={{ color: "#C24E00" }}>
              📦 Pièce commandée : {piece.description}{piece.dateCommande ? ` — commandée le ${formatDateFr(piece.dateCommande)}` : ""}{piece.fournisseur ? ` — Fournisseur : ${piece.fournisseur}` : ""}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Le détail, visible carte dépliée : tout ce qui n'identifie pas l'affaire mais l'explique. */
function DetailOuvert({ bon, liens }: { bon: BonDeLaListe; liens: LiensDuBon }) {
  useModeDiscret();
  const sav = estSav(bon);
  const locataire = ligneLocataire(bon);
  const piece = pieceAttendue(bon.circuit.piece);
  const facture = bon.factures[0];
  return (
    <>
      <div className="card-sub">{ligneInterlocuteurMetiers(bon)}</div>
      <TraceContactsBon bon={bon} />
      {bon.nature_travaux && <div className="card-sub">🛠️ {bon.nature_travaux}</div>}
      {liens.origine && <div className="card-sub">Bon de commande d&apos;origine : <LienCarte texte={liens.origine.numero_bc} vers={`/commandes/${liens.origine.id}`} /></div>}
      {liens.devis && <div className="card-sub">Devis lié : <LienCarte texte={liens.devis.numero} vers={`/devis/${liens.devis.id}`} /></div>}
      {liens.rapport && <div className="card-sub">Rapport lié : <LienCarte texte={liens.rapport.numero} vers={`/rapports/${liens.rapport.id}`} /></div>}
      {bon.reference_chantier && <div className="card-sub">🏗️ Chantier : {bon.reference_chantier}</div>}
      {locataire && <div className="card-sub">{locataire}</div>}
      {sav ? (
        bon.probleme_description && <div className="card-sub" style={{ color: "var(--danger)" }}><span style={{ color: "var(--danger)" }}>⚠</span> {bon.probleme_description}</div>
      ) : (
        <div className="card-sub">{ligneDates(bon)}</div>
      )}
      {bon.piece_jointe_chemin && <div className="card-sub"><LienCarte texte={`📎 ${bon.piece_jointe_nom || "Bon du client"}`} vers={`/commandes/${bon.id}`} /></div>}
      {facture && <div className="card-sub">Facture liée : <LienCarte texte={facture.numero} vers={`/factures/${facture.id}`} /></div>}
      {liens.savLie && <div className="card-sub">SAV lié : <LienCarte texte={liens.savLie.numero_bc} vers={`/commandes/${liens.savLie.id}`} /></div>}
      <FicheTechnicien bon={bon} />
      {piece && <div className="card-sub" style={{ color: piece.recue ? "#12875A" : "#C24E00", fontWeight: 600 }}>{piece.texte}</div>}
    </>
  );
}

/** « Le bon de commande est arrivé ? » : poser le numéro sans ouvrir le bon (`enregistrerBCRecu`). */
function ZoneBcRecu({ bon }: { bon: BonDeLaListe }) {
  useModeDiscret();
  const [numero, setNumero] = useState("");
  const recu = useBcRecu();
  function poser() {
    const n = numero.trim();
    if (!n) return afficherToast("Indiquez le numéro figurant sur le bon du client.");
    recu.mutate(
      { id: bon.id, numero: n },
      { onSuccess: () => afficherToast(`Bon de commande n° ${n} enregistré — ce bon n'est plus en attente, et le numéro partira sur sa facture.`, "success", DUREE_TOAST_BC_RECU_MS), onError: (e) => afficherToast(messageErreur(e)) }
    );
  }
  return (
    <div className="piece-replanifier-zone">
      <span className="card-sub" style={{ margin: 0 }}>📄 Le bon de commande est arrivé ?</span>
      <input type="text" id={`numeroBCRecu_${bon.id}`} aria-label="N° indiqué sur le bon du client" placeholder="N° indiqué sur le bon du client" style={{ minWidth: "200px" }} value={numero} onClick={arreter} onChange={(e) => setNumero(e.target.value)} />
      <button type="button" className="btn small primary" disabled={recu.isPending} onClick={(e) => { arreter(e); poser(); }}>✓ BC reçu</button>
    </div>
  );
}

/** Les actions, visibles carte repliée : le geste qu'on vient chercher sur cet écran (`bc-actions-bas`). */
function ActionsBas({ bon, liens, contexte, onLien, lienOuvert }: Pick<Props, "bon" | "liens" | "contexte" | "onLien" | "lienOuvert">) {
  useModeDiscret();
  const navigate = useNavigate();
  const prix = useVoitLesPrix();
  const { roleEffectif } = useSession();
  const generer = useGenererFacture();
  const cloturer = useCloturerGratuit();
  const supprimer = useSupprimerBon();
  const sav = estSav(bon);
  const factureLiee = bon.factures.length > 0;
  const verrou = verrouBonCommande(bon.factures);
  // La pré-facture ne vit que là où le prix se décide, et pas pour une affaire facturée, close ou SAV.
  const chiffrageIci = contexte === "liste" && prix && !factureLiee && bon.statut_workflow !== "cloture_gratuit" && !sav;
  // `bc_cloturer_gratuit` n'accepte que l'administrateur : miroir d'affichage, sur le rôle EFFECTIF.
  // `bc_generer_facture` n'accepte que l'administrateur et la secrétaire : on ne propose pas ce que la base refuserait.
  const factures = usePermission("factures", "creer");
  const peutCreer = usePermission("bons_commande", "creer");
  const peutSupprimer = usePermission("bons_commande", "supprimer");
  const cloturable = sav && !circuitTermine(bon, factureLiee) && roleEffectif === "admin";
  const lignes = bon.lignesMontant ?? [];
  const echec = (e: unknown) => afficherToast(messageErreur(e));

  function creerFacture() {
    generer.mutate(bon.id, { onSuccess: (id) => void navigate(`/factures/${id}`, { state: { message: "Facture créée en brouillon depuis le bon de commande." } }), onError: echec });
  }
  function clore() {
    const motif = window.prompt(`Clôturer ${bon.numero_bc || "ce SAV"} sans facturation ?\n\nMotif (facultatif, conservé sur la fiche et dans le journal) :`, MOTIF_CLOTURE_DEFAUT);
    if (motif === null) return;
    cloturer.mutate({ bonId: bon.id, motif: motif.trim() }, { onSuccess: () => afficherToast("Affaire clôturée sans facturation.", "success"), onError: echec });
  }
  function effacer() {
    if (!window.confirm("Supprimer définitivement cet élément ?")) return;
    supprimer.mutate(bon.id, { onError: (e) => afficherToast(messageErreur(e), "error", DUREE_TOAST_REFUS_MS) });
  }
  return (
    <div className="bc-actions-bas">
      {chiffrageIci && (
        <button type="button" className="btn small primary" onClick={(e) => { arreter(e); void navigate(`/commandes/${bon.id}/prefacture`); }}>
          🧾 Ouvrir la pré-facture{lignes.length ? ` — ${formatEuros(totauxDocument(lignes, 0).ttc)} TTC` : " — pas encore chiffrée"}
        </button>
      )}
      {verrou ? (
        <button type="button" className="btn small" title={verrou.libelle} onClick={() => void navigate(`/commandes/${bon.id}`)}>👁 Consulter</button>
      ) : (
        <button type="button" className="btn small" onClick={() => void navigate(`/commandes/${bon.id}`)}>Modifier</button>
      )}
      {!(factureLiee || sav) && factures &&
        (bon.circuit.valideDirecteur ? (
          <button type="button" className="btn small primary" disabled={generer.isPending} onClick={creerFacture}>🧾 Créer la facture</button>
        ) : (
          <button type="button" className="btn small" disabled title="La pré-facture doit être validée avant de facturer">🧾 Créer la facture</button>
        ))}
      {cloturable && (
        <button type="button" className="btn small primary" title="Un SAV est une reprise sous garantie : il se clôt, il ne se facture pas" onClick={(e) => { arreter(e); clore(); }}>✓ Clôturer sans facturation</button>
      )}
      {!(liens.savLie || sav) && peutCreer && <button type="button" className="btn small" onClick={() => void navigate(`/commandes/${bon.id}/sav`)}>Créer un SAV</button>}
      {liens.rapport ? (
        <>
          <button type="button" className="btn small ghost" onClick={(e) => { arreter(e); onLien(!lienOuvert); }}>🔗 Modifier le lien rapport</button>
          <LienRapport.Delier rapportId={liens.rapport.id} />
        </>
      ) : (
        <button type="button" className="btn small ghost" onClick={(e) => { arreter(e); onLien(!lienOuvert); }}>🔗 Lier un rapport</button>
      )}
      {peutSupprimer && (verrou ? (
        <button type="button" className="btn small danger" disabled title={verrou.libelle}>Supprimer</button>
      ) : (
        <button type="button" className="btn small danger" disabled={supprimer.isPending} onClick={effacer}>Supprimer</button>
      ))}
    </div>
  );
}

/**
 * La carte d'un bon (`bonCommandeCardHTML`) : repliée, les quatre lignes qui
 * identifient l'affaire, les contacts, le montant et les pastilles, puis les
 * actions ; dépliée, tout le détail. Une seule carte ouverte à la fois — la
 * page le tient.
 */
export function CarteBon({ bon, contexte, ouverte, onBasculer, liens, lienOuvert, onLien, recherche, fournisseursEmployes, idDom, enEvidence }: Props) {
  useModeDiscret();
  const prix = useVoitLesPrix();
  const sav = estSav(bon);
  const factureLiee = bon.factures.length > 0;
  const verrou = verrouBonCommande(bon.factures);
  const etape = etapeWorkflow(bon.circuit, factureLiee);
  const origines = recherche.requete.trim() ? origineDeLaCorrespondance(recherche.requete, champsCherchesDuBon(bon), recherche.apports) : [];
  const origine = origines.map((o) => `${o.etiquette} ${o.valeur}`).join(" · ");
  const classeEtape = { succes: "success", alerte: "warn", default: "info", danger: "danger" }[etape.variante];
  const enAttente = !factureLiee && !sav && bon.statut_workflow !== "cloture_gratuit" && !bon.circuit.valideDirecteur && contexte !== "pieceCommande";
  return (
    <div className={cn("card bc-card", ouverte && "est-ouverte", enEvidence && CLASSE_EN_EVIDENCE)} id={idDom ?? `bonCommande-card-${bon.id}`} role="article" aria-label={`Bon ${bon.numero_interne ?? ""} — ${bon.client_nom}`}>
      <div className="bc-tete">
        <button type="button" className="bc-chevron" onClick={(e) => { arreter(e); onBasculer(); }} title={ouverte ? "Replier" : "Tout afficher"} aria-expanded={ouverte}>{ouverte ? "▾" : "▸"}</button>
        <div className="bc-ident">
          <div className="card-title">
            {bon.client_nom}
            {sav && <>{" "}<span className="badge warn" style={{ marginLeft: "6px" }}>SAV</span></>}
            {verrou && <>{" "}<span className="badge success" style={{ marginLeft: "6px" }} title={verrou.libelle}>🔒 Facturé</span></>}
          </div>
          <div className="card-sub"><span className="numref-lg" style={{ whiteSpace: "pre-line" }}>{bon.numero_bc}</span>{bon.conducteur ? ` · 🦺 ${bon.conducteur}` : ""}</div>
          <div className="card-sub">{avecVille(bon.adresse, bon.code_postal, bon.ville)}</div>
          {origine && <div className="recherche-origine" title={origine}>🔎 {origine}</div>}
          {ouverte && <DetailOuvert bon={bon} liens={liens} />}
          {ouverte && contexte === "pieceCommande" && bon.circuit.piece.pieceACommander && (
            <Can module="planning" action="modifier">
              <ZonePieceCarte bon={bon} employes={fournisseursEmployes ?? []} />
            </Can>
          )}
        </div>
        <div className="bc-contact"><ContactsBon bon={bon} /></div>
        <div className="bc-etat">
          {/* Le montant ne se montre qu'à qui voit les prix ; la vue le rend NULL aux autres de toute façon. */}
          <div className="amount">{prix ? formatEurosEcran(montant(bon.montant)) : ""}</div>
          <div className="bc-etat-badges">
            {bon.logement_statut && <span className={`badge ${classeLogement(bon.logement_statut)}`}>{libelleLogement(bon.logement_statut)}</span>}
            {!sav && <span className={`badge ${classeEtape}`} title="Étape du circuit de validation">{etape.libelle}</span>}
            <span className={`badge ${classeStatut(bon.statut)}`}>{bon.statut}</span>
          </div>
        </div>
      </div>
      {bon.en_attente_bc && !verrou && <ZoneBcRecu bon={bon} />}
      <ActionsBas bon={bon} liens={liens} contexte={contexte} onLien={onLien} lienOuvert={lienOuvert} />
      {ouverte && lienOuvert && <div style={{ marginTop: "8px" }}><LienRapport bon={bon} onFermer={() => onLien(false)} /></div>}
      {ouverte && enAttente && <div className="bc-attente-message" style={{ marginTop: "8px" }}>{messageAttenteFacturation(bon.circuit.valideConducteur)}</div>}
    </div>
  );
}
