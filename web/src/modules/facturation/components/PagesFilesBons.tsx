import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { Chargement, Erreur } from "@/components/etats/Etats";
import { montant } from "@/lib/money";
import { formatEurosEcran, useModeDiscret } from "@/lib/modeDiscret";
import { useEntreeDefile, useRechercheDifferee } from "@/lib/useRecherche";
import { useSession, useVoitLesPrix } from "@/modules/auth-roles/hooks/useSession";
import { actionsFacturation } from "@/modules/auth-roles/domain/actions";
import type { BonDeLaListe } from "@/modules/commandes/api/bons";
import { BadgeEtape } from "@/modules/commandes/components/BadgeEtape";
import { aFacturer, fileValidation } from "@/modules/commandes/domain/files";
import { metiersDuBon } from "@/modules/commandes/domain/metiers";
import { useBons, useGenererFacture } from "@/modules/commandes/hooks/useBons";
import { showToast } from "@/modules/documents/impression/zone";
import { messageErreur } from "@/lib/erreurs";
import { DUREE_AVIS } from "../domain/avis";
import { avecVille, badgeLogement, classeStatut } from "../domain/carte";
import { criteresDeLaVue, filtrageActif, grouperParClient, retenu, type DocumentFiltrable } from "../domain/filtresEcran";
import { useCroisement } from "../hooks/useCroisement";
import { useFiltresFacturation } from "../hooks/useEcranFactures";
import { BarreFiltresFactures } from "./BarreFiltresFactures";
import { OngletsFacturation } from "./OngletsFacturation";

type File = "validation" | "afacturer";

const TEXTES: Record<File, { chapeau: string; vide: string }> = {
  validation: { chapeau: "Bons de commande validés par le conducteur de travaux, en attente de validation par le directeur.", vide: "Aucun bon de commande en attente de validation." },
  afacturer: { chapeau: "Bons de commande validés par le directeur — à facturer et envoyer au client.", vide: "Aucun bon de commande à facturer." },
};

/** Un bon tel que la barre de filtres le lit (`contexteBonCommande`) : ses champs, ses montants, ses métiers. */
function filtrable(b: BonDeLaListe, apports: readonly { valeur: string }[]): DocumentFiltrable & { client: string } {
  return {
    client: b.client_nom,
    interlocuteur: b.interlocuteur,
    conducteur: b.conducteur,
    logement: b.logement_statut,
    date: b.date_reception ?? b.date,
    metiers: metiersDuBon(b),
    cherchable: [b.client_nom, b.numero_bc, b.numero_interne, b.numero_logement, b.adresse, b.adresse_locataire, b.code_postal, b.ville, b.occupant, b.interlocuteur, b.ancien_locataire, b.precision_commune, b.etage, b.statut, b.conducteur, b.nature_travaux, b.reference_chantier, b.notes, b.probleme_description, b.date, b.date_reception, ...apports.map((a) => a.valeur)],
  };
}

/**
 * Facturation › Validation et › À facturer (`renderFactures` +
 * `renderDossiersClients`, app.js l. 5708) : les bons rangés en DOSSIERS par
 * client, fermés par défaut, un seul ouvert à la fois — tous ouverts pendant
 * une recherche, où un dossier fermé cacherait ce qu'on cherche.
 */
function PageFile({ file }: { file: File }) {
  useModeDiscret();
  const bons = useBons();
  const croisement = useCroisement();
  const [filtres, changer] = useFiltresFacturation();
  const saisie = useRechercheDifferee(filtres.recherche, (q) => changer({ recherche: q }));
  const [ouvert, setOuvert] = useState<string | null>(null);
  const criteres = criteresDeLaVue(filtres, file);
  const actif = filtrageActif(criteres);
  const tous = bons.data ?? [];
  const liste = file === "validation" ? fileValidation(tous).map((x) => ({ bon: x.bon, attente: x.attente, enCours: x.etape === "travaux_en_cours" })) : aFacturer(tous).map((bon) => ({ bon, attente: null, enCours: false }));
  const retenus = liste.map((x) => ({ ...x, ...filtrable(x.bon, croisement.apportsBon(x.bon)) })).filter((x) => retenu(x, criteres));
  const defile = useEntreeDefile("bonCommande-card", retenus.map((x) => x.bon.id), criteres.recherche, saisie);
  const groupes = grouperParClient(retenus);

  const contenu = () => {
    if (!liste.length) return <div className="empty">{TEXTES[file].vide}</div>;
    // Une file non vide dont rien ne correspond n'est pas une file vide : les confondre ferait croire qu'il n'y a plus rien à traiter.
    if (!retenus.length) return <div className="empty">Aucun bon de commande ne correspond à votre recherche.</div>;
    return (
      <>
        {actif && <div className="card-sub" style={{ marginBottom: "10px" }}>{`${retenus.length} bon${retenus.length > 1 ? "s" : ""} de commande · ${groupes.length} client${groupes.length > 1 ? "s" : ""}`}</div>}
        {groupes.map(({ client, documents }) => {
          const cle = `dossier:${file}:${client}`;
          const estOuvert = actif || ouvert === cle;
          const enCours = file === "validation" ? documents.filter((d) => d.enCours).length : 0;
          return (
            <div key={cle} className="dossier-client">
              <div className="dossier-header" role="button" tabIndex={0} aria-expanded={estOuvert} onClick={() => setOuvert(ouvert === cle ? null : cle)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOuvert(ouvert === cle ? null : cle); } }}>
                <span className="dossier-icon">{estOuvert ? "📂" : "📁"}</span>
                <span className="dossier-nom">{client}</span>
                <span className="dossier-badge">{documents.length}</span>
                {enCours > 0 && <span className="dossier-attente" title="Travaux non terminés — pas encore chiffrables">⏳ {enCours}</span>}
                {!estOuvert && <span className="dossier-apercu">{documents.map((d) => d.bon.numero_bc).filter(Boolean).join(", ")}</span>}
                <span className="dossier-chevron">{estOuvert ? "▲" : "▼"}</span>
              </div>
              {estOuvert && (
                <div className="dossier-contenu">
                  {documents.map((d) => <CarteBonFile key={d.bon.id} bon={d.bon} attente={d.attente} file={file} enEvidence={defile.enEvidence === d.bon.id} />)}
                </div>
              )}
            </div>
          );
        })}
      </>
    );
  };

  return (
    <>
      <OngletsFacturation />
      <div className="page-head"><h1>Factures</h1></div>
      <BarreFiltresFactures vue={file} filtres={filtres} changer={changer} saisie={saisie.saisie} onSaisie={saisie.setSaisie} onEntree={defile.surTouche} />
      <div className="card-sub" style={{ marginBottom: "14px" }}>{TEXTES[file].chapeau}</div>
      <div id="facturesWorkflowZone">
        {bons.isPending && <Chargement />}
        {bons.isError && <Erreur erreur={bons.error} reessayer={() => void bons.refetch()} />}
        {bons.isSuccess && contenu()}
      </div>
    </>
  );
}

