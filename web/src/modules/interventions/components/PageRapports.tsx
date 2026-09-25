import { useState } from "react";
import { Link, useLocation } from "react-router";
import { Chargement, Erreur, Vide } from "@/components/etats/Etats";
import { EnTetePage } from "@/components/page/EnTetePage";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { messageErreur } from "@/lib/erreurs";
import { Can } from "@/modules/auth-roles/components/Can";
import { useSession } from "@/modules/auth-roles/hooks/useSession";
import { filtrerRapports, type Emetteur, type FiltresRapports } from "../domain/rapport";
import { useBonsLiables, useRapports } from "../hooks/useRapports";
import { CarteRapport } from "./CarteRapport";

const EMETTEURS: { valeur: Emetteur; libelle: string }[] = [
  { valeur: "internes", libelle: "Rapports internes" },
  { valeur: "sous_traitants", libelle: "Rapports des sous-traitants" },
  { valeur: "tous", libelle: "Tous les rapports" },
];

/**
 * Rapports / recherche de fuite (PLN-20) : recherche multi-mots, conducteur,
 * logement, émetteur. Le sous-traitant ne voit que les siens — la base les
 * lui filtre (proposition 20260926052000, PLN-52).
 */
export function PageRapports() {
  const rapports = useRapports();
  const bons = useBonsLiables();
  const { roleEffectif } = useSession();
  const location = useLocation();
  const [filtres, setFiltres] = useState<FiltresRapports>({ recherche: "", conducteur: "", logement: "", emetteur: roleEffectif === "sous_traitant" ? "tous" : "internes" });
  const [resultat, setResultat] = useState<{ message: string; erreur?: unknown } | null>(() => {
    const m = (location.state as { message?: string } | null)?.message;
    return m ? { message: m } : null;
  });
  const liste = filtrerRapports(rapports.data ?? [], filtres);
  const conducteurs = [...new Set((rapports.data ?? []).map((r) => r.conducteur).filter((c): c is string => !!c))].sort((a, b) => a.localeCompare(b, "fr"));
  const numeroDuBon = (id: string | null) => (id ? (bons.data?.find((b) => b.id === id)?.numero_bc ?? bons.data?.find((b) => b.id === id)?.numero_interne ?? null) : null);

  return (
    <>
      <EnTetePage
        titre="Rapports / recherche de fuite"
        actions={<Can module="rapports" action="creer"><Button asChild><Link to="/rapports/nouveau">+ Nouveau rapport</Link></Button></Can>}
      />
      <div className="mb-3 flex flex-wrap gap-2">
        <label className="sr-only" htmlFor="recherche-rapports">Rechercher</label>
        <Input id="recherche-rapports" type="search" className="min-w-56 flex-1" placeholder="Rechercher" value={filtres.recherche} onChange={(e) => setFiltres({ ...filtres, recherche: e.target.value })} />
        <Select aria-label="Conducteur" className="w-auto" value={filtres.conducteur} onChange={(e) => setFiltres({ ...filtres, conducteur: e.target.value })}>
          <option value="">Tous les conducteurs</option>
          {conducteurs.map((c) => <option key={c} value={c}>{c}</option>)}
        </Select>
        <Select aria-label="Logement" className="w-auto" value={filtres.logement} onChange={(e) => setFiltres({ ...filtres, logement: e.target.value })}>
          <option value="">Tous les logements</option>
          <option value="occupé">🏠 Logement occupé</option>
          <option value="vacant">🔑 Logement vacant</option>
          <option value="commune">🚪 Partie commune</option>
        </Select>
        {roleEffectif !== "sous_traitant" && (
          <Select aria-label="Émetteur" className="w-auto" value={filtres.emetteur} onChange={(e) => setFiltres({ ...filtres, emetteur: e.target.value as Emetteur })}>
            {EMETTEURS.map((x) => <option key={x.valeur} value={x.valeur}>{x.libelle}</option>)}
          </Select>
        )}
      </div>
      {resultat && <Alert className="mb-3" variant={resultat.erreur ? "erreur" : "succes"}>{resultat.erreur ? messageErreur(resultat.erreur) : resultat.message}</Alert>}
      {rapports.isPending && <Chargement />}
      {rapports.isError && <Erreur erreur={rapports.error} reessayer={() => void rapports.refetch()} />}
      {rapports.isSuccess && !liste.length && <Vide message={rapports.data.length ? "Aucun rapport ne correspond." : "Aucun rapport pour cette société."} />}
      <ul className="flex flex-col gap-2">
        {liste.map((r) => <CarteRapport key={r.id} r={r} numeroBon={numeroDuBon(r.bon_commande_id)} onResultat={(message, erreur) => setResultat({ message, erreur })} />)}
      </ul>
    </>
  );
}
