import { useMemo, useState } from "react";
import { Link } from "react-router";
import { Chargement, Erreur, Vide } from "@/components/etats/Etats";
import { EnTetePage } from "@/components/page/EnTetePage";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Table, TBody, Td, Th, THead, Tr } from "@/components/ui/table";
import { formatDateFr } from "@/lib/dates";
import { montant } from "@/lib/money";
import { formatEurosEcran, useModeDiscret } from "@/lib/modeDiscret";
import { correspond } from "@/lib/recherche";
import { Can } from "@/modules/auth-roles/components/Can";
import { usePermission } from "@/modules/auth-roles/hooks/useSession";
import { libelleStatutChantier, libelleTypeChantier, TYPES_CHANTIER, varianteStatutChantier } from "../domain/chantier";
import { useAvancements, useChantiers, useCompteursChantiers, usePeutVoirDpgf } from "../hooks/useChantiers";

/**
 * La liste des chantiers (CHA-01) : recherche, filtres conducteur et type ;
 * total du DPGF et part facturée pour qui voit les prix ; nombre de
 * comptes-rendus, devis et factures. En tableau plutôt qu'en cartes A4
 * (D-CHA-01) : mêmes informations, lisibles au clavier et triées.
 */
export function PageChantiers() {
  useModeDiscret();
  const chantiers = useChantiers();
  const avancements = useAvancements();
  const compteurs = useCompteursChantiers();
  const voitDpgf = usePeutVoirDpgf();
  const voitDevis = usePermission("devis", "voir");
  const voitFactures = usePermission("factures", "voir");
  const [recherche, setRecherche] = useState("");
  const [conducteur, setConducteur] = useState("");
  const [type, setType] = useState("");

  const parChantier = useMemo(() => new Map((avancements.data ?? []).map((a) => [a.chantier_id, a])), [avancements.data]);
  const conducteurs = useMemo(
    () => [...new Set((chantiers.data ?? []).map((c) => c.conducteur).filter((c): c is string => !!c))].sort(),
    [chantiers.data]
  );
  const filtres = (chantiers.data ?? []).filter(
    (c) =>
      correspond(recherche, c.nom, c.client_nom, c.ville, c.adresse, c.code_postal, libelleTypeChantier(c.type)) &&
      (!conducteur || c.conducteur === conducteur) &&
      // Comme l'ancien filtre : comparaison au code stocké (app.js l. 13132).
      (!type || c.type === type)
  );
  const filtre = recherche || conducteur || type;

  return (
    <>
      <EnTetePage
        titre="Chantiers"
        actions={
          <Can module="chantiers" action="creer">
            <Button asChild><Link to="/chantiers/nouveau">Nouveau chantier</Link></Button>
          </Can>
        }
      />
      <div className="mb-3 flex flex-wrap gap-2">
        <label htmlFor="recherche-chantiers" className="sr-only">Rechercher un chantier</label>
        <Input id="recherche-chantiers" type="search" className="max-w-sm" placeholder="Rechercher (nom, client, adresse…)" value={recherche} onChange={(e) => setRecherche(e.target.value)} />
        <label htmlFor="filtre-conducteur" className="sr-only">Filtrer par conducteur</label>
        <Select id="filtre-conducteur" className="max-w-56" value={conducteur} onChange={(e) => setConducteur(e.target.value)}>
          <option value="">Tous les conducteurs</option>
          {conducteurs.map((c) => <option key={c}>{c}</option>)}
        </Select>
        <label htmlFor="filtre-type" className="sr-only">Filtrer par type</label>
        <Select id="filtre-type" className="max-w-56" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">Tous les chantiers</option>
          {TYPES_CHANTIER.map((t) => <option key={t.code} value={t.code}>{t.libelle}</option>)}
        </Select>
      </div>
      {chantiers.isPending && <Chargement />}
      {chantiers.isError && <Erreur erreur={chantiers.error} reessayer={() => void chantiers.refetch()} />}
      {avancements.isError && <Erreur erreur={avancements.error} reessayer={() => void avancements.refetch()} />}
      {compteurs.isError && <Erreur erreur={compteurs.error} reessayer={() => void compteurs.refetch()} />}
      {chantiers.isSuccess && filtres.length === 0 && <Vide message={filtre ? "Aucun chantier ne correspond." : "Aucun chantier pour l'instant."} />}
      {filtres.length > 0 && (
        <Table>
          <THead>
            <Tr>
              <Th>Chantier</Th>
              <Th>Client</Th>
              <Th>Période</Th>
              <Th>Conducteur</Th>
              {voitDpgf && <Th className="text-right">DPGF HT</Th>}
              {voitDpgf && <Th className="text-right">Facturé</Th>}
              <Th className="text-right" title="Comptes-rendus">CR</Th>
              {voitDevis && <Th className="text-right">Devis</Th>}
              {voitFactures && <Th className="text-right">Factures</Th>}
            </Tr>
          </THead>
          <TBody>
            {filtres.map((c) => {
              const a = parChantier.get(c.id);
              const n = compteurs.data?.get(c.id);
              const total = montant(a?.montant_total ?? 0);
              const pct = total.gt(0) ? Number(montant(a?.montant_facture ?? 0).div(total).times(100).round(0)) : 0;
              return (
                <Tr key={c.id}>
                  <Td>
                    <Link to={`/chantiers/${c.id}`} className="font-medium text-primary hover:underline">{c.nom}</Link>
                    <Badge variant="neutre" className="ml-2">{libelleTypeChantier(c.type)}</Badge>
                    <Badge variant={varianteStatutChantier(c.statut)} className="ml-1">{libelleStatutChantier(c.statut)}</Badge>
                    <span className="block text-xs text-muted-foreground">{[c.code_postal, c.ville].filter(Boolean).join(" ")}</span>
                  </Td>
                  <Td>{c.client_nom || "—"}</Td>
                  <Td>{formatDateFr(c.date_debut)} → {formatDateFr(c.date_fin)}</Td>
                  <Td>{c.conducteur || "—"}</Td>
                  {voitDpgf && <Td className="text-right tabular-nums">{a ? formatEurosEcran(total) : "—"}</Td>}
                  {voitDpgf && <Td className="text-right tabular-nums">{a && total.gt(0) ? `${pct} %` : "—"}</Td>}
                  <Td className="text-right tabular-nums">{n?.comptesRendus ?? 0}</Td>
                  {voitDevis && <Td className="text-right tabular-nums">{n?.devis ?? 0}</Td>}
                  {voitFactures && <Td className="text-right tabular-nums">{n?.factures ?? 0}</Td>}
                </Tr>
              );
            })}
          </TBody>
        </Table>
      )}
    </>
  );
}
