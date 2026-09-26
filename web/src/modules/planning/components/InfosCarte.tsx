import { formatDateFr } from "@/lib/dates";
import { montant } from "@/lib/money";
import { formatEurosEcran, useModeDiscret } from "@/lib/modeDiscret";
import { circuitDuBon, etapeWorkflow, etatPieceDuBon } from "@/modules/commandes/domain/workflow";
import type { CartePlanning } from "../domain/cartes";
import { lienTelephone } from "../domain/contacts";
import { usePlanningContexte } from "./contexte";
import { avecVille, CLASSE_LOGEMENT, LIBELLES_LOGEMENT, libelleDuMetier, numeroDeLaCarte } from "./format";

/** La pièce attendue (`pieceAttendueLigne`) : en une ligne, lisible sans survol — un technicien sur un téléphone ne survole pas. */
export function LignePiece({ carte, classe = "planning-card-sub" }: { carte: CartePlanning; classe?: string }) {
  useModeDiscret();
  const { donnees } = usePlanningContexte();
  const piece = etatPieceDuBon(donnees.taches.filter((t) => t.bon_commande_id === carte.bcId));
  if (!piece.pieceACommander && !piece.description) return null;
  const etape = piece.recueLe ? `reçue le ${formatDateFr(piece.recueLe)}` : piece.dateCommande ? `commandée le ${formatDateFr(piece.dateCommande)}` : "pas encore commandée";
  const texte = [piece.description || "pièce non précisée", etape, piece.fournisseur ? `chez ${piece.fournisseur}` : ""].filter(Boolean).join(" — ");
  return <div className={classe} style={{ color: piece.recueLe ? "#12875A" : "#C24E00", fontWeight: 600 }}>📦 {texte}</div>;
}

/** Le titre d'une carte : client, « 🔗 2/3 », « 🏠 n », et 📦 quand une pièce est à commander. */
export function TitreCarte({ carte, apres }: { carte: CartePlanning; apres?: React.ReactNode }) {
  useModeDiscret();
  const { donnees } = usePlanningContexte();
  const piece = etatPieceDuBon(donnees.taches.filter((t) => t.bon_commande_id === carte.bcId));
  return (
    <div className="planning-card-title">
      {carte.bon.client_nom}
      {carte.nbMetiers > 0 && (
        <span className="planning-lien-badge" title={`Ce bon de commande a ${carte.nbMetiers} métiers, chacun avec sa propre vignette`}>
          🔗 {carte.positionLiee}/{carte.nbMetiers}
        </span>
      )}
      {carte.logementPartage > 0 && (
        <span className="planning-logement-badge" title={`${carte.logementPartage} bons de commande liés au même devis (même logement)`}>
          🏠 {carte.logementPartage}
        </span>
      )}
      {piece.pieceACommander && (
        <span className="planning-piece-badge" title={`Pièce à commander : ${piece.description || "non précisée"}`}>
          📦
        </span>
      )}
      {apres}
    </div>
  );
}

/** L'étape du circuit en une pastille (`etapeWorkflow`) — à qui c'est le tour. */
export function EtapeCarte({ carte }: { carte: CartePlanning }) {
  useModeDiscret();
  const { donnees } = usePlanningContexte();
  if (carte.isSav) return null;
  const circuit = circuitDuBon(donnees.taches.filter((t) => t.bon_commande_id === carte.bcId), carte.bon.statut_workflow);
  const etape = etapeWorkflow(circuit, carte.bon.statut_workflow === "facture");
  return (
    <div className={`planning-etape planning-etape-${etape.cle}`} title={etape.libelle}>
      {etape.court}
    </div>
  );
}

/**
 * L'occupant et son numéro (`ligneLocatairePlanning`). Le `tel:` n'accepte
 * que chiffres et « + » ; le clic est arrêté, sans quoi la carte ouvrirait la
 * fiche par-dessus l'appel.
 */
function LigneLocataire({ carte }: { carte: CartePlanning }) {
  useModeDiscret();
  const { donnees } = usePlanningContexte();
  const tel = (donnees.telephones[carte.bcId] ?? "").trim();
  const nom = (carte.bon.occupant ?? "").trim();
  if (!tel && !nom) return null;
  const lien = lienTelephone(tel);
  return (
    <div className="planning-card-sub">
      🏠 {nom || "Locataire"}
      {nom && lien ? " · " : ""}
      {lien && (
        <a href={lien} onClick={(e) => e.stopPropagation()} style={{ color: "inherit", textDecoration: "underline" }}>
          ☎ {tel}
        </a>
      )}
    </div>
  );
}

