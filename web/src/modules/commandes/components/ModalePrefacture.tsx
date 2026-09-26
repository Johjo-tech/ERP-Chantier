import { useState, type CSSProperties, type ReactNode } from "react";
import { Modale } from "@/components/ui/modale";
import { formatDateFr } from "@/lib/dates";
import { messageErreur } from "@/lib/erreurs";
import { formatEuros } from "@/lib/money";
import { afficherToast } from "@/lib/toast";
import { useSession, useVoitLesPrix } from "@/modules/auth-roles/hooks/useSession";
import { useIdentiteDocument } from "@/modules/documents/hooks/useIdentiteDocument";
import { pieceImprimee } from "@/modules/documents/impression/pieces";
import { depuisBase, lignesPourEnregistrement, type LigneEdition } from "@/modules/documents/domain/lignes";
import { totauxDocument } from "@/modules/documents/domain/totaux";
import { REGLAGES_DEFAUT, type ReglagesDocuments } from "@/modules/societes/domain/reglages";
import { useReglages } from "@/modules/societes/hooks/useReglages";
import type { Bon } from "../api/bons";
import { versLigneBase } from "../domain/bon";
import { actionsFacturation, BLOCAGES_ACCOMPLIS, blocagesChiffrage, peutEcrireTerrain, type Blocage } from "../domain/circuit";
import { contexteBon } from "../domain/impression";
import { apercuDe } from "../domain/pieceJointe";
import { comptesRendus, depuisLignesAEnregistrer, documentDirecteur, travauxSaisis, versLignesAEnregistrer, type SaisieTravail, type Travail } from "../domain/prefacture";
import { montantAEnregistrer } from "../domain/regles";
import type { TacheBon } from "../domain/workflow";
import { useBon, useEnregistrerPrix, useMetiersDisponibles, useTaches, useTravaux, useUrlPieceJointe, useValiderPrefacture } from "../hooks/useBons";
import { BoiteTotaux } from "./BoiteTotaux";
import { MetiersConnus } from "./metiersConnus";
import { TableauPrefacture } from "./TableauPrefacture";

/** Les durées des messages de la validation : l'issue se lit (3 s, 4 s hors circuit). */
const DUREE_TOAST_VALIDE_MS = 3000;
const DUREE_TOAST_HORS_CIRCUIT_MS = 4000;

type Reference = "bonClient" | "bonCommande" | null;

/** Ce qui reste à traiter (`blocagesDirecteurHTML`), ou ce qui est accompli, ou le feu vert. */
function Blocages({ blocages, contournement, peutValider }: { blocages: readonly Blocage[]; contournement: boolean; peutValider: boolean }) {
  if (blocages.length && blocages.every((b) => BLOCAGES_ACCOMPLIS.includes(b.code))) {
    return <div className="wf-banner" style={{ marginBottom: "10px" }}>{blocages.map((b) => <div key={b.code}>✓ {b.libelle}</div>)}</div>;
  }
  if (blocages.length) {
    return (
      <div className="wf-banner alerte" style={{ marginBottom: "10px" }}>
        <div style={{ fontWeight: 700, marginBottom: "6px" }}>⚠ Il reste {blocages.length === 1 ? "un point" : "des points"} à traiter avant de valider</div>
        <ul style={{ margin: 0, paddingLeft: "18px" }}>
          {blocages.map((b) => <li key={b.code}>{b.libelle}{b.details.length > 0 && <>{" "}<span className="card-sub">— {b.details.join(", ")}</span></>}</li>)}
        </ul>
        {contournement && <div className="card-sub" style={{ marginTop: "8px" }}>Le montant, lui, est complet. Si cette affaire n&apos;a pas de terrain à pointer, « Valider sans passer par le planning » l&apos;envoie en facturation — et la base en garde la trace.</div>}
      </div>
    );
  }
  if (!peutValider) return <div className="wf-banner" style={{ marginBottom: "10px" }}>Le dossier est complet. La validation revient à un administrateur — enregistrez, il prendra la suite.</div>;
  return <div className="wf-banner ok" style={{ marginBottom: "10px" }}>✓ Rien ne reste en suspens : la pré-facture peut être validée.</div>;
}

/** « 💬 Ce que le terrain a rapporté » (`comptesRendusHTML`) : un compte rendu par tâche commentée. */
function ComptesRendus({ taches }: { taches: readonly TacheBon[] }) {
  const rendus = comptesRendus(taches);
  if (!rendus.length) return <div className="empty">Aucun compte rendu de terrain sur les {taches.length} tâche(s) de ce bon.</div>;
  return (
    <>
      {rendus.map((r) => (
        <div key={r.tacheId} className="achat-row" style={{ "--cat-color": "#E9A23B", alignItems: "flex-start" } as CSSProperties}>
          <div className="achat-row-icon" style={{ background: "#E9A23B22", color: "#E9A23B" }}>💬</div>
          <div className="achat-row-main">
            <div className="achat-designation">{r.metier || "Tâche"}</div>
            <div className="achat-date">{[r.date ? formatDateFr(r.date) : "", r.statut].filter(Boolean).join(" · ")}</div>
            {r.commentaire && <div style={{ marginTop: "6px", whiteSpace: "pre-wrap" }}>{r.commentaire}</div>}
          </div>
        </div>
      ))}
    </>
  );
}

