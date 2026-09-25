import { useEffect, type ReactNode } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { Chargement, Erreur } from "@/components/etats/Etats";
import { formatDateFr } from "@/lib/dates";
import { montant, somme } from "@/lib/money";
import { formatEurosEcran, useModeDiscret } from "@/lib/modeDiscret";
import { motifRoleFacture } from "../domain/actions";
import {
  clientsAvecFactures, compteRecherche, CRITERES_PAR_FACTURE_VIDES, cherche, dossiersParClient, ETATS_REGLEMENT, facturesParEtat, TRIS_REGLEMENT,
  type CriteresParFacture, type EtatReglement, type TriReglement,
} from "../domain/reglementsEcran";
import { useCartesFactures } from "../hooks/useCartesFactures";
import { creerMagasin, useMagasin } from "../hooks/useEcranFactures";
import { OngletsFacturation } from "./OngletsFacturation";
import { VueTousReglements } from "./VueTousReglements";

export type VueReglements = "clients" | "factures" | "tous";

const VUES: { vue: VueReglements; chemin: string; libelle: string; titre?: string }[] = [
  { vue: "clients", chemin: "/factures/reglements", libelle: "Par client" },
  { vue: "factures", chemin: "/factures/reglements/par-facture", libelle: "Par facture", titre: "Quelles factures sont payées, lesquelles ne le sont pas" },
  { vue: "tous", chemin: "/factures/reglements/tous", libelle: "Tous les règlements" },
];

/** Les critères de l'onglet, gardés d'une vue à l'autre comme `state.reglementEtatFiltre` & cie. */
const magasinEtat = creerMagasin<EtatReglement>("");
const magasinRecherche = creerMagasin("");
const magasinParFacture = creerMagasin<CriteresParFacture>(CRITERES_PAR_FACTURE_VIDES);

/**
 * L'en-tête commun de Facturation › Règlements (`renderFactures` +
 * `renderReglements(true)`, app.js l. 10699) : les sous-onglets de
 * Facturation, le titre, le motif du rôle, puis les trois vues.
 */
export function CadreReglements({ children }: { children: ReactNode }) {
  const { droits } = useCartesFactures();
  const motifRole = motifRoleFacture(droits);
  return (
    <>
      <OngletsFacturation />
      <div className="page-head"><h1>Règlements</h1></div>
      {motifRole && <div className="card-sub" style={{ margin: "0 0 12px" }}>{motifRole}</div>}
      {children}
    </>
  );
}

export function PageReglements({ vue }: { vue: VueReglements }) {
  const navigate = useNavigate();
  return (
    <CadreReglements>
      <div className="plus-subnav" style={{ marginBottom: "14px" }} role="navigation" aria-label="Vue des règlements">
        {VUES.map((v) => (
          <button key={v.vue} type="button" className={v.vue === vue ? "plus-subnav-btn active" : "plus-subnav-btn"} aria-current={v.vue === vue ? "page" : undefined} title={v.titre} onClick={() => void navigate(v.chemin)}>
            {v.libelle}
          </button>
        ))}
      </div>
      {vue === "clients" ? <VueParClient /> : vue === "factures" ? <VueParFacture /> : <VueTousReglements />}
    </CadreReglements>
  );
}

