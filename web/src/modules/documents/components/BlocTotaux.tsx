import { useState } from "react";
import { Input, Select } from "@/components/ui/input";
import { formatEuros, formatTaux, type Montant } from "@/lib/money";
import { formatEurosEcran } from "@/lib/modeDiscret";
import type { LigneEdition } from "../domain/lignes";
import { remiseDepuisCible, soldeAPayer, totauxDocument } from "../domain/totaux";

interface Props {
  lignes: readonly LigneEdition[];
  remise: string;
  onRemise?: (pct: string) => void;
  /** Facture : acomptes et retenue de garantie. */
  deductions?: { acomptes: unknown; retenuePct: unknown };
  signe?: 1 | -1;
  /** La pièce imprimée porte ses montants, même en mode discret (TRV-05). */
  imprime?: boolean;
}

function Ligne({ libelle, valeur, fort = false, format }: { libelle: string; valeur: Montant; fort?: boolean; format: (m: Montant) => string }) {
  return (
    <div className={`flex justify-between gap-6 ${fort ? "text-base font-semibold" : "text-sm"}`}>
      <dt>{libelle}</dt>
      <dd className="tabular-nums">{format(valeur)}</dd>
    </div>
  );
}

/** Totaux du document ; le détail par taux ne s'affiche que s'il y a plus d'un taux. */
export function BlocTotaux({ lignes, remise, onRemise, deductions, signe = 1, imprime = false }: Props) {
  const format = imprime ? formatEuros : formatEurosEcran;
  const [mode, setMode] = useState<"pct" | "ht" | "ttc">("pct");
  const [cible, setCible] = useState("");
  const lu = lignes.map((l) => ({ type: l.type, quantite: l.quantite, prix_unitaire: l.prix_unitaire, tva: l.tva }));
  const t = totauxDocument(lu, remise);
  const s = (m: Montant) => (signe === -1 ? m.neg() : m);
  const unSeulTaux = t.ventilation.length === 1 ? t.ventilation[0] : undefined;
  const solde = deductions ? soldeAPayer(s(t.ttc), deductions.acomptes, deductions.retenuePct) : null;

  function saisirCible(v: string) {
    setCible(v);
    if (mode === "pct") return onRemise?.(v);
    const pct = remiseDepuisCible(lu, v, mode);
    if (pct) onRemise?.(pct.toString().replace(".", ","));
  }

  return (
    <div className="ml-auto flex w-full max-w-sm flex-col gap-2 rounded-md border border-border p-3">
      {onRemise && (
        <div className="flex items-end gap-2">
          <label className="flex flex-1 flex-col gap-1 text-sm">
            Remise
            <Input inputMode="decimal" value={mode === "pct" ? remise : cible} onChange={(e) => saisirCible(e.target.value)} aria-describedby="remise-aide" />
          </label>
          <Select aria-label="Saisir la remise en" className="w-32" value={mode} onChange={(e) => { setMode(e.target.value as "pct" | "ht" | "ttc"); setCible(""); }}>
            <option value="pct">%</option>
            <option value="ht">HT cible</option>
            <option value="ttc">TTC cible</option>
          </Select>
        </div>
      )}
      {onRemise && mode !== "pct" && <p id="remise-aide" className="text-xs text-muted-foreground">Remise appliquée : {formatTaux(t.remisePct)}</p>}
      <dl aria-label="Totaux du document" className="flex flex-col gap-1">
        {t.remisePct.gt(0) && (
          <>
            <Ligne format={format} libelle="Total HT avant remise" valeur={s(t.htAvant)} />
            <Ligne format={format} libelle={`Remise ${formatTaux(t.remisePct)}`} valeur={s(t.remiseMontantHT).neg()} />
          </>
        )}
        <Ligne format={format} libelle="Total HT" valeur={s(t.ht)} />
        {unSeulTaux ? (
          <Ligne format={format} libelle={`Total TVA ${formatTaux(unSeulTaux.taux)}`} valeur={s(t.tva)} />
        ) : (
          <>
            {t.ventilation.map((v) => (
              <Ligne format={format} key={v.taux.toString()} libelle={`TVA ${formatTaux(v.taux)} sur ${format(s(v.base))}`} valeur={s(v.montant)} />
            ))}
            <Ligne format={format} libelle="Total TVA" valeur={s(t.tva)} />
          </>
        )}
        <Ligne format={format} libelle="Total TTC" valeur={s(t.ttc)} fort />
        {solde?.aDesDeductions && (
          <>
            {solde.acomptes.gt(0) && <Ligne format={format} libelle="Acompte déjà versé" valeur={solde.acomptes.neg()} />}
            {solde.retenueMontant.gt(0) && <Ligne format={format} libelle={`Retenue de garantie (${formatTaux(solde.retenuePourcentage)})`} valeur={solde.retenueMontant.neg()} />}
          </>
        )}
        {solde && <Ligne format={format} libelle="Net à payer" valeur={solde.netAPayer} fort />}
      </dl>
    </div>
  );
}
