import { useMemo, useState } from "react";
import { Link } from "react-router";
import { Chargement, Erreur, Vide } from "@/components/etats/Etats";
import { EnTetePage } from "@/components/page/EnTetePage";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Table, TBody, Td, Th, THead, Tr } from "@/components/ui/table";
import { formatDateFr, todayISO } from "@/lib/dates";
import { formatEuros, montant } from "@/lib/money";
import { correspond } from "@/lib/recherche";
import { cn, grouperPar } from "@/lib/utils";
import { Can } from "@/modules/auth-roles/components/Can";
import { estAvoir } from "@/modules/documents/domain/totaux";
import { etatPiece, libelleDelai } from "../domain/etat";
import { useFactures, useReglements, useTotauxFactures } from "../hooks/useFactures";
import { BadgeEtat } from "./BadgeEtat";

type Vue = "factures" | "avoirs";
const FILTRES = [
  { valeur: "", libelle: "Tous les états" },
  { valeur: "impayee", libelle: "Non réglées" },
  { valeur: "partiel", libelle: "Partiellement réglées" },
  { valeur: "payee", libelle: "Réglées" },
  { valeur: "retard", libelle: "En retard" },
  { valeur: "brouillon", libelle: "Brouillons" },
];

export function PageFactures() {
  const factures = useFactures();
  const totaux = useTotauxFactures();
  const reglements = useReglements();
  const [vue, setVue] = useState<Vue>("factures");
  const [recherche, setRecherche] = useState("");
  const [filtre, setFiltre] = useState("");
  const aujourdhui = todayISO();

  const lignes = useMemo(() => {
    const ttcParId = new Map((totaux.data ?? []).map((t) => [t.facture_id, t.ttc ?? 0]));
    const reglementsParId = grouperPar(reglements.data ?? [], (r) => r.facture_id);
    return (factures.data ?? []).map((f) => {
      const ttc = ttcParId.get(f.id) ?? 0;
      const etat = etatPiece(f, ttc, reglementsParId.get(f.id) ?? [], aujourdhui);
      return { f, ttc, etat, delai: libelleDelai(etat, f.echeance || f.date, aujourdhui) };
    });
  }, [factures.data, totaux.data, reglements.data, aujourdhui]);

  const visibles = lignes.filter(({ f, etat }) => {
    if (estAvoir(f.type_document) !== (vue === "avoirs")) return false;
    if (!correspond(recherche, f.numero, f.client_nom)) return false;
    if (!filtre) return true;
    if (filtre === "brouillon") return etat.nature === "brouillon";
    if (etat.nature !== "facture") return filtre === "payee" && etat.nature === "reprise";
    if (filtre === "retard") return etat.enRetard;
    return { impayee: "non_reglee", partiel: "partiellement_reglee", payee: "reglee" }[filtre] === etat.cle;
  });

  const chargement = factures.isPending || totaux.isPending || reglements.isPending;
  const erreur = factures.error ?? totaux.error ?? reglements.error;

  return (
    <>
      <EnTetePage
        titre="Factures"
        actions={
          <Can module="factures" action="creer">
            <Button asChild>
              <Link to="/factures/nouvelle">Nouvelle facture</Link>
            </Button>
          </Can>
        }
      />
      <div role="tablist" aria-label="Vue" className="mb-3 flex gap-1">
        {(["factures", "avoirs"] as const).map((v) => (
          <Button key={v} role="tab" aria-selected={vue === v} variant={vue === v ? "default" : "ghost"} size="sm" onClick={() => setVue(v)}>
            {v === "factures" ? "Factures" : "Avoirs"}
          </Button>
        ))}
      </div>
      <div className="mb-3 flex flex-wrap gap-2">
        <label htmlFor="recherche-factures" className="sr-only">Rechercher une facture</label>
        <Input id="recherche-factures" type="search" className="max-w-sm" placeholder="N°, client…" value={recherche} onChange={(e) => setRecherche(e.target.value)} />
        {vue === "factures" && (
          <>
            <label htmlFor="filtre-etat" className="sr-only">Filtrer par état</label>
            <Select id="filtre-etat" className="max-w-56" value={filtre} onChange={(e) => setFiltre(e.target.value)}>
              {FILTRES.map((x) => <option key={x.valeur} value={x.valeur}>{x.libelle}</option>)}
            </Select>
          </>
        )}
      </div>
      {chargement && <Chargement />}
      {erreur && <Erreur erreur={erreur} reessayer={() => { void factures.refetch(); void totaux.refetch(); void reglements.refetch(); }} />}
      {!chargement && !erreur && visibles.length === 0 && <Vide message={vue === "avoirs" ? "Aucun avoir." : "Aucune facture ne correspond."} />}
      {!chargement && visibles.length > 0 && (
        <Table>
          <THead>
            <Tr>
              <Th>N°</Th>
              <Th>Date</Th>
              <Th>Client</Th>
              <Th className="text-right">TTC</Th>
              <Th className="text-right">{vue === "avoirs" ? "À imputer" : "Reste dû"}</Th>
              <Th>État</Th>
            </Tr>
          </THead>
          <TBody>
            {visibles.map(({ f, ttc, etat, delai }) => (
              <Tr key={f.id}>
                <Td>
                  <Link to={`/factures/${f.id}`} className="font-medium text-primary hover:underline">{f.numero || "Brouillon"}</Link>
                </Td>
                <Td>{formatDateFr(f.date)}</Td>
                <Td>{f.client_nom}</Td>
                {/* Un avoir se lit en négatif ; ses montants sont stockés positifs. */}
                <Td className="text-right tabular-nums">{formatEuros(estAvoir(f.type_document) ? montant(ttc).neg() : montant(ttc))}</Td>
                <Td className="text-right tabular-nums">{etat.nature === "facture" || etat.nature === "avoir" ? formatEuros(etat.reste) : "—"}</Td>
                <Td className="flex flex-wrap gap-1">
                  <BadgeEtat etat={etat} />
                  {delai && <Badge variant={delai.startsWith("En retard") ? "danger" : "neutre"} className={cn(delai.startsWith("En retard") && "font-semibold")}>{delai}</Badge>}
                </Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      )}
    </>
  );
}