/**
 * La carte d'un bon dans un dossier, REPLIÉE comme l'ancien la dessine
 * (`bonCommandeCardHTML`, app.js l. 6914) : l'identité, le montant et les
 * pastilles, puis les gestes de la file — la pré-facture, « Créer la
 * facture ». Le détail et les autres gestes vivent sur la fiche du bon, où le
 * chevron mène (D-ECR-FAC-04).
 */
function CarteBonFile({ bon, attente, file, enEvidence }: { bon: BonDeLaListe; attente: string | null; file: File; enEvidence: boolean }) {
  useModeDiscret();
  const navigate = useNavigate();
  const prix = useVoitLesPrix();
  const { roleEffectif } = useSession();
  const generer = useGenererFacture();
  const facturee = bon.factures.length > 0;
  const sav = !!bon.bon_commande_parent_id;
  const logement = badgeLogement(bon.logement_statut);
  const chiffrage = prix && !facturee && bon.statut_workflow !== "cloture_gratuit" && !sav && actionsFacturation(roleEffectif).peutModifierPrefacture;
  const creer = () =>
    generer.mutate(bon.id, {
      onSuccess: (id) => void navigate(`/factures/${id}`),
      onError: (err) => showToast(messageErreur(err), "danger", DUREE_AVIS.refus),
    });
  return (
    <div className={`card bc-card${enEvidence ? " search-focus" : ""}`} id={`bonCommande-card-${bon.id}`} data-wf={file}>
      <div className="bc-tete">
        <Link className="bc-chevron" to={`/commandes/${bon.id}`} title="Tout afficher" aria-expanded={false}>▸</Link>
        <div className="bc-ident">
          <div className="card-title">
            {bon.client_nom}
            {sav && <> <span className="badge warn" style={{ marginLeft: "6px" }}>SAV</span></>}
            {facturee && <> <span className="badge success" style={{ marginLeft: "6px" }}>🔒 Facturé</span></>}
          </div>
          <div className="card-sub">
            <span className="numref-lg" style={{ whiteSpace: "pre-line" }}>{bon.numero_bc ?? ""}</span>
            {bon.conducteur ? ` · 🦺 ${bon.conducteur}` : ""}
          </div>
          <div className="card-sub">{avecVille(bon.adresse, bon.code_postal, bon.ville)}</div>
          {file === "validation" && attente && <div className="attente-chiffrage">⏳ {attente}</div>}
        </div>
        <div className="bc-etat">
          <div className="amount">{bon.montant === null ? "" : formatEurosEcran(montant(bon.montant))}</div>
          <div className="bc-etat-badges">
            {logement && <span className={`badge ${logement.classe}`}>{logement.libelle}</span>}
            {!sav && <BadgeEtape bon={bon} />}
            <span className={`badge ${classeStatut(bon.statut)}`}>{bon.statut ?? ""}</span>
          </div>
        </div>
      </div>
      <div className="bc-actions-bas">
        {chiffrage && <Link className="btn small primary" to={`/commandes/${bon.id}/prefacture`}>🧾 Ouvrir la pré-facture</Link>}
        <Link className="btn small" to={`/commandes/${bon.id}`}>{facturee ? "👁 Consulter" : "Modifier"}</Link>
        {!facturee && !sav && (bon.circuit.valideDirecteur ? (
          <button type="button" className="btn small primary" disabled={generer.isPending} onClick={creer}>🧾 Créer la facture</button>
        ) : (
          <button type="button" className="btn small" disabled title="La pré-facture doit être validée avant de facturer">🧾 Créer la facture</button>
        ))}
      </div>
    </div>
  );
}

export const PageValidation = () => <PageFile file="validation" />;
export const PageAFacturer = () => <PageFile file="afacturer" />;
