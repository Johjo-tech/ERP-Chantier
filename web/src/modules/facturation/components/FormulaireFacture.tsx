import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { todayISO } from "@/lib/dates";
import { messageErreur } from "@/lib/erreurs";
import { schemaNombreFr } from "@/lib/nombres";
import { useFormulaire } from "@/lib/useFormulaire";
import { usePermission } from "@/modules/auth-roles/hooks/useSession";
import { dateEcheance, delaiHorsPlafond, delaiPaiementRetenu, delaiPreregle, DELAIS_PREREGLES, libelleDelaiPaiement, MODES_REGLEMENT, type DelaiPaiement } from "@/modules/clients/domain/delais";
import { useClients, useInterlocuteurs } from "@/modules/clients/hooks/useClients";
import { LignesAncien } from "@/modules/documents/components/LignesAncien";
import { SectionLieuAncien } from "@/modules/documents/components/SectionLieuAncien";
import { TotauxAncien } from "@/modules/documents/components/TotauxAncien";
import type { ChampReferenceLigne } from "@/modules/documents/components/reference";
import { depuisBase, ligneVide, lignesPourEnregistrement, type ErreurLigne, type LigneEdition } from "@/modules/documents/domain/lignes";
import { estAvoir, totauxDocument } from "@/modules/documents/domain/totaux";
import { showToast } from "@/modules/documents/impression/zone";
import type { ReglagesDocuments } from "@/modules/societes/domain/reglages";
import { useConducteurs } from "@/modules/societes/hooks/useConducteurs";
import { FacturePartielle } from "../api/factures";
import { actionsFacture, refusGesteFacture } from "../domain/actions";
import { DUREE_AVIS } from "../domain/avis";
import { enteteAEnregistrer, schemaSaisieFacture, valeursDepuis, type Facture } from "../domain/facture";
import { verrouFacture } from "../domain/verrou";
import { useDroitsFacture, useFacturesEcran } from "../hooks/useEcranFactures";
import { useCadenas, useDupliquerFacture, useEnregistrerFacture } from "../hooks/useFactures";
import { ModaleAvoir } from "./ModalesFacture";

/** Le délai tel que la facture le porte : `null` tant qu'elle suit le client. */
function delaiDeLaFacture(f: Facture | null): DelaiPaiement | null {
  return f?.delai_paiement_jours != null ? { jours: f.delai_paiement_jours, mode: f.delai_paiement_mode ?? "net" } : null;
}
/** La clé de la liste (`optionsDelaiFactureHTML`) : un préréglage, « client », ou « autre » pour un délai hors liste. */
function cleDuDelai(d: DelaiPaiement | null): string {
  if (!d) return "client";
  return delaiPreregle(d)?.cle ?? "autre";
}
const heureCourte = () => new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

/**
 * Le formulaire d'une facture (`factureForm`, app.js l. 6037), dans le panneau
 * de l'ancien : « Client & contact », « Lieu & locataire », « Lignes »,
 * « Remise & totaux », puis la barre d'actions collée en bas. Une facture
 * émise s'y lit derrière un voile (la base la refuserait) ; son bandeau dit
 * pourquoi et propose l'avoir. L'émission se fait depuis la carte de la liste.
 */
