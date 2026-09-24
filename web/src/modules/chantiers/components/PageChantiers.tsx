import { useMemo, useState } from "react";
import { Link } from "react-router";
import { Chargement, Erreur, Vide } from "@/components/etats/Etats";
import { EnTetePage } from "@/components/page/EnTetePage";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Table, TBody, Td, Th, THead, Tr } from "@/components/ui/table";
import { formatDateFr } from "@/lib/dates";
import { formatEuros, montant } from "@/lib/money";
import { correspond } from "@/lib/recherche";
import { Can } from "@/modules/auth-roles/components/Can";
import { libelleTypeChantier } from "../domain/chantier";
import { useAvancements, useChantiers, usePeutVoirDpgf } from "../hooks/useChantiers";

export function PageChantiers() {
  const chantiers = useChantiers();
  const avancements = useAvancements();
  const voitDpgf = usePeutVoirDpgf();
  const [recherche, setRecherche] = useState("");
  const [conducteur, setConducteur] = useState("");

  const parChantier = useMemo(
    () => new Map((avancements.data ?? []).map((a) => [a.chantier_id, a])),
    [avancements.data]
  );
  const conducteurs = useMemo(
    () => [...new Set((chantiers.data ?? []).map((c) => c.conducteur).filter((c): c is string => !!c))].sort(),
    [chantiers.data]
  );
  const filtres = (chantiers.data ?? []).filter(
    (c) =>
      correspond(recherche, c.nom, c.client_nom, c.ville, c.adresse, libelleTypeChantier(c.type)) && (!conducteur || c.conducteur === conducteur)
  );

  return (
    <>
      <EnTetePage
        titre="Chantiers"
        actions={
          <Can module="chantiers" action="creer">
            <Button asChild>
              <Link to="/chantiers/nouveau">Nouveau chantier</Link>
            </Button>
          </Can>
        }
      />
      <div className="mb-3 flex flex-wrap gap-2">
        <label htmlFor="recherche-chantiers" className="sr-only">
          Rechercher un chantier
        </label>
        <Input
          id="recherche-chantiers"
          type="search"
          className="max-w-sm"
          placeholder="Rechercher (nom, client, ville…)"
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
        />
        <label htmlFor="filtre-conducteur" className="sr-only">
          Filtrer par conducteur
        </label>
        <Select id="filtre-conducteur" className="max-w-56" value={conducteur} onChange={(e) => setConducteur(e.target.value)}>
          <option value="">Tous les conducteurs</option>
          {conducteurs.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </Select>
      </div>
      {chantiers.isPending && <Chargement />}
      {chantiers.isError && <Erreur erreur={chantiers.error} reessayer={() => void chantiers.refetch()} />}
      {avancements.isError && <Erreur erreur={avancements.error} reessayer={() => void avancements.refetch()} />}
      {chantiers.isSuccess && filtres.length === 0 && (
        <Vide message={recherche || conducteur ? "Aucun chantier ne correspond." : "Aucun chantier pour l'instant."} />
      )}
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
            </Tr>
          </THead>
          <TBody>
            {filtres.map((c) => {
              const a = parChantier.get(c.id);
              const total = montant(a?.montant_total ?? 0);
              const pct = total.gt(0) ? Number(montant(a?.montant_facture ?? 0).div(total).times(100).round(0)) : 0;
              return (
                <Tr key={c.id}>
                  <Td>
                    <Link to={`/chantiers/${c.id}`} className="font-medium text-primary hover:underline">
                      {c.nom}
                    </Link>
                    <Badge variant="neutre" className="ml-2">{libelleTypeChantier(c.type)}</Badge>
                    <span className="block text-xs text-muted-foreground">{[c.code_postal, c.ville].filter(Boolean).join(" ")}</span>
                  </Td>
                  <Td>{c.client_nom || "—"}</Td>
                  <Td>
                    {formatDateFr(c.date_debut)} → {formatDateFr(c.date_fin)}
                  </Td>
                  <Td>{c.conducteur || "—"}</Td>
                  {voitDpgf && <Td className="text-right tabular-nums">{a ? formatEuros(total) : "—"}</Td>}
                  {voitDpgf && <Td className="text-right tabular-nums">{a && total.gt(0) ? `${pct} %` : "—"}</Td>}
                </Tr>
              );
            })}
          </TBody>
        </Table>
      )}
    </>
  );
}