function SelectEtat({ etat, changer }: { etat: EtatReglement; changer: (e: EtatReglement) => void }) {
  return (
    <select aria-label="État" style={{ width: "auto", minWidth: "210px" }} value={etat} onChange={(e) => changer(e.target.value as EtatReglement)}>
      {ETATS_REGLEMENT.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
    </select>
  );
}

/** « Par client » (`listeDossiersReglementsHTML`) : un dossier par client, son dû, son retard. */
function VueParClient() {
  useModeDiscret();
  const navigate = useNavigate();
  const { cartes, chargement, erreur, reessayer, aujourdhui } = useCartesFactures();
  const [etat, setEtat] = useMagasin(magasinEtat);
  const [recherche, setRecherche] = useMagasin(magasinRecherche);
  const tous = dossiersParClient(cartes, etat, aujourdhui);
  // Le dossier ne porte que le nom : les numéros de ses factures le rendent trouvable par « FAC-2026-0412 ».
  const dossiers = tous.filter((d) => cherche(recherche, d.nom, ...d.factures.flatMap((c) => [...c.cherchables, c.f.numero])));
  const compte = compteRecherche(recherche, dossiers.length, tous.length);
  const liste = () => {
    if (!dossiers.length) return <div className="empty">{recherche.trim() ? "Aucun dossier ne correspond à la recherche." : "Aucune facture pour cette société."}</div>;
    return dossiers.map((d) => (
      <div key={d.nom} className="card" style={{ cursor: "pointer" }} role="link" tabIndex={0} onClick={() => void navigate(`/factures/reglements/dossier?client=${encodeURIComponent(d.nom)}`)} onKeyDown={(e) => { if (e.key === "Enter") void navigate(`/factures/reglements/dossier?client=${encodeURIComponent(d.nom)}`); }}>
        <div className="card-row">
          <div>
            <div className="card-title">{d.nom}</div>
            <div className="card-sub">{d.factures.length} facture{d.factures.length > 1 ? "s" : ""}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div className="amount">{formatEurosEcran(d.totalDu)}</div>
            <div className="card-sub" style={{ marginTop: "4px" }}>{d.totalDu.gt(montant("0.01")) ? (d.enRetard ? <span className="badge danger">Retard</span> : "dû") : "à jour"}</div>
          </div>
        </div>
      </div>
    ));
  };
  return (
    <>
      <div className="barre-recherche">
        <input type="search" id="recherche-reglementClient" aria-label="Rechercher" value={recherche} placeholder="Rechercher : client, n° de facture…" onChange={(e) => setRecherche(e.target.value)} />
        {compte && <span className="compteur-resultats">{compte}</span>}
      </div>
      <div style={{ display: "flex", gap: "10px", margin: "0 0 14px", flexWrap: "wrap", alignItems: "center" }}>
        <SelectEtat etat={etat} changer={setEtat} />
        {etat && <button type="button" className="btn small ghost" onClick={() => setEtat("")} title="Tout réafficher">✕ Effacer</button>}
      </div>
      <div id="liste-reglementClient">
        {chargement && <Chargement />}
        {erreur && <Erreur erreur={erreur} reessayer={reessayer} />}
        {!chargement && !erreur && liste()}
      </div>
    </>
  );
}

/** « Par facture » (`renderFacturesParReglement`) : ce qui traîne, et combien reste à encaisser. */
function VueParFacture() {
  useModeDiscret();
  const navigate = useNavigate();
  const { cartes, chargement, erreur, reessayer, aujourdhui } = useCartesFactures();
  const [etat, setEtat] = useMagasin(magasinEtat);
  const [c, setC] = useMagasin(magasinParFacture);
  // « Voir les retards » du tableau de bord arrive avec `?etat=en_retard` : l'état se pose, puis l'onglet le garde.
  const [params] = useSearchParams();
  const etatAdresse = params.get("etat");
  useEffect(() => {
    if (etatAdresse && ETATS_REGLEMENT.some(([k]) => k === etatAdresse)) setEtat(etatAdresse as EtatReglement);
  }, [etatAdresse, setEtat]);
  const criteres = { ...c, etat };
  const lignes = facturesParEtat(cartes, criteres, aujourdhui);
  const du = somme(lignes.map((l) => l.p.etat.reste).filter((r) => r.gt(montant("0.01"))));
  const enRetard = lignes.filter((l) => l.enRetard).length;
  const actif = !!(etat || c.client || c.du || c.au);
  if (chargement) return <Chargement />;
  if (erreur) return <Erreur erreur={erreur} reessayer={reessayer} />;
  return (
    <>
      <div style={{ display: "flex", gap: "10px", marginBottom: "14px", flexWrap: "wrap", alignItems: "center" }}>
        <SelectEtat etat={etat} changer={setEtat} />
        <select aria-label="Client" style={{ width: "auto", minWidth: "200px" }} value={c.client} onChange={(e) => setC({ ...c, client: e.target.value })}>
          <option value="">Tous les clients</option>
          {clientsAvecFactures(cartes, true).map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
        <label className="card-sub" style={{ margin: 0 }} title="Échéance à partir du">
          Échéance du <input type="date" style={{ width: "auto" }} value={c.du} onChange={(e) => setC({ ...c, du: e.target.value })} />
        </label>
        <label className="card-sub" style={{ margin: 0 }} title="Échéance jusqu'au">
          au <input type="date" style={{ width: "auto" }} value={c.au} onChange={(e) => setC({ ...c, au: e.target.value })} />
        </label>
        <select aria-label="Ordre d'affichage" style={{ width: "auto", minWidth: "210px" }} title="Ordre d'affichage" value={c.tri} onChange={(e) => setC({ ...c, tri: e.target.value as TriReglement })}>
          {TRIS_REGLEMENT.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
        {actif && <button type="button" className="btn small ghost" onClick={() => { setEtat(""); setC({ ...CRITERES_PAR_FACTURE_VIDES, tri: c.tri }); }} title="Tout réafficher">✕ Effacer</button>}
      </div>
      <div className="card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "14px", flexWrap: "wrap" }}>
        <div>
          <div className="card-title">{lignes.length} facture{lignes.length > 1 ? "s" : ""}</div>
          <div className="card-sub">{enRetard ? <>dont <b>{enRetard}</b> en retard</> : "aucune en retard"}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div className="amount">{formatEurosEcran(du)}</div>
          <div className="card-sub">reste à encaisser</div>
        </div>
      </div>
      {lignes.length ? (
        lignes.map(({ p, jours, enRetard: retard }) => (
          <div key={p.f.id} className="card">
            <div className="card-row">
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="card-title">{p.f.client_nom}</div>
                <div className="card-sub">
                  <span className="numref-lg">{p.f.numero || "Brouillon"}</span> · {formatDateFr(p.f.date)}
                  {p.f.echeance ? ` · échéance ${formatDateFr(p.f.echeance)}` : ""}
                </div>
                <div className="card-sub">
                  {formatEurosEcran(p.ttc)} TTC · {formatEurosEcran(p.etat.paye)} encaissé
                  {p.etat.reste.gt(montant("0.01")) && <> · <b>{formatEurosEcran(p.etat.reste)} dû</b></>}
                </div>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "4px" }}>
                <span className={`badge ${p.etat.classe}`}>{p.etat.libelle}</span>
                {retard && <span className="badge danger" title="Échéance dépassée">Retard {jours} j</span>}
              </div>
            </div>
            <div style={{ marginTop: "8px", display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <button type="button" className="btn small" onClick={() => void navigate(`/factures/reglements/dossier?client=${encodeURIComponent(p.f.client_nom)}`)}>Ouvrir le dossier</button>
              <button type="button" className="btn small ghost" onClick={() => void navigate(`/factures/${p.f.id}`)}>Voir la facture</button>
            </div>
          </div>
        ))
      ) : (
        <div className="empty">Aucune facture dans cet état.</div>
      )}
    </>
  );
}
