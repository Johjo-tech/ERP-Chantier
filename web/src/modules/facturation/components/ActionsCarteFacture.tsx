import { useCallback, useState } from "react";
import { useNavigate } from "react-router";
import { messageErreur } from "@/lib/erreurs";
import type { Montant } from "@/lib/money";
import { formatEurosEcran, useModeDiscret } from "@/lib/modeDiscret";
import { useSocieteActive } from "@/modules/auth-roles/hooks/useSession";
import { brouillonEmail } from "@/modules/documents/domain/email";
import type { StatutLogement } from "@/modules/documents/domain/logement";
import { estAvoir } from "@/modules/documents/domain/totaux";
import { showToast } from "@/modules/documents/impression/zone";
import { messageDepot, useDeposerFacture } from "@/modules/efacture/hooks/useEfacture";
import type { FactureCarte } from "../api/ecran";
import type { ActionsFacture } from "../domain/actions";
import { DUREE_AVIS } from "../domain/avis";
import type { Solde } from "../domain/solde";
import type { Verrou } from "../domain/verrou";
import { useDupliquerFacture, useEmettre, useSupprimerBrouillon } from "../hooks/useFactures";
import { ModaleAvoir, ModaleImputation } from "./ModalesFacture";
import { ModaleEmail } from "./ModaleEmail";
import { PdfFactureDiffere } from "./PdfFactureDiffere";

type Ouverte = "avoir" | "imputation" | "email" | null;

/**
 * La barre d'actions d'une carte (`boutonsFactureHTML`, app.js l. 5922) : ce
 * que l'état de la pièce et le rôle laissent faire, RIEN d'autre — un geste
 * indisponible ne s'affiche pas. Mêmes libellés, même ordre, mêmes titres ;
 * les confirmations sont celles de l'ancien (`confirm`), mot pour mot.
 */
