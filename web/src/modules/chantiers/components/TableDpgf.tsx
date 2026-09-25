import { Link } from "react-router";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BoutonConfirme } from "@/components/ui/confirmation";
import { Input, Select } from "@/components/ui/input";
import { Table, TBody, Td, Th, THead, Tr } from "@/components/ui/table";
import { montant } from "@/lib/money";
import { formatEurosEcran, useModeDiscret } from "@/lib/modeDiscret";
import type { LigneDpgfBase } from "../api/dpgf";
import type { TachePlanifiee } from "../api/planification";
import { estFactureeEntierement } from "../domain/dpgf";
import { quantiteDejaPlanifiee } from "../domain/planification";
import type { BrouillonLigneDpgf } from "../domain/saisie-dpgf";

interface Props {
  lignes: readonly LigneDpgfBase[];
  brouillon: (l: LigneDpgfBase) => BrouillonLigneDpgf;
  changer: (l: LigneDpgfBase, champ: "designation" | "quantite" | "prix_unitaire" | "metier", valeur: string) => void;
  erreurs: Record<string, string>;
  selection: ReadonlySet<string>;
  basculer: (id: string) => void;
  taches: readonly TachePlanifiee[];
  metiers: readonly string[];
  devisSource: ReadonlyMap<string, string>;
  onPlanifier: (l: LigneDpgfBase) => void;
  onSupprimer: (id: string) => void;
}

const nombreFr = (n: number | string) => String(n).replace(".", ",");

/** Le tableau du DPGF chiffré, modifiable en place (CHA-06, CHA-07). */
export function TableDpgf(p: Props) {
  useModeDiscret();
  return (
    <Table>
      <THead>
        <Tr>
          <Th><span className="sr-only">Sélection</span></Th>
          <Th>Désignation</Th>
          <Th className="text-right">Qté</Th>
          <Th className="text-right">PU HT</Th>
          <Th className="text-right">Montant HT</Th>
          <Th className="text-right">Déjà facturé</Th>
          <Th>Métier</Th>
          <Th>Planning</Th>
          <Th><span className="sr-only">Actions</span></Th>
        </Tr>
      </THead>
      <TBody>
        {p.lignes.map((l) => (l.type === "ligne" ? <Ligne key={l.id} l={l} {...p} /> : <Titre key={l.id} l={l} {...p} />))}
      </TBody>
    </Table>
  );
}

function Titre({ l, brouillon, changer, onSupprimer }: Props & { l: LigneDpgfBase }) {
  useModeDiscret();
  const b = brouillon(l);
  return (
    <Tr className="bg-muted/60">
      <Td />
      <Td colSpan={7}>
        <Input aria-label="Titre du chapitre" className={l.type === "chapitre" ? "font-semibold" : "italic"} value={b.designation} onChange={(e) => changer(l, "designation", e.target.value)} placeholder="Titre du chapitre" />
      </Td>
      <Td className="text-right">
        <BoutonConfirme libelle="Retirer" question="Retirer ce titre ?" onConfirmer={() => onSupprimer(l.id)} />
      </Td>
    </Tr>
  );
}

function Ligne({ l, brouillon, changer, erreurs, selection, basculer, taches, metiers, devisSource, onPlanifier, onSupprimer }: Props & { l: LigneDpgfBase }) {
  useModeDiscret();
  const b = brouillon(l);
  const complete = estFactureeEntierement(l);
  const siennes = taches.filter((t) => t.dpgf_ligne_id === l.id);
  const deja = quantiteDejaPlanifiee(siennes);
  const total = montant(l.quantite);
  const numeroDevis = l.devis_source_id ? devisSource.get(l.devis_source_id) : undefined;
  const erreur = (champ: string) => erreurs[`${l.id}.${champ}`];
  return (
    <Tr className={complete ? "opacity-70" : ""}>
      <Td>
        <input type="checkbox" aria-label={`Sélectionner ${l.designation || "la ligne"} pour facturer`} checked={selection.has(l.id)} disabled={complete} onChange={() => basculer(l.id)} title={complete ? "Déjà facturé à 100 %" : "Sélectionner pour facturer"} />
      </Td>
      <Td>
        <Input aria-label="Désignation" aria-invalid={!!erreur("designation")} value={b.designation} onChange={(e) => changer(l, "designation", e.target.value)} />
        {numeroDevis && <Badge variant="neutre" className="mt-1" title={`Ajoutée depuis le devis ${numeroDevis}`}>Devis {numeroDevis}</Badge>}
        {erreur("designation") && <p className="text-xs text-destructive">{erreur("designation")}</p>}
      </Td>
      <Td>
        <Input aria-label="Quantité" aria-invalid={!!erreur("quantite")} inputMode="decimal" className="w-20 text-right" value={b.quantite} disabled={b.figee} onChange={(e) => changer(l, "quantite", e.target.value)} />
      </Td>
      <Td>
        <Input aria-label="Prix unitaire HT" aria-invalid={!!erreur("prix_unitaire")} inputMode="decimal" className="w-24 text-right" value={b.prix_unitaire} disabled={b.figee} onChange={(e) => changer(l, "prix_unitaire", e.target.value)} />
      </Td>
      <Td className="text-right tabular-nums">{formatEurosEcran(montant(l.quantite).times(montant(l.prix_unitaire)))}</Td>
      <Td className="text-right tabular-nums">{nombreFr(l.avancement_cumule)} %</Td>
      <Td>
        <Select aria-label="Métier" className="w-36 text-xs" value={b.metier} onChange={(e) => changer(l, "metier", e.target.value)}>
          <option value="">— Non précisé —</option>
          {[...new Set([...metiers, ...(l.metier ? [l.metier] : [])])].map((m) => (
            <option key={m}>{m}</option>
          ))}
        </Select>
      </Td>
      <Td>
        <div className="flex flex-wrap items-center gap-1 text-xs">
          {siennes.length > 0 && <span title={`${deja} / ${total} planifié`}>{nombreFr(deja.toString())}/{nombreFr(total.toString())}</span>}
          {siennes.map((t) =>
            t.bon_commande_id ? (
              <Link key={t.id} className="text-primary hover:underline" to={`/commandes/${t.bon_commande_id}`} title="Ouvrir le bon de commande">
                ✓ {nombreFr(t.quantite_planifiee ?? 0)}
              </Link>
            ) : null
          )}
          {total.gt(0) && total.gt(deja) && (
            <Button size="sm" variant="secondary" onClick={() => onPlanifier(l)}>Planifier</Button>
          )}
        </div>
      </Td>
      <Td className="text-right">{!b.figee && <BoutonConfirme libelle="Retirer" question="Retirer cette ligne ?" onConfirmer={() => onSupprimer(l.id)} />}</Td>
    </Tr>
  );
}
