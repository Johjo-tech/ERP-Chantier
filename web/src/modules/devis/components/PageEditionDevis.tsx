import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { Chargement, Erreur } from "@/components/etats/Etats";
import { todayISO } from "@/lib/dates";
import { messageErreur } from "@/lib/erreurs";
import { schemaNombreFr } from "@/lib/nombres";
import { useFormulaire } from "@/lib/useFormulaire";
import { usePermission } from "@/modules/auth-roles/hooks/useSession";
import { useClients, useInterlocuteurs } from "@/modules/clients/hooks/useClients";
import { LignesAncien } from "@/modules/documents/components/LignesAncien";
import { SectionLieuAncien } from "@/modules/documents/components/SectionLieuAncien";
import { TotauxAncien } from "@/modules/documents/components/TotauxAncien";
import type { ChampReferenceLigne } from "@/modules/documents/components/reference";
import { depuisBase, ligneVide, lignesPourEnregistrement, type ErreurLigne, type LigneEdition } from "@/modules/documents/domain/lignes";
import { showToast } from "@/modules/documents/impression/zone";
import { DUREE_AVIS } from "@/modules/facturation/domain/avis";
import { REGLAGES_DEFAUT, type ReglagesDocuments } from "@/modules/societes/domain/reglages";
import { useConducteurs } from "@/modules/societes/hooks/useConducteurs";
import { useReglages } from "@/modules/societes/hooks/useReglages";
import { EnregistrementPartiel } from "../api/devis";
import { enteteAEnregistrer, LIBELLES_STATUT, schemaSaisieDevis, STATUTS_DEVIS, valeursDepuis, type Devis } from "../domain/devis";
import { conducteurIdDe } from "../domain/liste";
import { useDevis, useEnregistrerDevis } from "../hooks/useDevis";

const heureCourte = () => new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

/**
 * L'écran d'un devis, tel que l'ancien l'ouvrait (`renderDevis` avec
 * `formOpen.devis`) : « Devis » sans son bouton, puis le formulaire à la place
 * de la liste. Les gestes du devis (PDF, e-mail, facture, bon) vivent sur sa
 * carte, comme dans l'ancien.
 */
export function PageEditionDevis({ ChampReference }: { ChampReference?: ChampReferenceLigne }) {
  const { id } = useParams();
  const devis = useDevis(id);
  const reglages = useReglages();
  // L'annuaire des conducteurs d'abord : un ancien devis n'a que le NOM du sien (DEV-26).
  const conducteurs = useConducteurs();
  const cadre = (contenu: React.ReactNode) => (
    <>
      <div className="page-head"><h1>Devis</h1></div>
      <div id="formZoneDevis">{contenu}</div>
    </>
  );
  if ((id && devis.isPending) || reglages.isPending || conducteurs.isPending) return cadre(<Chargement />);
  if (id && devis.isError) return cadre(<Erreur erreur={devis.error} reessayer={() => void devis.refetch()} />);
  const d = devis.data ?? null;
  const avecConducteur = d && !d.conducteur_id ? { ...d, conducteur_id: conducteurIdDe(d, conducteurs.data ?? []) || null } : d;
  return cadre(<FormulaireDevis key={id ?? "nouveau"} devis={avecConducteur} reglages={reglages.data ?? REGLAGES_DEFAUT} ChampReference={ChampReference} />);
}

/**
 * Le formulaire d'un devis (`devisForm`, app.js l. 4625) : « Client &
 * contact », « Lieu & locataire », « Lignes », « Remise & totaux », puis la
 * barre collée — « Enregistrer le devis » referme, « 💾 Enregistrer le
 * brouillon » garde la saisie ouverte. Le numéro est attribué par la base à la
 * première écriture.
 */
