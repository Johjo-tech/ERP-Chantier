import { useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { Chargement, Erreur, Vide } from "@/components/etats/Etats";
import { EnTetePage } from "@/components/page/EnTetePage";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TBody, Td, Th, THead, Tr } from "@/components/ui/table";
import { messageErreur } from "@/lib/erreurs";
import { montant, somme } from "@/lib/money";
import { formatEurosEcran, useModeDiscret } from "@/lib/modeDiscret";
import { useChantier, useDpgf } from "@/modules/chantiers/hooks/useChantiers";
import { montantLigneDpgf } from "@/modules/chantiers/domain/dpgf";
import { REGLAGES_DEFAUT } from "@/modules/societes/domain/reglages";
import { useReglages } from "@/modules/societes/hooks/useReglages";
import { montantAFacturer, nouvelAvancement, refusSituation, type LigneSituation } from "../domain/situation";
import { useFacturerSituation } from "../hooks/useFactures";

const PALIERS = [25, 50, 75, 100];

/** Situation de travaux : un % cumulé par ligne du DPGF, facturé comme un brouillon. */
export function PageSituation() {
  useModeDiscret();
  const { id } = useParams();
  const chantier = useChantier(id);
  const dpgf = useDpgf(id ?? "");
  const reglages = useReglages();
  const facturer = useFacturerSituation();
  const navigate = useNavigate();
  const [saisies, setSaisies] = useState<Record<string, string>>({});
  // « Facturer la sélection » du DPGF (CHA-06) : seules les lignes cochées, si la fiche en transmet.
  const [params] = useSearchParams();
  const selectionBrute = params.get("lignes");

  const lignes: LigneSituation[] = useMemo(() => {
    const selection = selectionBrute?.split(",").filter(Boolean) ?? null;
    return (dpgf.data ?? [])
      .filter((l) => l.type === "ligne" && l.avancement_cumule < 100 && (!selection || selection.includes(l.id)))
      .map((l) => {
        const apres = nouvelAvancement(l.avancement_cumule, saisies[l.id] ?? "");
        return { dpgfId: l.id, designation: l.designation, avant: montant(l.avancement_cumule), apres, aFacturer: montantAFacturer(l, apres) };
      });
  }, [dpgf.data, saisies, selectionBrute]);

  if (chantier.isPending || dpgf.isPending) return <Chargement />;
  if (chantier.isError) return <Erreur erreur={chantier.error} reessayer={() => void chantier.refetch()} />;
  if (dpgf.isError) return <Erreur erreur={dpgf.error} reessayer={() => void dpgf.refetch()} />;
  const c = chantier.data;
  const total = somme(lignes.map((l) => l.aFacturer));
  const refus = refusSituation(lignes);

  return (
    <div className="flex flex-col gap-4">
      <EnTetePage titre="Situation de travaux" sousTitre={c.nom} />
      {lignes.length === 0 ? (
        <Vide message="Toutes les lignes du DPGF sont facturées à 100 %, ou le DPGF est vide." />
      ) : (
        <Table>
          <THead>
            <Tr>
              <Th>Ligne</Th>
              <Th className="text-right">Montant HT</Th>
              <Th className="text-right">Déjà facturé</Th>
              <Th>Nouvel avancement cumulé</Th>
              <Th className="text-right">À facturer</Th>
            </Tr>
          </THead>
          <TBody>
            {lignes.map((l) => {
              const dpgfLigne = dpgf.data.find((x) => x.id === l.dpgfId);
              return (
                <Tr key={l.dpgfId}>
                  <Td>{l.designation}</Td>
                  <Td className="text-right tabular-nums">{dpgfLigne ? formatEurosEcran(montantLigneDpgf(dpgfLigne)) : "—"}</Td>
                  <Td className="text-right tabular-nums">{l.avant.toString().replace(".", ",")} %</Td>
                  <Td>
                    <div className="flex items-center gap-1">
                      <Input aria-label={`Avancement cumulé, ${l.designation}`} inputMode="decimal" className="w-20" value={saisies[l.dpgfId] ?? ""} placeholder={l.avant.toString()} onChange={(e) => setSaisies({ ...saisies, [l.dpgfId]: e.target.value })} />
                      {/* Seuls les paliers au-dessus du déjà facturé sont proposés. */}
                      {PALIERS.filter((p) => l.avant.lt(p)).map((p) => (
                        <Button key={p} size="sm" variant="ghost" onClick={() => setSaisies({ ...saisies, [l.dpgfId]: String(p) })}>{p} %</Button>
                      ))}
                    </div>
                  </Td>
                  <Td className="text-right tabular-nums">{formatEurosEcran(l.aFacturer)}</Td>
                </Tr>
              );
            })}
          </TBody>
        </Table>
      )}
      <p className="text-right font-semibold">Total HT à facturer : {formatEurosEcran(total)}</p>
      {facturer.isError && <Alert variant="erreur">{messageErreur(facturer.error)}</Alert>}
      <div className="flex gap-2">
        <Button
          disabled={!!refus || facturer.isPending}
          onClick={() =>
            facturer.mutate(
              { chantier: c, lignes, tvaDefaut: (reglages.data ?? REGLAGES_DEFAUT).tvaDefaut },
              { onSuccess: (factureId) => void navigate(`/factures/${factureId}`, { state: { message: "Situation créée en brouillon. Vérifiez-la puis émettez-la." } }) }
            )
          }
        >
          Créer la facture de situation
        </Button>
        <Button variant="ghost" asChild><Link to={`/chantiers/${c.id}`}>Annuler</Link></Button>
      </div>
      {refus && lignes.length > 0 && <p className="text-sm text-muted-foreground">{refus}</p>}
    </div>
  );
}