/** Le document du client, tel qu'il l'a envoyé : PDF dans un cadre, image telle quelle. */
function BonDuClient({ bon, classe }: { bon: Bon; classe: string }) {
  const url = useUrlPieceJointe(bon.piece_jointe_chemin);
  if (!url.data) return null;
  const nom = bon.piece_jointe_nom || "Bon du client";
  return apercuDe(bon.piece_jointe_mime, bon.piece_jointe_nom) === "image" ? <img className={classe} src={url.data} alt={nom} /> : <iframe className={classe} src={url.data} title={nom} />;
}

/** La fiche interne (`renderPrintDoc('bonCommande', id, !avecPrix)`) : le gabarit du PDF. */
function FicheInterne({ bon, avecPrix }: { bon: Bon; avecPrix: boolean }) {
  const documentaire = useIdentiteDocument();
  if (!documentaire.data) return null;
  const e = documentaire.data.imprimable;
  const piece = pieceImprimee(contexteBon(bon, bon.lignes.map(versLigneBase), e, !avecPrix), e.variables);
  return <div style={piece.variables as CSSProperties} dangerouslySetInnerHTML={{ __html: piece.html }} />;
}

/** Le document de référence en grand (`#pfPleinEcran`) : Échap ou un clic sur le fond referme. */
function PleinEcran({ titre, onFermer, children }: { titre: string; onFermer: () => void; children: ReactNode }) {
  return (
    <div className="pf-plein" style={{ display: "flex" }} role="dialog" aria-modal="true" aria-label="Document de référence en plein écran" onClick={(e) => { if (e.target === e.currentTarget) onFermer(); }} onKeyDown={(e) => { if (e.key === "Escape") { e.stopPropagation(); onFermer(); } }}>
      <div className="pf-plein-panneau">
        <div className="pf-plein-barre">
          <span>{titre}</span>
          <div style={{ display: "flex", gap: "8px", alignItems: "center", flexShrink: 0 }}>
            <button type="button" className="attachment-float-close" title="Fermer (Échap)" autoFocus onClick={onFermer}>✕</button>
          </div>
        </div>
        <div className="pf-plein-corps">{children}</div>
      </div>
    </div>
  );
}

interface Props {
  bon: Bon;
  taches: readonly TacheBon[];
  travaux: readonly Travail[];
  reglages: ReglagesDocuments;
  onFermer: () => void;
  /** Après « Enregistrer sans valider » : le dossier relu remonte, les lignes insérées y prennent leur uuid (relecture 3, M12). */
  onEnregistre: () => Promise<void>;
}

/**
 * Le corps de la pré-facture (`renderValidationDirecteur`) : les références à
 * consulter et « Afficher les prix », la colonne de travail — les prix, ce que
 * le terrain a rapporté — et la pièce de référence à droite ; au pied, ce qui
 * reste à traiter et les gestes. La secrétaire complète, seul l'administrateur
 * valide ; valider = enregistrer les prix, intégrer les travaux chiffrés, puis
 * la transition par la base (hors circuit compris).
 */
