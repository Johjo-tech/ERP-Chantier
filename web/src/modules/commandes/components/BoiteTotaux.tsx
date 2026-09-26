import { formatEuros, formatTaux } from "@/lib/money";
import { totauxDocument, type LigneMontant } from "@/modules/documents/domain/totaux";

/**
 * La boîte des totaux (`totalsBoxInnerHTML`) : HT, TVA — détaillée par taux
 * s'il y en a plusieurs —, TTC. Les montants y sont écrits comme `money()`,
 * hors mode discret, comme dans l'ancien.
 */
export function BoiteTotaux({ lignes, id, label }: { lignes: readonly LigneMontant[]; id: string; label?: string }) {
  const t = totauxDocument(lignes, 0);
  const v = t.ventilation;
  const tva =
    v.length > 1
      ? [...v.map((p) => ({ libelle: `TVA ${formatTaux(p.taux)} sur ${formatEuros(p.base)}`, montant: p.montant })), { libelle: "Total TVA", montant: t.tva }]
      : [{ libelle: v[0] ? `TVA ${formatTaux(v[0].taux)}` : "TVA", montant: t.tva }];
  return (
    <div className="totals-box" id={id} style={{ marginTop: "10px" }} aria-label={label}>
      <div>Total HT <b>{formatEuros(t.htAvant)}</b></div>
      {tva.map((l) => <div key={l.libelle}>{l.libelle} <b>{formatEuros(l.montant)}</b></div>)}
      <div>Total TTC <b>{formatEuros(t.ttc)}</b></div>
    </div>
  );
}