/** Les lignes communes aux deux gabarits de carte, de « n° » à « Terminée le » (`planningCardHTML`). */
export function LignesCarte({ carte, avecPiece }: { carte: CartePlanning; avecPiece: boolean }) {
  useModeDiscret();
  const b = carte.bon;
  const metier = libelleDuMetier(carte.metier);
  return (
    <>
      <div className="planning-card-sub">{numeroDeLaCarte(carte)}</div>
      <EtapeCarte carte={carte} />
      {b.interlocuteur && <div className="planning-card-sub">👤 {b.interlocuteur}</div>}
      <LigneLocataire carte={carte} />
      {(b.conducteur || metier) && (
        <div className="planning-card-sub">
          {b.conducteur ? `🦺 ${b.conducteur}` : ""}
          {b.conducteur && metier ? " · " : ""}
          {metier ? `🔧 ${metier}` : ""}
        </div>
      )}
      {b.adresse && <div className="planning-card-sub">📍 {avecVille(b.adresse, b.code_postal, b.ville)}</div>}
      {b.logement_statut && LIBELLES_LOGEMENT[b.logement_statut] && (
        <div className="planning-card-sub" style={{ marginTop: "2px" }}>
          <span className={`badge ${CLASSE_LOGEMENT[b.logement_statut] ?? "info"}`}>{LIBELLES_LOGEMENT[b.logement_statut]}</span>
        </div>
      )}
      {(b.etage || b.numero_logement) && <div className="planning-card-sub">{[b.etage && `Étage ${b.etage}`, b.numero_logement && `N° ${b.numero_logement}`].filter(Boolean).join(" · ")}</div>}
      {carte.isSav && b.probleme_description && <div className="planning-card-sub" style={{ color: "var(--danger)" }}>⚠ {b.probleme_description}</div>}
      {avecPiece && <LignePiece carte={carte} />}
      {b.date_planification_initiale && (
        <div className="planning-card-sub" title="Reportée pour attente de pièce">
          🕓 1ère planif. : {formatDateFr(b.date_planification_initiale)}
        </div>
      )}
      {carte.termineeLe && <div className="planning-card-sub" style={{ color: "#2E9BF0" }}>✅ Terminée le {formatDateFr(carte.termineeLe)}</div>}
    </>
  );
}

/** Le montant du bon — jamais au sous-traitant, qui lit « Votre montant », ni au terrain (la vue le masque déjà). */
export function MontantCarte({ carte }: { carte: CartePlanning }) {
  useModeDiscret();
  const { voitPrix, role } = usePlanningContexte();
  if (role === "sous_traitant" || !voitPrix || carte.montant === null) return null;
  return <div className="planning-card-amount">{formatEurosEcran(montant(carte.montant))}</div>;
}

/** Le lien vers la pièce jointe du bon (`planning-card-pj`) : l'aperçu vit sur la fiche du bon. */
export function PieceJointeCarte({ carte, avecNom }: { carte: CartePlanning; avecNom: boolean }) {
  useModeDiscret();
  if (!carte.bon.piece_jointe_chemin) return null;
  return (
    <a href={`/commandes/${carte.bcId}`} className="planning-card-pj" draggable={false} onClick={(e) => e.stopPropagation()} title="Aperçu de la pièce jointe">
      📎{avecNom ? ` ${carte.bon.piece_jointe_nom || "Pièce jointe"}` : ""}
    </a>
  );
}

/** Le liseré rouge clignotant d'un SAV. */
export function BarreSav({ carte }: { carte: CartePlanning }) {
  useModeDiscret();
  return carte.isSav ? <div className="planning-sav-bar" title="SAV" /> : null;
}

/** Les informations de la carte en bloc, pour la fiche d'intervention. */
export function InfosCarte({ carte }: { carte: CartePlanning }) {
  useModeDiscret();
  return (
    <div>
      <TitreCarte carte={carte} />
      <LignesCarte carte={carte} avecPiece />
    </div>
  );
}