function CorpsPrefacture({ bon, taches, travaux, reglages, onFermer, onEnregistre }: Props) {
  const { roleEffectif } = useSession();
  const droits = actionsFacturation(roleEffectif);
  const prixVisibles = useVoitLesPrix();
  const connus = useMetiersDisponibles();
  const [lignes, setLignes] = useState<LigneEdition[]>(() => bon.lignes.map(versLigneBase).map(depuisBase));
  const [saisies, setSaisies] = useState<Record<string, SaisieTravail>>({});
  const [avecPrix, setAvecPrix] = useState(prixVisibles);
  // Le bon SIGNÉ du client fait foi dès qu'il existe ; sans lui, la fiche interne prend la place.
  const [reference, setReference] = useState<Reference>(bon.piece_jointe_chemin ? "bonClient" : "bonCommande");
  const [pleinEcran, setPleinEcran] = useState(false);
  const valider = useValiderPrefacture();
  const enregistrer = useEnregistrerPrix();
  const chiffrageTravaux = peutEcrireTerrain(roleEffectif);

  const l = lignesPourEnregistrement(lignes);
  const actifs = travaux.filter((t) => t.statut === "a_chiffrer" || t.statut === "chiffre");
  const saisis = travauxSaisis(actifs, saisies);
  const document = documentDirecteur(depuisLignesAEnregistrer(l.lignes), saisis.travaux, taches, connus, reglages.tvaDefaut);
  const dossier = { statutWorkflow: bon.statut_workflow, taches, travaux: saisis.travaux, lignes: l.lignes.map((x) => ({ type: x.type, designation: x.designation, prixUnitaire: x.prix_unitaire })) };
  const blocages = blocagesChiffrage(dossier);
  const horsCircuit = blocagesChiffrage(dossier, { horsCircuit: true });
  const contournement = blocages.length > 0 && horsCircuit.length === 0 && droits.peutFacturerHorsCircuit;
  const saisieValide = l.erreurs.length === 0 && Object.keys(saisis.erreurs).length === 0;
  const prix = chiffrageTravaux ? saisis.travaux.filter((t) => saisies[t.id] && t.prix_vente_ht !== null).map((t) => ({ id: t.id, prix: t.prix_vente_ht ?? 0, quantite: t.quantite ?? 1, unite: t.unite ?? "u" })) : [];
  const enCours = valider.isPending || enregistrer.isPending;
  const t = totauxDocument(document);

  function refus(e: unknown) {
    afficherToast(`Prix enregistrés, mais validation refusée : ${messageErreur(e)}`);
  }

  function lancer(horsCircuitDemande: boolean) {
    const doc = versLignesAEnregistrer(document);
    valider.mutate(
      { bonId: bon.id, statutWorkflow: bon.statut_workflow, lignes: doc, montant: montantAEnregistrer(doc, 0), prix, integres: saisis.travaux.filter((x) => x.statut === "chiffre").map((x) => x.id), horsCircuit: horsCircuitDemande },
      {
        onSuccess: () => {
          onFermer();
          afficherToast(horsCircuitDemande ? "Pré-facture validée hors circuit — le bon passe à « À facturer »." : "Pré-facture validée — le bon passe à « À facturer ».", "success", horsCircuitDemande ? DUREE_TOAST_HORS_CIRCUIT_MS : DUREE_TOAST_VALIDE_MS);
        },
        onError: refus,
      }
    );
  }

  function confirmerValidation() {
    // Un bon encore « en attente de BC » : la référence client serait figée vide sur la facture — on avertit, on ne refuse pas.
    if (bon.en_attente_bc && !window.confirm("Ce bon attend encore le numéro de commande du client.\n\nLa facture partira SANS cette référence, et ne pourra plus la recevoir : une fois la facture émise, ce champ est définitivement figé. Un bailleur ou une collectivité la refusera, et la corriger demandera un avoir.\n\nSaisissez le numéro sur le bon (bouton « ✓ BC reçu ») si vous l'avez reçu.\n\nValider quand même la pré-facture ?")) return;
    lancer(false);
  }

  function confirmerHorsCircuit() {
    if (!window.confirm(`Envoyer ce bon de commande en facturation SANS passer par le planning ?\n\n${bon.client_nom} — ${formatEuros(t.ttc)} TTC\n\nAucune tâche n'attestera des travaux. Le bon passera directement à « À facturer ».\nCe contournement est enregistré au journal de la base, avec votre nom.`)) return;
    lancer(true);
  }

  function enregistrerSansValider() {
    enregistrer.mutate({ bonId: bon.id, lignes: l.lignes, montant: montantAEnregistrer(l.lignes, 0), prix }, { onSuccess: () => { afficherToast("Prix enregistrés.", "success"); void onEnregistre(); }, onError: (e) => afficherToast(messageErreur(e)) });
  }

  const bouton = (cle: Exclude<Reference, null>, libelle: string) => (
    <button type="button" className={`btn small ${reference === cle ? "primary" : "ghost"}`} aria-pressed={reference === cle} onClick={() => setReference(reference === cle ? null : cle)}>{reference === cle ? "✓ " : ""}{libelle}</button>
  );
  const aLeDocument = !!bon.piece_jointe_chemin;
  const piece = reference === "bonClient" ? <BonDuClient bon={bon} classe="pf-reference-fichier" /> : <FicheInterne bon={bon} avecPrix={avecPrix} />;

  return (
    <MetiersConnus.Provider value={connus}>
      <div id="validationDirecteurCorps">
        <div style={{ display: "flex", gap: "14px", alignItems: "center", flexWrap: "wrap", marginBottom: "12px" }}>
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
            <span className="card-sub" style={{ alignSelf: "center" }}>Consulter :</span>
            {aLeDocument && bouton("bonClient", "📎 Bon du client")}
            {bouton("bonCommande", aLeDocument ? "🧾 Fiche interne" : "📄 Bon de commande")}
            {reference && <button type="button" className="btn small ghost" title="Lire le document en grand (Échap pour revenir)" onClick={() => setPleinEcran(true)}>🔎 Agrandir</button>}
          </div>
          <label className="bc-tache-row" style={{ margin: 0 }}>
            <input type="checkbox" checked={avecPrix} disabled={!prixVisibles} onChange={(e) => setAvecPrix(e.target.checked)} />
            <span>Afficher les prix{prixVisibles ? "" : " — masqués pour votre rôle"}</span>
          </label>
        </div>
        <div className="pf-colonnes">
          <div className="pf-travail">
            <div className="section-title" style={{ marginTop: 0 }}>💶 Les prix — chaque poste, commandé ou ajouté</div>
            <TableauPrefacture lignes={lignes} onLignes={setLignes} travaux={saisis.travaux} taches={taches} saisies={saisies} onSaisie={(id, s) => setSaisies((avant) => ({ ...avant, [id]: s }))} document={document} tvaDefaut={reglages.tvaDefaut} chiffrageTravaux={chiffrageTravaux} desactive={!droits.peutModifierPrefacture} />
            <BoiteTotaux id="validationDirecteurTotal" label="Totaux de la pré-facture" lignes={document} />
            <div className="section-title" style={{ marginTop: "18px" }}>💬 Ce que le terrain a rapporté</div>
            <ComptesRendus taches={taches} />
          </div>
          {reference && <div className="print-preview pf-reference">{piece}</div>}
        </div>
      </div>
      <div id="validationDirecteurPied" style={{ position: "sticky", bottom: 0, background: "var(--card,#fff)", padding: "14px 0 2px", borderTop: "1px solid var(--border,#E2E6ED)", marginTop: "18px" }}>
        <div id="validationDirecteurBlocages"><Blocages blocages={blocages} contournement={contournement} peutValider={droits.peutValiderPrefacture} /></div>
        <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
          {droits.peutValiderPrefacture && <button type="button" className="btn primary" disabled={enCours || !saisieValide || blocages.length > 0} onClick={confirmerValidation}>✓ Valider la pré-facture</button>}
          {contournement && <button type="button" className="btn" disabled={enCours || !saisieValide} onClick={confirmerHorsCircuit}>⏭️ Valider sans passer par le planning</button>}
          <button type="button" className="btn" disabled={enCours || !saisieValide} onClick={enregistrerSansValider}>💾 Enregistrer sans valider</button>
          <button type="button" className="btn ghost" onClick={onFermer}>Annuler</button>
        </div>
      </div>
      {pleinEcran && reference && (
        <PleinEcran titre={reference === "bonClient" ? bon.piece_jointe_nom || "Bon du client" : "Fiche interne du bon de commande"} onFermer={() => setPleinEcran(false)}>
          {reference === "bonClient" ? <BonDuClient bon={bon} classe="pf-plein-fichier" /> : <div className="print-preview"><FicheInterne bon={bon} avecPrix={avecPrix} /></div>}
        </PleinEcran>
      )}
    </MetiersConnus.Provider>
  );
}