function FormulaireDevis({ devis, reglages, ChampReference }: { devis: Devis | null; reglages: ReglagesDocuments; ChampReference?: ChampReferenceLigne | undefined }) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const clients = useClients();
  const conducteurs = useConducteurs();
  const enregistrer = useEnregistrerDevis(devis?.id);
  const peutEcrire = usePermission("devis", devis ? "modifier" : "creer");
  const { valeurs, changer } = useFormulaire({
    ...valeursDepuis(devis, todayISO(), params.get("chantier") ?? "", params.get("client") ?? ""),
    // Un devis complémentaire créé depuis la fiche chantier reprend son lieu (CHA-13).
    ...(!devis && params.get("chantier") ? { adresse_locataire: params.get("adresse") ?? "", code_postal: params.get("cp") ?? "", ville: params.get("ville") ?? "" } : {}),
  });
  const [lignes, setLignes] = useState<LigneEdition[]>(() => (devis?.lignes.length ? devis.lignes.map(depuisBase) : [ligneVide(reglages.tvaDefaut)]));
  const [erreursLignes, setErreursLignes] = useState<ErreurLigne[]>([]);
  const [horodatage, setHorodatage] = useState("");
  const interlocuteurs = useInterlocuteurs(valeurs.client_id);

  useEffect(() => {
    document.getElementById("formZoneDevis")?.scrollIntoView?.({ behavior: "smooth", block: "start" });
  }, []);

  async function sauver(brouillon: boolean) {
    const client = (clients.data ?? []).find((c) => c.id === valeurs.client_id);
    if (!valeurs.client_id || !client) {
      window.alert("Le nom du client est requis.");
      return;
    }
    const saisie = schemaSaisieDevis.safeParse(valeurs);
    const remise = schemaNombreFr.safeParse(valeurs.remise_pourcentage || "0");
    const l = lignesPourEnregistrement(lignes);
    setErreursLignes(l.erreurs);
    if (!saisie.success || !remise.success || l.erreurs.length) {
      showToast(l.erreurs[0]?.message ?? "Le devis contient des erreurs : corrigez les champs signalés.", "danger", DUREE_AVIS.refus);
      return;
    }
    try {
      const id = await enregistrer.mutateAsync({
        entete: enteteAEnregistrer(saisie.data, client, Math.min(100, Math.max(0, remise.data))),
        lignes: l.lignes,
        // Un devis ancien portait parfois le NOM du conducteur sans sa fiche : on le garde (DEV-26).
        conducteurHistorique: devis && !devis.conducteur_id ? devis.conducteur : null,
      });
      if (!brouillon) {
        void navigate("/devis");
        return;
      }
      setHorodatage(`Brouillon enregistré à ${heureCourte()}`);
      showToast("Brouillon enregistré.", "success", DUREE_AVIS.texteCopie);
      if (!devis) void navigate(`/devis/${id}`, { replace: true });
    } catch (err) {
      if (err instanceof EnregistrementPartiel && !devis) void navigate(`/devis/${err.devisId}`, { replace: true });
      showToast(`Enregistrement refusé : ${messageErreur(err)}`, "danger", DUREE_AVIS.refus);
    }
  }

  const nomsClients = [...(clients.data ?? [])].sort((a, b) => a.nom.localeCompare(b.nom));
  const clientConnu = !valeurs.client_id || nomsClients.some((c) => c.id === valeurs.client_id);
  const liste = interlocuteurs.data ?? [];
  const conducteursProposes = (conducteurs.data ?? []).filter((c) => c.actif || c.id === valeurs.conducteur_id).sort((a, b) => a.nom.localeCompare(b.nom));

  return (
    <div className="form-panel">
      <h3>{devis ? "Modifier le devis" : "Nouveau devis"}</h3>
      {devis?.intervention_id && <div className="numref" style={{ marginBottom: "10px" }}>Issu d'un rapport d'intervention</div>}
      <div style={peutEcrire ? undefined : { pointerEvents: "none", opacity: 0.55 }} aria-disabled={!peutEcrire}>
        <div className="form-section">
          <div className="form-section-head">Client &amp; contact</div>
          <div className="field-grid">
            <div className="field">
              <label htmlFor="f_client">Client</label>
              <select id="f_client" value={valeurs.client_id} onChange={(e) => { changer("client_id", e.target.value); changer("interlocuteur", ""); }}>
                <option value="">— Sélectionner un client —</option>
                {!clientConnu && devis && <option value={valeurs.client_id}>{`${devis.client_nom} — hors répertoire`}</option>}
                {nomsClients.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="f_interlocuteur">Interlocuteur</label>
              <select id="f_interlocuteur" value={valeurs.interlocuteur} onChange={(e) => changer("interlocuteur", e.target.value)}>
                <option value="">— Aucun —</option>
                {valeurs.interlocuteur && !liste.some((i) => i.nom === valeurs.interlocuteur) && <option value={valeurs.interlocuteur}>{`${valeurs.interlocuteur} — hors répertoire`}</option>}
                {liste.map((i) => <option key={i.id} value={i.nom}>{`${i.nom}${i.fonction ? ` (${i.fonction})` : ""}`}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="f_date">Date</label>
              <input type="date" id="f_date" value={valeurs.date} onChange={(e) => changer("date", e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="f_conducteur">Conducteur de travaux</label>
              <select id="f_conducteur" value={valeurs.conducteur_id} onChange={(e) => changer("conducteur_id", e.target.value)}>
                <option value="">— Non attribué —</option>
                {conducteursProposes.map((c) => <option key={c.id} value={c.id}>{`${c.nom}${c.actif ? "" : " (retiré)"}`}</option>)}
              </select>
            </div>
            {/* L'ancien n'offrait aucun moyen de changer le statut d'un devis ; il se change ici (D-ECR-FAC-10). */}
            {devis && (
              <div className="field">
                <label htmlFor="f_statut">Statut</label>
                <select id="f_statut" value={valeurs.statut} onChange={(e) => changer("statut", e.target.value)}>
                  {STATUTS_DEVIS.map((s) => <option key={s} value={s}>{LIBELLES_STATUT[s]}</option>)}
                </select>
              </div>
            )}
          </div>
        </div>
        <SectionLieuAncien valeurs={valeurs} changer={changer} suffixe="Devis" avecTelephone />
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
        {peutEcrire ? (
          <>
            <button type="button" className="btn primary" disabled={enregistrer.isPending} onClick={() => void sauver(false)}>Enregistrer le devis</button>
            <button type="button" className="btn" disabled={enregistrer.isPending} onClick={() => void sauver(true)} title="Garder la saisie en cours sans refermer">💾 Enregistrer le brouillon</button>
            <button type="button" className="btn ghost" onClick={() => void navigate("/devis")}>Annuler</button>
            <span id="brouillonHorodatage" className="card-sub horodatage-brouillon" style={{ marginLeft: "auto", alignSelf: "center" }}>{horodatage}</span>
          </>
        ) : (
          <button type="button" className="btn ghost" onClick={() => void navigate("/devis")}>Fermer</button>
        )}
      </div>
    </div>
  );
}
