import { useMemo, useState } from "react";
import { Link } from "react-router";
import { Chargement, Erreur, Vide } from "@/components/etats/Etats";
import { EnTetePage } from "@/components/page/EnTetePage";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Table, TBody, Td, Th, THead, Tr } from "@/components/ui/table";
import { formatDateFr, todayISO } from "@/lib/dates";
import { montant } from "@/lib/money";
import { formatEurosEcran } from "@/lib/modeDiscret";
import { Can } from "@/modules/auth-roles/components/Can";
import { STATUTS_LOGEMENT } from "@/modules/documents/domain/logement";
import { useConducteurs } from "@/modules/societes/hooks/useConducteurs";
import { LIBELLES_STATUT, STATUTS_DEVIS } from "../domain/devis";
import { CRITERES_DEVIS_VIDES, filtrerDevis, tauxConversion, type CriteresDevis } from "../domain/liste";
import { useListeDevis, useTotauxDevis } from "../hooks/useDevis";
import { BadgeStatutDevis } from "./BadgeStatutDevis";

function Filtre({ id, libelle, valeur, onChange, options }: { id: string; libelle: string; valeur: string; onChange: (v: string) => void; options: { valeur: string; libelle: string }[] }) {
  return (
    <>
      <label htmlFor={id} className="sr-only">{libelle}</label>
      <Select id={id} className="max-w-48" value={valeur} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => <option key={o.valeur} value={o.valeur}>{o.libelle}</option>)}
      </Select>
    </>
  );
}

const unique = (valeurs: (string | null)[]) => [...new Set(valeurs.filter((v): v is string => !!v))].sort((a, b) => a.localeCompare(b, "fr"));

export function PageDevis() {
  const devis = useListeDevis();
  const totaux = useTotauxDevis();
  const conducteurs = useConducteurs();
  const [c, setC] = useState<CriteresDevis>(CRITERES_DEVIS_VIDES);
  const parDevis = useMemo(() => new Map((totaux.data ?? []).map((t) => [t.devis_id, t])), [totaux.data]);
  const liste = devis.data ?? [];
  const filtres = filtrerDevis(liste, c);
  const filtre = (cle: keyof CriteresDevis) => (v: string) => setC({ ...c, [cle]: v });
  const clients = new Map(liste.filter((d) => d.client_id).map((d) => [d.client_id as string, d.client_nom]));

  return (
    <>
      <EnTetePage
        titre="Devis"
        sousTitre={`Taux de conversion du mois : ${tauxConversion(liste, todayISO().slice(0, 7))} %`}
        actions={
          <Can module="devis" action="creer">
            <Button asChild>
              <Link to="/devis/nouveau">Nouveau devis</Link>
            </Button>
          </Can>
        }
      />
      <div className="mb-3 flex flex-wrap gap-2">
        <label htmlFor="recherche-devis" className="sr-only">Rechercher un devis</label>
        <Input id="recherche-devis" type="search" className="max-w-sm" placeholder="N°, client, conducteur, lieu…" value={c.recherche} onChange={(e) => filtre("recherche")(e.target.value)} />
        <Filtre id="filtre-statut" libelle="Filtrer par statut" valeur={c.statut} onChange={filtre("statut")} options={[{ valeur: "", libelle: "Tous les statuts" }, ...STATUTS_DEVIS.map((s) => ({ valeur: s, libelle: LIBELLES_STATUT[s] }))]} />
        <Filtre id="filtre-conducteur" libelle="Filtrer par conducteur" valeur={c.conducteur} onChange={filtre("conducteur")} options={[{ valeur: "", libelle: "Tous les conducteurs" }, ...(conducteurs.data ?? []).map((k) => ({ valeur: k.id, libelle: k.actif ? k.nom : `${k.nom} (retiré)` }))]} />
        <Filtre id="filtre-logement" libelle="Filtrer par logement" valeur={c.logement} onChange={filtre("logement")} options={[{ valeur: "", libelle: "Tous les logements" }, ...STATUTS_LOGEMENT.map((s) => ({ valeur: s.code, libelle: s.libelle }))]} />
        <Filtre id="filtre-client" libelle="Filtrer par client" valeur={c.client} onChange={(v) => setC({ ...c, client: v, interlocuteur: "" })} options={[{ valeur: "", libelle: "Tous les clients" }, ...[...clients].sort((a, b) => a[1].localeCompare(b[1], "fr")).map(([id, nom]) => ({ valeur: id, libelle: nom }))]} />
        <Filtre
          id="filtre-interlocuteur"
          libelle="Filtrer par interlocuteur"
          valeur={c.interlocuteur}
          onChange={filtre("interlocuteur")}
          options={[{ valeur: "", libelle: "Tous les interlocuteurs" }, ...unique(liste.filter((d) => !c.client || d.client_id === c.client).map((d) => d.interlocuteur)).map((i) => ({ valeur: i, libelle: i }))]}
        />
      </div>
      {devis.isPending && <Chargement />}
      {devis.isError && <Erreur erreur={devis.error} reessayer={() => void devis.refetch()} />}
      {devis.isSuccess && filtres.length === 0 && <Vide message={liste.length ? "Aucun devis ne correspond." : "Aucun devis pour l'instant."} />}
      {filtres.length > 0 && (
        <Table>
          <THead>
            <Tr>
              <Th>N°</Th>
              <Th>Date</Th>
              <Th>Client</Th>
              <Th>Statut</Th>
              <Th className="text-right">HT</Th>
              <Th className="text-right">TTC</Th>
            </Tr>
          </THead>
          <TBody>
            {filtres.map((d) => {
              const t = parDevis.get(d.id);
              return (
                <Tr key={d.id}>
                  <Td>
                    <Link to={`/devis/${d.id}`} className="font-medium text-primary hover:underline">{d.numero}</Link>
                  </Td>
                  <Td>{formatDateFr(d.date)}</Td>
                  <Td>
                    {d.client_nom}
                    {d.interlocuteur && <span className="block text-xs text-muted-foreground">{d.interlocuteur}</span>}
                  </Td>
                  <Td><BadgeStatutDevis statut={d.statut} /></Td>
                  <Td className="text-right tabular-nums">{t ? formatEurosEcran(montant(t.ht)) : "—"}</Td>
                  <Td className="text-right tabular-nums">{t ? formatEurosEcran(montant(t.ttc)) : "—"}</Td>
                </Tr>
              );
            })}
          </TBody>
        </Table>
      )}
    </>
  );
}
