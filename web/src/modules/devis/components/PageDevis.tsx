import { useCallback, useMemo, useState, type MouseEvent } from "react";
import { Link, useNavigate } from "react-router";
import { Chargement, Erreur } from "@/components/etats/Etats";
import { formatDateFr } from "@/lib/dates";
import { messageErreur } from "@/lib/erreurs";
import { montant, type Montant } from "@/lib/money";
import { formatEurosEcran, useModeDiscret } from "@/lib/modeDiscret";
import { montantsCherchables } from "@/lib/recherche";
import { useFiltresAdresse } from "@/lib/useFiltresAdresse";
import { useEntreeDefile, useRechercheDifferee } from "@/lib/useRecherche";
import { usePermission, useSocieteActive } from "@/modules/auth-roles/hooks/useSession";
import { useClients } from "@/modules/clients/hooks/useClients";
import { EnregistrementPartiel } from "@/modules/commandes/api/bons";
import { useBons } from "@/modules/commandes/hooks/useBons";
import { brouillonEmail } from "@/modules/documents/domain/email";
import { showToast } from "@/modules/documents/impression/zone";
import { DUREE_AVIS } from "@/modules/facturation/domain/avis";
import { badgeLogement, classeStatut, ligneLocataire } from "@/modules/facturation/domain/carte";
import { ModaleEmail } from "@/modules/facturation/components/ModaleEmail";
import { useFacturesEcran, useInterlocuteursSociete, useReferencesRapports } from "@/modules/facturation/hooks/useEcranFactures";
import { useFactureDepuisDevis } from "@/modules/facturation/hooks/useFactures";
import { useConducteurs } from "@/modules/societes/hooks/useConducteurs";
import type { DevisCarte } from "../api/ecran";
import { STATUTS_DEVIS } from "../domain/devis";
import { CRITERES_DEVIS_VIDES, filtrerDevis } from "../domain/liste";
import { useBonDepuisDevis, useDevisEcran, useDupliquerDevis, useSupprimerDevis, useTotauxDevis } from "../hooks/useDevis";
import { ApercuDevisParId } from "./PageApercuDevis";
import { PdfDevisDiffere } from "./PdfDevisDiffere";

const LIEN = { color: "var(--accent-2)", textDecoration: "underline" } as const;
const parNom = (a: string, b: string) => a.localeCompare(b);

/**
 * La liste des devis (`renderDevis` + `renderDevisListHTML`, app.js
 * l. 4386) : le titre et « + Nouveau devis », la barre de six filtres, puis
 * une carte par devis avec ses pièces liées et ses sept gestes. Les filtres
 * vivent dans l'adresse : une tuile du tableau de bord ouvre `/devis?statut=envoyé`.
 */