export function ActionsCarteFacture({ f, ttc, actions, verrou, plateforme, imputable, solde, soldes, destinataire, avoirEtabli }: {
  f: FactureCarte;
  ttc: Montant;
  actions: ActionsFacture;
  verrou: Verrou | null;
  /** Le cadre de la fiche client dit si la pièce passe par une plateforme (`passeParUnePlateforme`). */
  plateforme: boolean;
  /** Un avoir du même client a de quoi l'alimenter (`peutReglerParAvoir`). */
  imputable: boolean;
  solde: Solde | undefined;
  soldes: readonly Solde[];
  destinataire: string | null;
  avoirEtabli: () => void;
}) {
  useModeDiscret();
  const navigate = useNavigate();
  const societe = useSocieteActive();
  const emettre = useEmettre();
  const dupliquer = useDupliquerFacture();
  const supprimer = useSupprimerBrouillon();
  const depot = useDeposerFacture(f.id);
  const [ouverte, setOuverte] = useState<Ouverte>(null);
  const [pdf, setPdf] = useState(false);
  const finPdf = useCallback(() => setPdf(false), []);
  const ouvrirFiche = () => void navigate(`/factures/${f.id}`);

  function emettreLaFacture() {
    if (!window.confirm(`Émettre la facture de ${f.client_nom} pour ${formatEurosEcran(ttc)} TTC ?\n\nElle recevra son numéro définitif. Son contenu ne pourra plus être modifié, et une correction devra passer par un avoir.`)) return;
    emettre.mutate(f.id, {
      onSuccess: (numero) => showToast(`Facture émise sous le n° ${numero || "—"}.`, "success"),
      onError: (err) => {
        console.error("Émission refusée", err);
        showToast(messageErreur(err) || "La facture n'a pas pu être émise.", "danger", DUREE_AVIS.refus);
      },
    });
  }

  function transmettre() {
    if (f.pdp_identifiant) {
      showToast(`Déjà déposée sur la plateforme (${f.pdp_identifiant}).`);
      return;
    }
    if (!window.confirm(`Déposer la facture ${f.numero ?? ""} sur la plateforme ?\n\nUne facture transmise ne peut plus être modifiée : il faudrait émettre un avoir.`)) return;
    showToast("Transmission en cours…");
    depot.mutate(undefined, {
      onSuccess: (r) => showToast(`Facture déposée sur la plateforme${r.identifiant ? ` (${r.identifiant})` : ""}.`, "success"),
      onError: (err) => showToast(messageDepot(err)),
    });
  }

  function dupliquerFacture() {
    dupliquer.mutate(f.id, {
      onSuccess: (id) => {
        showToast("Copie créée en brouillon — elle recevra son numéro à l'émission.", "success", DUREE_AVIS.copieCreee);
        void navigate(`/factures/${id}`);
      },
      onError: (err) => showToast(messageErreur(err), "danger", DUREE_AVIS.echec),
    });
  }

  function supprimerFacture() {
    if (!window.confirm("Supprimer définitivement cet élément ?")) return;
    supprimer.mutate(f.id, {
      onError: (err) => showToast(messageErreur(err) || "La suppression a été refusée. Rien n'a été supprimé.", "danger", DUREE_AVIS.suppression),
    });
  }

  const brouillon = () =>
    brouillonEmail({
      nature: "facture",
      avoir: estAvoir(f.type_document),
      numero: f.numero ?? "",
      ttc,
      societeNom: societe.nom,
      destinataire,
      lieu: { ...f, logement_statut: f.logement_statut as StatutLogement | null },
    });

  return (
    <>
      {actions.peutModifier ? (
        <button type="button" className="btn small" onClick={ouvrirFiche}>Modifier</button>
      ) : (
        <button type="button" className="btn small" onClick={ouvrirFiche} title={verrou?.libelle}>👁 Consulter</button>
      )}
      {actions.peutImprimer && <button type="button" className="btn small" onClick={() => setPdf(true)}>Imprimer / PDF</button>}
      {actions.peutEnvoyer && <button type="button" className="btn small" onClick={() => setOuverte("email")}>Envoyer par email</button>}
      {actions.peutEmettre && (
        <button type="button" className="btn small primary" onClick={emettreLaFacture} title="Attribuer son numéro définitif et la rendre transmissible">🧾 Émettre</button>
      )}
      {actions.peutTransmettre && plateforme && (
        <button type="button" className="btn small" onClick={transmettre} title="Déposer la facture électronique sur la plateforme">{f.pdp_identifiant ? "📤 Déposée" : "📤 Transmettre"}</button>
      )}
      {actions.peutEtablirAvoir && (
        <button type="button" className="btn small" onClick={() => setOuverte("avoir")} title="Rectifier cette facture émise par un avoir">↩ Établir un avoir</button>
      )}
      {actions.peutImputerAvoir && imputable && (
        <button type="button" className="btn small" onClick={() => setOuverte("imputation")} title="Solder tout ou partie de cette facture avec un avoir du même client">🧾 Régler par un avoir</button>
      )}
      {actions.peutDupliquer && (
        <button type="button" className="btn small" onClick={dupliquerFacture} title="Repartir de cette facture pour en établir une nouvelle, en brouillon">⧉ Dupliquer</button>
      )}
      {actions.peutSupprimer && <button type="button" className="btn small danger" onClick={supprimerFacture}>Supprimer</button>}
      {pdf && <PdfFactureDiffere id={f.id} fini={finPdf} />}
      {ouverte === "email" && <ModaleEmail brouillon={brouillon()} telecharger={() => setPdf(true)} fermer={() => setOuverte(null)} />}
      {ouverte === "avoir" && <ModaleAvoir facture={f} ttc={ttc} fermer={() => setOuverte(null)} etabli={avoirEtabli} />}
      {ouverte === "imputation" && solde && <ModaleImputation facture={solde} soldes={soldes} fermer={() => setOuverte(null)} />}
    </>
  );
}
