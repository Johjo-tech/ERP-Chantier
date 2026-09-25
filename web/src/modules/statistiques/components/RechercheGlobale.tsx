import { useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import { Chargement, Erreur } from "@/components/etats/Etats";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { formatDateFr } from "@/lib/dates";
import { formatEurosEcran } from "@/lib/modeDiscret";
import { useListeDevis, useTotauxDevis } from "@/modules/devis/hooks/useDevis";
import { useSoldes } from "@/modules/facturation/hooks/useFactures";
import { useRapports } from "@/modules/interventions/hooks/useRapports";
import { indexSuivant, LIBELLES_NATURE, resultatsRecherche } from "../domain/recherche";

/**
 * La barre de recherche du pilotage. Tant qu'elle est vide, le tableau de bord
 * s'affiche ; dès qu'on tape, les résultats le remplacent (`onGlobalSearchInput`).
 * Les listes ne sont chargées qu'à la première frappe : l'accueil n'a pas à
 * lire toutes les pièces de la société pour rien.
 */
export function RechercheGlobale({ requete, onChange }: { requete: string; onChange: (v: string) => void }) {
  const [courant, setCourant] = useState<number | null>(null);
  const liste = useRef<HTMLOListElement>(null);
  const suivant = () => {
    const liens = liste.current?.querySelectorAll<HTMLAnchorElement>("a[data-resultat]") ?? [];
    const i = indexSuivant(courant, liens.length);
    setCourant(i);
    if (i !== null) liens[i]?.scrollIntoView({ block: "center", behavior: "smooth" });
  };
  return (
    <div className="flex flex-col gap-3">
      <Input
        type="search"
        aria-label="Rechercher dans les devis, factures et rapports"
        placeholder="Rechercher (clients, devis, factures…)"
        value={requete}
        onChange={(e) => { onChange(e.target.value); setCourant(null); }}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); suivant(); } }}
      />
      {requete.trim() && <Resultats requete={requete} courant={courant} liste={liste} />}
    </div>
  );
}

function Resultats({ requete, courant, liste }: { requete: string; courant: number | null; liste: React.RefObject<HTMLOListElement | null> }) {
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
  const enErreur = requetes.find((q) => q.isError);
  if (enErreur) return <Erreur erreur={enErreur.error} reessayer={() => requetes.forEach((q) => void q.refetch())} />;
  if (!pret) return <Chargement libelle="Recherche…" />;
  if (!resultats.length) return <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">Aucun résultat pour cette recherche.</p>;
  return (
    <section aria-label="Résultats de la recherche">
      <p role="status" className="mb-2 text-sm font-semibold">{resultats.length} résultat{resultats.length > 1 ? "s" : ""} — Entrée pour passer au suivant</p>
      <ol ref={liste} className="flex flex-col gap-2">
        {resultats.map((r, i) => (
          <li key={`${r.nature}-${r.id}`}>
            <Link data-resultat to={r.lien} className={`flex items-center justify-between gap-3 rounded-md border bg-card p-3 text-sm hover:bg-muted ${i === courant ? "ring-2 ring-ring" : ""}`}>
              <span>
                <span className="block font-medium">{r.client}</span>
                <span className="text-muted-foreground">{LIBELLES_NATURE[r.nature]} · {r.numero || "sans numéro"} · {formatDateFr(r.date)}</span>
              </span>
              {r.ttc ? <span className="font-semibold tabular-nums">{formatEurosEcran(r.ttc)}</span> : r.statut ? <Badge variant="neutre">{r.statut}</Badge> : null}
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