export function FormulaireFacture({ facture, reglages, ChampReference }: { facture: Facture | null; reglages: ReglagesDocuments; ChampReference?: ChampReferenceLigne | undefined }) {
  const navigate = useNavigate();
  const clients = useClients();
  const conducteurs = useConducteurs();
  const factures = useFacturesEcran();
  const droits = useDroitsFacture();
  const peutCreer = usePermission("factures", "creer");
  const peutModifier = usePermission("factures", "modifier");
  const enregistrer = useEnregistrerFacture(facture?.id);
  const dupliquer = useDupliquerFacture();
  const { lever } = useCadenas(facture?.id ?? "");
  const [avoirOuvert, setAvoirOuvert] = useState(false);
  const [horodatage, setHorodatage] = useState("");

  const verrou = facture ? verrouFacture(facture) : null;
  const emise = verrou?.code === "emise";
  const verrouillee = verrou?.code === "telechargee";
  // Trois raisons de ne pas écrire, un seul voile : émise, verrouillée, ou un rôle en lecture.
  const peutEcrire = facture ? actionsFacture(facture, droits).peutModifier : peutCreer;
  const unAvoir = estAvoir(facture?.type_document);
  const rectifiee = facture?.facture_rectifiee_id ? (factures.data ?? []).find((f) => f.id === facture.facture_rectifiee_id) : undefined;

  const { valeurs, changer } = useFormulaire(valeursDepuis(facture, todayISO()));
  const [lignes, setLignes] = useState<LigneEdition[]>(() => (facture?.lignes.length ? facture.lignes.map(depuisBase) : [ligneVide(reglages.tvaDefaut)]));
  const [erreursLignes, setErreursLignes] = useState<ErreurLigne[]>([]);
  const [cleDelai, setCleDelai] = useState(() => cleDuDelai(delaiDeLaFacture(facture)));
  // Une échéance déjà posée est tenue pour saisie ; une facture neuve part calculée (`appliquerDelaiPaiement`).
  const [echeance, setEcheance] = useState({ valeur: facture?.echeance ?? "", auto: !facture?.echeance, aide: !facture?.echeance });
  const client = (clients.data ?? []).find((c) => c.id === valeurs.client_id) ?? null;
  const interlocuteurs = useInterlocuteurs(valeurs.client_id);
  const [mode, setMode] = useState(() => (facture?.mode_paiement ?? "").trim() || "virement");

  const delaiSaisi = (): DelaiPaiement => {
    const preregle = DELAIS_PREREGLES.find((d) => d.cle === cleDelai);
    if (preregle) return preregle;
    if (cleDelai === "autre") return delaiDeLaFacture(facture) ?? delaiPaiementRetenu(client, { delai_paiement_jours: reglages.delaiPaiementJours, delai_paiement_mode: reglages.modeDelaiPaiement });
    return delaiPaiementRetenu(client, { delai_paiement_jours: reglages.delaiPaiementJours, delai_paiement_mode: reglages.modeDelaiPaiement });
  };
  const delai = delaiSaisi();
  const echeanceCalculee = dateEcheance(valeurs.date || todayISO(), delai);
  const echeanceAffichee = echeance.auto ? echeanceCalculee : echeance.valeur;
  const hors = delaiHorsPlafond(delai);

  // L'ancien faisait défiler jusqu'au formulaire à l'ouverture (`editItem`).
  useEffect(() => {
    document.getElementById("formZoneFacture")?.scrollIntoView?.({ behavior: "smooth", block: "start" });
  }, []);

  function changerClient(id: string) {
    changer("client_id", id);
    changer("interlocuteur", "");
    // Changer de client reprend SES conditions, tant que la facture suit le client (`reprendreConditionsDuClient`).
    const c = (clients.data ?? []).find((x) => x.id === id);
    if (cleDelai === "client") setMode((c?.mode_paiement ?? "").trim() || "virement");
  }

  async function sauver(brouillon: boolean) {
    if (facture) {
      const refus = refusGesteFacture("modifier", facture, droits);
      if (refus) {
        showToast(refus, "danger", DUREE_AVIS.refus);
        return;
      }
    }
    if (!valeurs.client_id || !client) {
      window.alert("Le nom du client est requis.");
      return;
    }
    const saisie = schemaSaisieFacture.safeParse({ ...valeurs, chantier_id: facture?.chantier_id ?? valeurs.chantier_id });
    const remise = schemaNombreFr.safeParse(valeurs.remise_pourcentage || "0");
    const l = lignesPourEnregistrement(lignes);
    setErreursLignes(l.erreurs);
    if (!saisie.success || !remise.success || l.erreurs.length) {
      showToast(l.erreurs[0]?.message ?? "La facture contient des erreurs : corrigez les champs signalés.", "danger", DUREE_AVIS.refus);
      return;
    }
    const entete = enteteAEnregistrer({ ...saisie.data, mode_paiement: mode as typeof saisie.data.mode_paiement }, client, Math.min(100, Math.max(0, remise.data)), delai, libelleDelaiPaiement(delai), echeanceAffichee || null);
    try {
      const id = await enregistrer.mutateAsync({ entete, lignes: l.lignes });
      if (!brouillon) {
        void navigate("/factures");
        return;
      }
      // L'identifiant est posé sur la saisie en cours : sans lui, le prochain enregistrement créerait une seconde facture.
      setHorodatage(`Brouillon enregistré à ${heureCourte()}`);
      showToast("Brouillon enregistré.", "success", DUREE_AVIS.texteCopie);
      if (!facture) void navigate(`/factures/${id}`, { replace: true });
    } catch (err) {
      if (err instanceof FacturePartielle && !facture) void navigate(`/factures/${err.factureId}`, { replace: true });
      showToast(`Enregistrement refusé : ${messageErreur(err)}`, "danger", DUREE_AVIS.refus);
    }
  }

  function deverrouiller() {
    if (!window.confirm("Cette facture a déjà été téléchargée ou envoyée. Confirmez-vous vouloir la déverrouiller pour la modifier ?\n\nAttention : si le client a déjà reçu une version, pensez à lui renvoyer la version corrigée.")) return;
    lever.mutate(undefined, { onError: (err) => showToast(messageErreur(err), "danger", DUREE_AVIS.refus) });
  }

  const nomsClients = [...(clients.data ?? [])].sort((a, b) => a.nom.localeCompare(b.nom));
  const clientConnu = !valeurs.client_id || nomsClients.some((c) => c.id === valeurs.client_id);
  const listeInterlocuteurs = interlocuteurs.data ?? [];
  const conducteursProposes = (conducteurs.data ?? []).filter((c) => c.actif || c.id === valeurs.conducteur_id).sort((a, b) => a.nom.localeCompare(b.nom));
  const titre = facture ? (emise ? `${unAvoir ? "Avoir " : "Facture "}${facture.numero ?? ""}` : "Modifier la facture") : "Nouvelle facture";
  const ttc = totauxDocument(lignes.map((l) => ({ type: l.type, quantite: l.quantite, prix_unitaire: l.prix_unitaire, tva: l.tva })), valeurs.remise_pourcentage).ttc;

  return (
    <div className="form-panel">
      <h3>{titre}</h3>
      {emise && verrou && (
        <div className="facture-verrou-banner">
          <span>🔒 {verrou.libelle}</span>
          <span style={{ fontWeight: 400 }}>L'encaissement s'enregistre dans l'onglet <b>Règlements</b>.</span>
          {!unAvoir && <button type="button" className="btn small" onClick={() => setAvoirOuvert(true)} title="Rectifier cette facture par un avoir">↩ Établir un avoir</button>}
        </div>
      )}
      {verrouillee && verrou && (
        <div className="facture-verrou-banner">
          <span>🔒 {verrou.libelle}</span>
          {peutModifier && <button type="button" className="btn small danger" onClick={deverrouiller}>🔓 Déverrouiller pour modifier</button>}
        </div>
      )}
      {unAvoir && rectifiee && (
        <div className="numref" style={{ marginBottom: "10px" }}>
          Rectifie la facture {rectifiee.numero} du {rectifiee.date.split("-").reverse().join("/")}{facture?.motif_rectification ? ` — ${facture.motif_rectification}` : ""}
        </div>
      )}
      <div style={peutEcrire ? undefined : { pointerEvents: "none", opacity: 0.55 }} aria-disabled={!peutEcrire}>
        {facture?.devis_id && <div className="numref" style={{ marginBottom: "10px" }}>Générée à partir d'un devis</div>}
        {facture?.intervention_id && <div className="numref" style={{ marginBottom: "10px" }}>Issue d'un rapport d'intervention</div>}
        <div className="form-section">
          <div className="form-section-head">Client &amp; contact</div>
          <div className="field-grid">
            <div className="field">
              <label htmlFor="f_client">Client</label>
              <select id="f_client" value={valeurs.client_id} onChange={(e) => changerClient(e.target.value)}>
                <option value="">— Sélectionner un client —</option>
                {!clientConnu && facture && <option value={valeurs.client_id}>{`${facture.client_nom} — hors répertoire`}</option>}
                {nomsClients.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="f_interlocuteur">Interlocuteur</label>
              <select id="f_interlocuteur" value={valeurs.interlocuteur} onChange={(e) => changer("interlocuteur", e.target.value)}>
                <option value="">— Aucun —</option>
                {valeurs.interlocuteur && !listeInterlocuteurs.some((i) => i.nom === valeurs.interlocuteur) && <option value={valeurs.interlocuteur}>{`${valeurs.interlocuteur} — hors répertoire`}</option>}
                {listeInterlocuteurs.map((i) => <option key={i.id} value={i.nom}>{`${i.nom}${i.fonction ? ` (${i.fonction})` : ""}`}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="f_date">Date</label>
              <input type="date" id="f_date" value={valeurs.date} onChange={(e) => changer("date", e.target.value)} />
            </div>
            {/* Le délai est recopié du client À LA CRÉATION puis figé ; il reste modifiable tant que la facture ne l'est pas. */}
            <div className="field">
              <label htmlFor="f_delaiPreset">Délai de paiement</label>
              <select id="f_delaiPreset" value={cleDelai} onChange={(e) => { setCleDelai(e.target.value); setEcheance((x) => ({ ...x, auto: true, aide: true })); }}>
                <option value="client">Conditions du client</option>
                {DELAIS_PREREGLES.map((d) => <option key={d.cle} value={d.cle}>{d.libelle}</option>)}
                {cleDelai === "autre" && <option value="autre">{libelleDelaiPaiement(delai)}</option>}
              </select>
            </div>
            <div className="field">
              <label htmlFor="f_modePaiement">Mode de règlement</label>
              <select id="f_modePaiement" value={mode} onChange={(e) => setMode(e.target.value)}>
                {MODES_REGLEMENT.map((m) => <option key={m.code} value={m.code}>{m.libelle}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="f_echeance">
                Échéance{" "}
                <button type="button" className="btn small ghost" style={{ padding: "0 6px" }} onClick={() => setEcheance((x) => ({ ...x, auto: true, aide: true }))} title="Recalculer d'après le délai">↻</button>
              </label>
              <input type="date" id="f_echeance" value={echeanceAffichee} onChange={(e) => setEcheance({ valeur: e.target.value, auto: false, aide: echeance.aide })} />
              <small id="f_echeanceAide" className="card-sub" style={hors && echeance.auto && echeance.aide ? { color: "var(--danger)" } : undefined}>
                {echeance.auto && echeance.aide ? `${libelleDelaiPaiement(delai)}${hors ? ` — ${hors}` : ""}` : ""}
              </small>
            </div>
            <div className="field">
              <label htmlFor="f_conducteur">Conducteur de travaux</label>
              <select id="f_conducteur" value={valeurs.conducteur_id} onChange={(e) => changer("conducteur_id", e.target.value)}>
                <option value="">— Non attribué —</option>
                {conducteursProposes.map((c) => <option key={c.id} value={c.id}>{`${c.nom}${c.actif ? "" : " (retiré)"}`}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="f_dateFinExecution">Travaux achevés le <small className="card-sub">(si différent de la date)</small></label>
              <input type="date" id="f_dateFinExecution" value={valeurs.date_fin_execution} onChange={(e) => changer("date_fin_execution", e.target.value)} />
            </div>
            {/* BT-13 : la référence que l'acheteur rapproche — visible, vérifiable, corrigeable. */}
            <div className="field">
              <label htmlFor="f_refBonCommandeClient">N° de bon de commande du client</label>
              <input type="text" id="f_refBonCommandeClient" value={valeurs.ref_bon_commande_client} placeholder="La référence que le client rapprochera" onChange={(e) => changer("ref_bon_commande_client", e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="f_refMarche">N° de marché</label>
              <input type="text" id="f_refMarche" value={valeurs.ref_marche} placeholder="Lorsqu'il en existe un" onChange={(e) => changer("ref_marche", e.target.value)} />
            </div>
          </div>
        </div>
        <SectionLieuAncien valeurs={valeurs} changer={changer} suffixe="Facture" avecTelephone={false} />
        <div className="form-section">
          <div className="form-section-head">Lignes</div>
          <LignesAncien lignes={lignes} onChange={setLignes} tvaDefaut={reglages.tvaDefaut} taux={reglages.tauxTva} erreurs={erreursLignes} ChampReference={ChampReference} />
        </div>
        <div className="form-section">
          <div className="form-section-head">Remise &amp; totaux</div>
          <TotauxAncien lignes={lignes} remise={valeurs.remise_pourcentage} onRemise={(v) => changer("remise_pourcentage", v)} />
        </div>
      </div>
      <div className="form-actions-sticky">
        {emise ? (
          <>
            {facture && actionsFacture(facture, droits).peutDupliquer && (
              <button type="button" className="btn primary" disabled={dupliquer.isPending} onClick={() => dupliquer.mutate(facture.id, { onSuccess: (id) => { showToast("Copie créée en brouillon — elle recevra son numéro à l'émission.", "success", DUREE_AVIS.copieCreee); void navigate(`/factures/${id}`); }, onError: (err) => showToast(messageErreur(err), "danger", DUREE_AVIS.echec) })} title="Repartir de cette facture pour en établir une nouvelle, en brouillon">⧉ Dupliquer</button>
            )}
            <button type="button" className="btn ghost" onClick={() => void navigate("/factures")}>Fermer</button>
          </>
        ) : peutEcrire ? (
          <>
            <button type="button" className="btn primary" disabled={enregistrer.isPending} onClick={() => void sauver(false)}>Enregistrer la facture</button>
            <button type="button" className="btn" disabled={enregistrer.isPending} onClick={() => void sauver(true)} title="Garder la saisie en cours sans refermer, et sans attribuer de numéro">💾 Enregistrer le brouillon</button>
            <button type="button" className="btn ghost" onClick={() => void navigate("/factures")}>Annuler</button>
            <span id="brouillonHorodatage" className="card-sub horodatage-brouillon" style={{ marginLeft: "auto", alignSelf: "center" }}>{horodatage}</span>
          </>
        ) : (
          <button type="button" className="btn ghost" onClick={() => void navigate("/factures")}>Fermer</button>
        )}
      </div>
      {avoirOuvert && facture && <ModaleAvoir facture={facture} ttc={ttc} fermer={() => setAvoirOuvert(false)} etabli={() => void navigate("/factures/avoirs")} />}
    </div>
  );
}
