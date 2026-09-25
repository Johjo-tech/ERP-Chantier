import { useMemo, useState } from "react";
import { Link } from "react-router";
import { Chargement, Erreur, Vide } from "@/components/etats/Etats";
import { EnTetePage } from "@/components/page/EnTetePage";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Table, TBody, Td, Th, THead, Tr } from "@/components/ui/table";
import { formatDateFr, todayISO } from "@/lib/dates";
import { montant } from "@/lib/money";
import { formatEurosEcran } from "@/lib/modeDiscret";
import { correspond } from "@/lib/recherche";
import { CLASSE_EN_EVIDENCE, useEntreeDefile, useRechercheDifferee } from "@/lib/useRecherche";
import { cn } from "@/lib/utils";
import { Can } from "@/modules/auth-roles/components/Can";
import { BoutonImport } from "@/modules/import-export/components/Recapitulatif";
import { usePermission } from "@/modules/auth-roles/hooks/useSession";
import { estAvoir } from "@/modules/documents/domain/totaux";
import { libelleDelai } from "../domain/etat";
import { etatDepuisSolde, totalDu } from "../domain/solde";
import { useCroisement } from "../hooks/useCroisement";
import { useFactures, useSoldes } from "../hooks/useFactures";
import { BadgeEtat } from "./BadgeEtat";
import { OngletsFacturation } from "./OngletsFacturation";
import { OrigineRecherche } from "./OrigineRecherche";

type Vue = "factures" | "avoirs";
const FILTRES = [
  { valeur: "", libelle: "Tous les états" },
  { valeur: "impayee", libelle: "Non réglées" },
  { valeur: "partiel", libelle: "Partiellement réglées" },
  { valeur: "payee", libelle: "Réglées" },
  { valeur: "retard", libelle: "En retard" },
  { valeur: "brouillon", libelle: "Brouillons" },
];

/**
 * Factures et avoirs. Reste, état et retard sont LUS dans `v_facture_solde`
 * (FAC-92, D-FAC-01) : la base calcule, l'écran montre.
 */
export function PageFactures({ vue = "factures" }: { vue?: Vue }) {
  const factures = useFactures();
  const soldes = useSoldes();
  const voitReglements = usePermission("reglements", "voir");
  const [recherche, setRecherche] = useState("");
  const saisie = useRechercheDifferee(recherche, setRecherche);
  const croisement = useCroisement();
  const [filtre, setFiltre] = useState("");
  const aujourdhui = todayISO();

  const lignes = useMemo(() => {
    const parId = new Map((soldes.data ?? []).map((s) => [s.facture_id, s]));
    return (factures.data ?? []).map((f) => {
      const s = parId.get(f.id);
      const etat = s ? etatDepuisSolde(s) : ({ nature: "brouillon" } as const);
      // La facture se cherche aussi par son montant et par ce que disent ses bons (TRV-06, TRV-07).
      const propres = [f.numero, f.client_nom, f.occupant, f.adresse_locataire, f.ref_bon_commande_client];
      return { f, s, ttc: s?.ttc ?? 0, etat, delai: libelleDelai(etat, f.echeance || f.date, aujourdhui), propres, apports: croisement.apportsFacture(f) };
    });
  }, [factures.data, soldes.data, aujourdhui, croisement]);

  const visibles = lignes.filter(({ f, etat, propres, apports }) => {
    if (estAvoir(f.type_document) !== (vue === "avoirs")) return false;
    if (!correspond(recherche, ...propres, ...apports.map((a) => a.valeur))) return false;
    if (!filtre) return true;
    if (filtre === "brouillon") return etat.nature === "brouillon";
    if (etat.nature !== "facture") return filtre === "payee" && etat.nature === "reprise";
    if (filtre === "retard") return etat.enRetard;
    return { impayee: "non_reglee", partiel: "partiellement_reglee", payee: "reglee" }[filtre] === etat.cle;
  });
  const enRetard = (soldes.data ?? []).filter((s) => s.en_retard);
  const defile = useEntreeDefile("facture", visibles.map((v) => v.f.id), recherche, saisie);

  const chargement = factures.isPending || soldes.isPending;
  const erreur = factures.error ?? soldes.error;

  return (
    <>
      <EnTetePage
        titre={vue === "avoirs" ? "Avoirs" : "Factures"}
        actions={
          <>
            {vue !== "avoirs" && <BoutonImport adminSeul module="factures" vers="/factures/import" libelle="Reprendre un historique" />}
            <Can module="factures" action="creer">
              <Button asChild>
                <Link to="/factures/nouvelle">Nouvelle facture</Link>
              </Button>
            </Can>
          </>
        }
      />
      <OngletsFacturation />
      {vue === "factures" && enRetard.length > 0 && (
        // « Factures échues à relancer » (app.js l. 2097) : le compte, le montant, et le chemin vers la liste.
        <Alert>
          {enRetard.length} facture{enRetard.length > 1 ? "s" : ""} échue{enRetard.length > 1 ? "s" : ""} à relancer — {formatEurosEcran(totalDu(enRetard))} en retard.{" "}
          {voitReglements && <Link className="font-medium text-primary hover:underline" to="/factures/reglements/par-facture?etat=en_retard">Voir les retards</Link>}
        </Alert>
      )}
      {vue === "avoirs" && <p className="mb-3 text-sm text-muted-foreground">Les avoirs rectifient une facture émise. Ils portent leur propre série « AV » et comptent en négatif ; ils s'imputent, ils ne s'encaissent pas.</p>}
      <div className="mb-3 flex flex-wrap gap-2">
        <label htmlFor="recherche-factures" className="sr-only">Rechercher une facture</label>
        <Input id="recherche-factures" type="search" className="max-w-sm" placeholder="N°, client, n° de BC, montant…" value={saisie.saisie} onChange={(e) => saisie.setSaisie(e.target.value)} onKeyDown={defile.surTouche} />
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
      {erreur && <Erreur erreur={erreur} reessayer={() => { void factures.refetch(); void soldes.refetch(); }} />}
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
            {visibles.map(({ f, ttc, etat, delai, propres, apports }) => (
              <Tr key={f.id} id={defile.idDomDe(f.id)} className={cn(defile.enEvidence === f.id && CLASSE_EN_EVIDENCE)}>
                <Td>
                  <Link to={`/factures/${f.id}`} className="font-medium text-primary hover:underline">{f.numero || "Brouillon"}</Link>
                </Td>
                <Td>{formatDateFr(f.date)}</Td>
                <Td>
                  {f.client_nom}
                  <OrigineRecherche requete={recherche} propres={propres} apports={apports} />
                </Td>
                {/* Un avoir se lit en négatif ; ses montants sont stockés positifs. */}
                <Td className="text-right tabular-nums">{formatEurosEcran(estAvoir(f.type_document) ? montant(ttc).neg() : montant(ttc))}</Td>
                <Td className="text-right tabular-nums">{etat.nature === "facture" || etat.nature === "avoir" ? formatEurosEcran(etat.reste) : "—"}</Td>
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