/**
 * La pré-facture, dans la fenêtre de l'ancien (`#validationDirecteurModal`,
 * `openValidationDirecteurModal`) : « Pré-facture — BC … », le client, puis le
 * dossier une fois lu. Ouverte depuis la carte d'un bon, elle se referme sur
 * l'écran d'où l'on vient.
 */
export function ModalePrefacture({ bonId, onFermer }: { bonId: string; onFermer: () => void }) {
  const bon = useBon(bonId);
  const taches = useTaches(bonId);
  const travaux = useTravaux(bonId);
  const reglages = useReglages();
  const [generation, setGeneration] = useState(0);
  const titre = `Pré-facture — BC ${bon.data?.numero_interne || bon.data?.numero_bc || "sans numéro"}`;
  const erreur = bon.error ?? taches.error ?? travaux.error;
  const pret = bon.data && taches.data && travaux.data && !reglages.isPending;
  return (
    <Modale titre={titre} onFermer={onFermer} largeurMax="1240px">
      <p className="card-sub">{bon.data?.client_nom ?? ""}</p>
      {erreur ? (
        <div className="empty">Dossier indisponible : {messageErreur(erreur)}. La validation reste bloquée tant qu&apos;on ne peut pas contrôler l&apos;état des tâches.</div>
      ) : pret ? (
        <CorpsPrefacture
          key={generation}
          onEnregistre={async () => {
            await Promise.all([bon.refetch(), travaux.refetch()]);
            setGeneration((g) => g + 1);
          }}
          bon={bon.data} taches={taches.data} travaux={travaux.data.filter((x) => x.statut !== "integre")} reglages={reglages.data ?? REGLAGES_DEFAUT} onFermer={onFermer} />
      ) : (
        <div className="empty" data-chargement="oui">Chargement du dossier…</div>
      )}
    </Modale>
  );
}