export function PageDevis() {
  useModeDiscret();
  const navigate = useNavigate();
  const devis = useDevisEcran();
  const totaux = useTotauxDevis();
  const factures = useFacturesEcran();
  const rapports = useReferencesRapports();
  const bons = useBons();
  const clients = useClients();
  const interlocuteurs = useInterlocuteursSociete();
  const conducteurs = useConducteurs();
  const peutCreer = usePermission("devis", "creer");
  const { filtres: c, changer: setC, changerUn } = useFiltresAdresse(CRITERES_DEVIS_VIDES);
  const recherche = useRechercheDifferee(c.recherche, (q) => changerUn("recherche", q));
  const [apercu, setApercu] = useState<string | null>(null);

  const parDevis = useMemo(() => new Map((totaux.data ?? []).map((t) => [t.devis_id, t])), [totaux.data]);
  const liste = devis.data ?? [];
  const totauxDe = (id: string) => {
    const t = parDevis.get(id);
    return { ht: montant(t?.ht ?? 0), ttc: montant(t?.ttc ?? 0) };
  };
  const filtres = filtrerDevis(liste, c, (d) => {
    const t = totauxDe(d.id);
    return montantsCherchables(t.ht, t.ttc);
  });
  const defile = useEntreeDefile("devis-card", filtres.map((d) => d.id), c.recherche, recherche);
  const client = c.client ? (clients.data ?? []).find((x) => x.id === c.client) : null;
  const interlocuteursProposes = (interlocuteurs.data ?? []).filter((i) => !c.client || (client && i.client_id === client.id)).map((i) => i.nom).sort(parNom);

  const contenu = () => {
    if (devis.isPending || totaux.isPending) return <Chargement />;
    if (devis.isError) return <Erreur erreur={devis.error} reessayer={() => void devis.refetch()} />;
    if (!filtres.length) return <div className="empty">{c.recherche.trim() ? "Aucun devis ne correspond à la recherche." : "Aucun devis pour cette société. Créez-en un, ou dites-le à l’assistant vocal."}</div>;
    return filtres.map((d) => (
      <CarteDevis
        key={d.id}
        d={d}
        totaux={totauxDe(d.id)}
        facturesLiees={(factures.data ?? []).filter((f) => f.devis_id === d.id).map((f) => ({ id: f.id, numero: f.numero ?? "" }))}
        rapport={(rapports.data ?? []).find((r) => r.id === d.intervention_id) ?? null}
        bonsLies={(bons.data ?? []).filter((b) => b.devis_id === d.id).map((b) => ({ id: b.id, numero: b.numero_bc ?? "" }))}
        destinataire={(clients.data ?? []).find((x) => x.id === d.client_id)?.email ?? null}
        enEvidence={defile.enEvidence === d.id}
        ouvrir={() => setApercu(d.id)}
      />
    ));
  };

  return (
    <>
      <div className="page-head">
        <h1>Devis</h1>
        {peutCreer && <button type="button" className="btn primary" onClick={() => void navigate("/devis/nouveau")}>+ Nouveau devis</button>}
      </div>
      <div style={{ display: "flex", gap: "10px", marginBottom: "16px", flexWrap: "wrap" }}>
        <input type="text" id="devisSearchInput" aria-label="Rechercher un devis" style={{ flex: 1, minWidth: "220px" }} value={recherche.saisie} placeholder="Rechercher : client, locataire, interlocuteur, adresse, prix HT/TTC…" onChange={(e) => recherche.setSaisie(e.target.value)} onKeyDown={defile.surTouche} />
        <select aria-label="Filtrer par conducteur" style={{ width: "auto", minWidth: "180px" }} value={c.conducteur} onChange={(e) => setC({ ...c, conducteur: e.target.value })}>
          <option value="">Tous les conducteurs</option>
          {/* Les actifs, plus celui déjà choisi : un conducteur retiré garde des devis à son nom. */}
          {(conducteurs.data ?? []).filter((k) => k.actif || k.id === c.conducteur).sort((a, b) => parNom(a.nom, b.nom)).map((k) => <option key={k.id} value={k.id}>{k.nom}</option>)}
        </select>
        <select aria-label="Filtrer par logement" style={{ width: "auto", minWidth: "170px" }} value={c.logement} onChange={(e) => setC({ ...c, logement: e.target.value })}>
          <option value="">Tous les logements</option>
          <option value="occupé">🏠 Logement occupé</option>
          <option value="vacant">🔑 Logement vacant</option>
          <option value="commune">🚪 Partie commune</option>
        </select>
        <select aria-label="Filtrer par client" style={{ width: "auto", minWidth: "170px" }} value={c.client} onChange={(e) => setC({ ...c, client: e.target.value, interlocuteur: "" })}>
          <option value="">Tous les clients</option>
          {[...(clients.data ?? [])].sort((a, b) => parNom(a.nom, b.nom)).map((x) => <option key={x.id} value={x.id}>{x.nom}</option>)}
        </select>
        <select aria-label="Filtrer par interlocuteur" style={{ width: "auto", minWidth: "190px" }} value={c.interlocuteur} onChange={(e) => setC({ ...c, interlocuteur: e.target.value })}>
          <option value="">Tous les interlocuteurs</option>
          {interlocuteursProposes.map((n, i) => <option key={`${n}-${i}`} value={n}>{n}</option>)}
        </select>
        <select aria-label="Filtrer par statut" style={{ width: "auto", minWidth: "160px" }} value={c.statut} onChange={(e) => setC({ ...c, statut: e.target.value })}>
          <option value="">Tous les statuts</option>
          {STATUTS_DEVIS.map((s) => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
        </select>
      </div>
      <div id="formZoneDevis" />
      <div id="devisListZone">{contenu()}</div>
      {apercu && <ApercuDevisParId id={apercu} fermer={() => setApercu(null)} />}
    </>
  );
}

/** Une carte de devis (`renderDevisListHTML`) : même HTML, mêmes classes, mêmes gestes, dans le même ordre. */
function CarteDevis({ d, totaux, facturesLiees, rapport, bonsLies, destinataire, enEvidence, ouvrir }: {
  d: DevisCarte;
  totaux: { ht: Montant; ttc: Montant };
  facturesLiees: { id: string; numero: string }[];
  rapport: { id: string; numero: string | null } | null;
  bonsLies: { id: string; numero: string }[];
  destinataire: string | null;
  enEvidence: boolean;
  ouvrir: () => void;
}) {
  useModeDiscret();
  const navigate = useNavigate();
  const societe = useSocieteActive();
  const peutModifier = usePermission("devis", "modifier");
  const peutCreer = usePermission("devis", "creer");
  const peutSupprimer = usePermission("devis", "supprimer");
  const peutFacturer = usePermission("factures", "creer");
  const peutCreerBon = usePermission("bons_commande", "creer");
  const dupliquer = useDupliquerDevis();
  const supprimer = useSupprimerDevis();
  const facturer = useFactureDepuisDevis();
  const bon = useBonDepuisDevis();
  const [pdf, setPdf] = useState(false);
  const [email, setEmail] = useState(false);
  const finPdf = useCallback(() => setPdf(false), []);
  const locataire = ligneLocataire(d);
  const logement = badgeLogement(d.logement_statut);
  const echec = (err: unknown) => showToast(messageErreur(err), "danger", DUREE_AVIS.echec);
  const surCarte = (e: MouseEvent) => {
    if ((e.target as HTMLElement).closest("button, a, input, select, textarea")) return;
    ouvrir();
  };

  return (
    <div className={enEvidence ? "card search-focus" : "card"} id={`devis-card-${d.id}`} style={{ cursor: "pointer" }} onClick={surCarte}>
      <div className="card-row">
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="card-title">{d.client_nom}</div>
          <div className="card-sub">
            <span className="numref-lg">{d.numero}</span> · {formatDateFr(d.date)}
            {d.interlocuteur ? ` · 👤 ${d.interlocuteur}` : ""}
            {d.conducteur ? ` · 🦺 ${d.conducteur}` : ""}
          </div>
          {locataire && <div className="card-sub">{locataire}</div>}
          {facturesLiees.length > 0 && (
            <div className="card-sub">
              Facture{facturesLiees.length > 1 ? "s" : ""} liée{facturesLiees.length > 1 ? "s" : ""} :{" "}
              {facturesLiees.map((f, i) => <span key={f.id}>{i > 0 && ", "}<Link to={`/factures/${f.id}`} style={LIEN}>{f.numero}</Link></span>)}
            </div>
          )}
          {rapport && (
            <div className="card-sub">
              Rapport d'origine : <Link to={`/rapports/${rapport.id}/apercu`} style={LIEN}>{rapport.numero}</Link>
            </div>
          )}
          {bonsLies.length > 0 && (
            <div className="card-sub">
              Bon{bonsLies.length > 1 ? "s" : ""} de commande lié{bonsLies.length > 1 ? "s" : ""} :{" "}
              {bonsLies.map((b, i) => <span key={b.id}>{i > 0 && ", "}<Link to={`/commandes/${b.id}`} style={LIEN}>{b.numero}</Link></span>)}
            </div>
          )}
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div className="amount">
            {formatEurosEcran(totaux.ht)} <small style={{ fontWeight: 400, color: "var(--text-dim)", fontSize: "11px" }}>HT</small>
          </div>
          <div className="card-sub">{formatEurosEcran(totaux.ttc)} TTC</div>
          {d.remise_pourcentage > 0 && <div className="card-sub" style={{ marginTop: "2px" }}>remise {String(d.remise_pourcentage)}%</div>}
          <div style={{ display: "flex", gap: "6px", alignItems: "center", justifyContent: "flex-end", marginTop: "5px" }}>
            {logement && <span className={`badge ${logement.classe}`}>{logement.libelle}</span>}
            <span className={`badge ${classeStatut(d.statut)}`}>{d.statut}</span>
          </div>
        </div>
      </div>
      <div style={{ marginTop: "10px", display: "flex", gap: "8px", flexWrap: "wrap" }}>
        <button type="button" className="btn small" onClick={() => void navigate(`/devis/${d.id}`)}>{peutModifier ? "Modifier" : "👁 Consulter"}</button>
        {peutCreer && (
          <button type="button" className="btn small" disabled={dupliquer.isPending} onClick={() => dupliquer.mutate(d.id, { onSuccess: (id) => { showToast("Devis dupliqué — modifiez-le puis enregistrez pour créer un nouveau devis.", "success"); void navigate(`/devis/${id}`); }, onError: echec })}>Dupliquer</button>
        )}
        <button type="button" className="btn small" onClick={() => setPdf(true)}>Imprimer / PDF</button>
        <button type="button" className="btn small" onClick={() => setEmail(true)}>Envoyer par email</button>
        {!facturesLiees.length && peutFacturer && (
          <button type="button" className="btn small" disabled={facturer.isPending} onClick={() => facturer.mutate(d.id, { onSuccess: (id) => void navigate(`/factures/${id}`), onError: echec })}>Transformer en facture</button>
        )}
        {!bonsLies.length && peutCreerBon && (
          <button
            type="button"
            className="btn small"
            disabled={bon.isPending}
            onClick={() =>
              bon.mutate(d.id, {
                onSuccess: (id) => void navigate(`/commandes/${id}`),
                // Bon créé sans toutes ses lignes : on l'ouvre, l'alerte dit quoi compléter.
                onError: (e) => (e instanceof EnregistrementPartiel ? void navigate(`/commandes/${e.bonId}`, { state: { message: messageErreur(e), alerte: true } }) : echec(e)),
              })
            }
          >
            Créer un bon de commande
          </button>
        )}
        {peutSupprimer && (
          <button type="button" className="btn small danger" onClick={() => { if (window.confirm("Supprimer définitivement cet élément ?")) supprimer.mutate(d.id, { onError: (err) => showToast(messageErreur(err) || "La suppression a été refusée. Rien n'a été supprimé.", "danger", DUREE_AVIS.suppression) }); }}>Supprimer</button>
        )}
      </div>
      {pdf && <PdfDevisDiffere id={d.id} fini={finPdf} />}
      {email && (
        <ModaleEmail
          brouillon={brouillonEmail({ nature: "devis", avoir: false, numero: d.numero, ttc: totaux.ttc, societeNom: societe.nom, destinataire, lieu: d })}
          telecharger={() => setPdf(true)}
          fermer={() => setEmail(false)}
        />
      )}
    </div>
  );
}
