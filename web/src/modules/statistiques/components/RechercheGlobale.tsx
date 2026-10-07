import { useEffect, useMemo } from "react";
import { Link } from "react-router";
import { Chargement, Erreur } from "@/components/etats/Etats";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { formatDateFr } from "@/lib/dates";
import { formatEurosEcran, useModeDiscret } from "@/lib/modeDiscret";
import { useListeDevis, useTotauxDevis } from "@/modules/devis/hooks/useDevis";
import { useSoldes } from "@/modules/facturation/hooks/useFactures";
import { useRapports } from "@/modules/interventions/hooks/useRapports";
import { LIBELLES_NATURE, resultatsRecherche } from "../domain/recherche";

/** La loupe de l'ancienne barre (`.dash-search-wrap svg`), son tracé recopié. */
const TRACE_LOUPE = '<circle cx="11" cy="11" r="7"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line>';

/**
 * La barre de recherche du pilotage (`.dash-topbar`). Tant qu'elle est vide, le
 * tableau de bord s'affiche ; dès qu'on tape, les résultats le remplacent
 * (`onGlobalSearchInput`). Entrée passe au résultat suivant
 * (`globalSearchEnterCycle`).
 */
export function RechercheGlobale({ requete, onChange, onEntree }: { requete: string; onChange: (v: string) => void; onEntree: () => void }) {
  useModeDiscret();
  return (
    <div className="dash-topbar">
      <div className="dash-search-wrap">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" dangerouslySetInnerHTML={{ __html: TRACE_LOUPE }} />
        <input
          type="text"
          id="globalSearchInput"
          aria-label="Rechercher dans les devis, factures et rapports"
          placeholder="Rechercher (clients, devis, factures…)"
          value={requete}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            e.preventDefault();
            onEntree();
          }}
        />
      </div>
    </div>
  );
}

/** La couleur de pastille d'un statut (`badgeClass`, app.js l. 159). */
const VARIANTE_STATUT: Record<string, BadgeVariant> = {
  brouillon: "neutre",
  envoyé: "info",
  envoyée: "info",
  accepté: "succes",
  payée: "succes",
  terminée: "succes",
  reçu: "succes",
  refusé: "danger",
  impayée: "danger",
  annulé: "danger",
  "en cours": "jaune",
};

/**
 * Les résultats (`globalSearchResultsHTML`) : une carte par pièce, le client en
 * titre, nature · numéro · date dessous, le TTC ou le statut à droite. Les
 * listes ne sont chargées qu'à la première frappe : l'accueil n'a pas à lire
 * toutes les pièces de la société pour rien. `appuis` compte les Entrée depuis
 * la dernière frappe : le premier allume le premier résultat, le suivant le
 * suivant, et l'on reboucle.
 */
export function ResultatsRecherche({ requete, appuis }: { requete: string; appuis: number }) {
  useModeDiscret();
  const devis = useListeDevis();
  const totaux = useTotauxDevis();
  const soldes = useSoldes();
  const rapports = useRapports();
  const requetes = [devis, totaux, soldes, rapports];
  const pret = requetes.every((q) => q.isSuccess);
  const resultats = useMemo(
    () =>
      pret
        ? resultatsRecherche(requete, {
            devis: devis.data ?? [],
            totauxDevis: new Map((totaux.data ?? []).flatMap((t) => (t.devis_id && t.ttc !== null ? [[t.devis_id, t.ttc] as const] : []))),
            factures: soldes.data ?? [],
            rapports: rapports.data ?? [],
          })
        : [],
    [pret, requete, devis.data, totaux.data, soldes.data, rapports.data]
  );
  const courant = appuis > 0 && resultats.length ? (appuis - 1) % resultats.length : null;
  useEffect(() => {
    if (courant !== null) document.getElementById(`global-result-${courant}`)?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [courant]);

  const enErreur = requetes.find((q) => q.isError);
  if (enErreur) return <Erreur erreur={enErreur.error} reessayer={() => requetes.forEach((q) => void q.refetch())} />;
  if (!pret) return <Chargement libelle="Recherche…" />;
  if (!resultats.length) return <div className="empty">Aucun résultat pour cette recherche.</div>;
  return (
    <section aria-label="Résultats de la recherche">
      <div className="section-title" role="status">
        {resultats.length} résultat{resultats.length > 1 ? "s" : ""}
      </div>
      {resultats.map((r, i) => (
        <Link key={`${r.nature}-${r.id}`} id={`global-result-${i}`} to={r.lien} className={i === courant ? "card resultat-recherche search-focus" : "card resultat-recherche"}>
          <div className="card-row">
            <div>
              <div className="card-title">{r.client}</div>
              <div className="card-sub numref">
                {LIBELLES_NATURE[r.nature]} · {r.numero} · {formatDateFr(r.date)}
              </div>
            </div>
            {r.ttc ? <div className="amount">{formatEurosEcran(r.ttc)}</div> : r.statut ? <Badge variant={VARIANTE_STATUT[r.statut] ?? "neutre"}>{r.statut}</Badge> : null}
          </div>
        </Link>
      ))}
    </section>
  );
}
