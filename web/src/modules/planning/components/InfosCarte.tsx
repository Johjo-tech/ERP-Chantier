import { Badge } from "@/components/ui/badge";
import { formatDateFr } from "@/lib/dates";
import { montant } from "@/lib/money";
import { formatEurosEcran, useModeDiscret } from "@/lib/modeDiscret";
import { circuitDuBon, etapeWorkflow, etatPieceDuBon } from "@/modules/commandes/domain/workflow";
import type { CartePlanning } from "../domain/cartes";
import { lienTelephone } from "../domain/contacts";
import { usePlanningContexte } from "./contexte";
import { adresseDuLieu, LIBELLES_LOGEMENT, numeroDeLaCarte } from "./format";

/** La pièce attendue en une ligne, lisible sans survol — un technicien sur un téléphone ne survole pas. */
function LignePiece({ carte }: { carte: CartePlanning }) {
  useModeDiscret();
  const { donnees } = usePlanningContexte();
  const piece = etatPieceDuBon(donnees.taches.filter((t) => t.bon_commande_id === carte.bcId));
  if (!piece.pieceACommander && !piece.description) return null;
  const etape = piece.recueLe ? `reçue le ${formatDateFr(piece.recueLe)}` : piece.dateCommande ? `commandée le ${formatDateFr(piece.dateCommande)}` : "pas encore commandée";
  const texte = [piece.description || "pièce non précisée", etape, piece.fournisseur ? `chez ${piece.fournisseur}` : ""].filter(Boolean).join(" — ");
  return <p className={piece.recueLe ? "font-semibold text-emerald-700" : "font-semibold text-orange-700"}>📦 {texte}</p>;
}

export function EtapeCarte({ carte }: { carte: CartePlanning }) {
  useModeDiscret();
  const { donnees } = usePlanningContexte();
  if (carte.isSav) return null;
  const circuit = circuitDuBon(donnees.taches.filter((t) => t.bon_commande_id === carte.bcId), carte.bon.statut_workflow);
  const etape = etapeWorkflow(circuit, carte.bon.statut_workflow === "facture");
  return <Badge variant={etape.variante} title={etape.libelle}>{etape.court}</Badge>;
}

/**
 * Le montant : aucun pour le terrain (la vue les masque déjà) ; au
 * sous-traitant, le SIEN seulement, jamais celui du bon.
 */
export function MontantCarte({ carte }: { carte: CartePlanning }) {
  useModeDiscret();
  const { voitPrix, role, donnees } = usePlanningContexte();
  if (role === "sous_traitant") {
    const sien = donnees.montantsSousTraitant[carte.bcId];
    return sien != null ? <p className="font-semibold text-emerald-700">💶 Votre montant : {formatEurosEcran(montant(sien))} HT</p> : <p className="text-muted-foreground">💶 Montant en cours de définition</p>;
  }
  if (!voitPrix || carte.montant === null) return null;
  return <p className="text-right font-semibold">{formatEurosEcran(montant(carte.montant))}</p>;
}

export function InfosCarte({ carte, compacte = false }: { carte: CartePlanning; compacte?: boolean }) {
  useModeDiscret();
  const { donnees } = usePlanningContexte();
  const b = carte.bon;
  const telephone = donnees.telephones[carte.bcId];
  const lien = lienTelephone(telephone);
  return (
    <div className="flex flex-col gap-0.5 text-xs">
      <p className="text-sm font-semibold leading-tight">
        {b.client_nom}
        {carte.nbMetiers > 0 && <span className="ml-1 text-muted-foreground" title={`Ce bon a ${carte.nbMetiers} métiers, chacun avec sa vignette`}>🔗 {carte.positionLiee}/{carte.nbMetiers}</span>}
        {carte.logementPartage > 0 && <span className="ml-1 text-muted-foreground" title="Bons liés au même devis (même logement)">🏠 {carte.logementPartage}</span>}
      </p>
      <p>{numeroDeLaCarte(carte)}</p>
      <div><EtapeCarte carte={carte} /></div>
      {!compacte && b.interlocuteur && <p>👤 {b.interlocuteur}</p>}
      {(b.occupant || telephone) && (
        <p>
          🏠 {b.occupant || "Locataire"}
          {lien && (
            <>
              {" · "}
              <a href={lien} className="underline" onClick={(e) => e.stopPropagation()}>☎ {telephone}</a>
            </>
          )}
        </p>
      )}
      {(b.conducteur || carte.metier) && <p>{[b.conducteur && `🦺 ${b.conducteur}`, carte.metier && `🔧 ${carte.metier}`].filter(Boolean).join(" · ")}</p>}
      {adresseDuLieu(carte) && <p>📍 {adresseDuLieu(carte)}</p>}
      {!compacte && b.logement_statut && <p>{LIBELLES_LOGEMENT[b.logement_statut] ?? b.logement_statut}</p>}
      {!compacte && (b.etage || b.numero_logement) && <p>{[b.etage && `Étage ${b.etage}`, b.numero_logement && `N° ${b.numero_logement}`].filter(Boolean).join(" · ")}</p>}
      {carte.isSav && b.probleme_description && <p className="text-destructive">⚠ {b.probleme_description}</p>}
      <LignePiece carte={carte} />
      {b.date_planification_initiale && <p title="Reportée pour attente de pièce">🕓 1ère planif. : {formatDateFr(b.date_planification_initiale)}</p>}
      {carte.termineeLe && <p className="text-sky-700">✅ Terminée le {formatDateFr(carte.termineeLe)}</p>}
    </div>
  );
}
