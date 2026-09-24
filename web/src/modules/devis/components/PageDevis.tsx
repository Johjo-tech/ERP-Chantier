import { useMemo, useState } from "react";
import { Link } from "react-router";
import { Chargement, Erreur, Vide } from "@/components/etats/Etats";
import { EnTetePage } from "@/components/page/EnTetePage";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Table, TBody, Td, Th, THead, Tr } from "@/components/ui/table";
import { formatDateFr } from "@/lib/dates";
import { formatEuros, montant } from "@/lib/money";
import { correspond } from "@/lib/recherche";
import { Can } from "@/modules/auth-roles/components/Can";
import { LIBELLES_STATUT, STATUTS_DEVIS } from "../domain/devis";
import { useListeDevis, useTotauxDevis } from "../hooks/useDevis";
import { BadgeStatutDevis } from "./BadgeStatutDevis";

export function PageDevis() {
  const devis = useListeDevis();
  const totaux = useTotauxDevis();
  const [recherche, setRecherche] = useState("");
  const [statut, setStatut] = useState("");
  const parDevis = useMemo(() => new Map((totaux.data ?? []).map((t) => [t.devis_id, t])), [totaux.data]);

  const filtres = (devis.data ?? []).filter(
    (d) => correspond(recherche, d.numero, d.client_nom, d.interlocuteur, d.conducteur, d.adresse_locataire, d.ville) && (!statut || d.statut === statut)
  );

  return (
    <>
      <EnTetePage
        titre="Devis"
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
        <Input id="recherche-devis" type="search" className="max-w-sm" placeholder="N°, client, conducteur, lieu…" value={recherche} onChange={(e) => setRecherche(e.target.value)} />
        <label htmlFor="filtre-statut" className="sr-only">Filtrer par statut</label>
        <Select id="filtre-statut" className="max-w-48" value={statut} onChange={(e) => setStatut(e.target.value)}>
          <option value="">Tous les statuts</option>
          {STATUTS_DEVIS.map((s) => <option key={s} value={s}>{LIBELLES_STATUT[s]}</option>)}
        </Select>
      </div>
      {devis.isPending && <Chargement />}
      {devis.isError && <Erreur erreur={devis.error} reessayer={() => void devis.refetch()} />}
      {devis.isSuccess && filtres.length === 0 && <Vide message={recherche || statut ? "Aucun devis ne correspond." : "Aucun devis pour l'instant."} />}
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
                  <Td className="text-right tabular-nums">{t ? formatEuros(montant(t.ht)) : "—"}</Td>
                  <Td className="text-right tabular-nums">{t ? formatEuros(montant(t.ttc)) : "—"}</Td>
                </Tr>
              );
            })}
          </TBody>
        </Table>
      )}
    </>
  );
}
