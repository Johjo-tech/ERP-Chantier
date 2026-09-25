import { Link, useSearchParams } from "react-router";
import { Vide } from "@/components/etats/Etats";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { formatDateFr } from "@/lib/dates";
import { montant } from "@/lib/money";
import { formatEurosEcran, useModeDiscret } from "@/lib/modeDiscret";
import { etatDepuisSolde, ETATS_REGLEMENT, facturesParEtat, totalDu, TRIS_REGLEMENT, type CriteresParFacture, type EtatFiltre, type Solde, type TriFactures } from "../domain/solde";
import { BadgeEtat } from "./BadgeEtat";
import { DU_A_RECLAMER_EUR } from "../domain/reglements";

/**
 * « Par facture » (FAC-31, app.js l. 10838) : état, client, échéance du… au
 * (sur l'échéance, à défaut la date), tris, et le cartouche « reste à
 * encaisser » calculé sur la liste AFFICHÉE. Avoirs exclus. Les critères
 * vivent dans l'adresse : « En retard » se partage d'un lien.
 */
export function VueParFacture({ soldes }: { soldes: readonly Solde[] }) {
  useModeDiscret();
  const [params, setParams] = useSearchParams();
  const c: CriteresParFacture = {
    etat: (params.get("etat") ?? "") as EtatFiltre,
    client: params.get("client") ?? "",
    du: params.get("du") ?? "",
    au: params.get("au") ?? "",
    tri: (TRIS_REGLEMENT.some((t) => t.valeur === params.get("tri")) ? params.get("tri") : "retard") as TriFactures,
  };
  const poser = (cle: keyof CriteresParFacture, v: string) => {
    const suivant = new URLSearchParams(params);
    if (v) suivant.set(cle, v);
    else suivant.delete(cle);
    setParams(suivant, { replace: true });
  };
  const lignes = facturesParEtat(soldes, c);
  const enRetard = lignes.filter((s) => s.en_retard).length;
  const clients = [...new Set(soldes.filter((s) => s.sens > 0).map((s) => s.client_nom))].sort((a, b) => a.localeCompare(b, "fr"));
  const actif = !!(c.etat || c.client || c.du || c.au);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-2">
        <Select aria-label="Filtrer par état" className="max-w-56" value={c.etat} onChange={(e) => poser("etat", e.target.value)}>
          {ETATS_REGLEMENT.map((x) => <option key={x.valeur} value={x.valeur}>{x.libelle}</option>)}
        </Select>
        <Select aria-label="Filtrer par client" className="max-w-56" value={c.client} onChange={(e) => poser("client", e.target.value)}>
          <option value="">Tous les clients</option>
          {clients.map((n) => <option key={n} value={n}>{n}</option>)}
        </Select>
        <label className="flex items-center gap-1 text-sm">Échéance du <Input type="date" className="w-auto" value={c.du} onChange={(e) => poser("du", e.target.value)} /></label>
        <label className="flex items-center gap-1 text-sm">au <Input type="date" className="w-auto" value={c.au} onChange={(e) => poser("au", e.target.value)} /></label>
        <Select aria-label="Ordre d'affichage" className="max-w-60" value={c.tri} onChange={(e) => poser("tri", e.target.value)}>
          {TRIS_REGLEMENT.map((t) => <option key={t.valeur} value={t.valeur}>{t.libelle}</option>)}
        </Select>
        {actif && <Button variant="ghost" size="sm" onClick={() => setParams({}, { replace: true })}>Effacer</Button>}
      </div>
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-4">
          <div>
            <p className="font-semibold">{lignes.length} facture{lignes.length > 1 ? "s" : ""}</p>
            <p className="text-sm text-muted-foreground">{enRetard ? `dont ${enRetard} en retard` : "aucune en retard"}</p>
          </div>
          <div className="text-right">
            <p className="text-xl font-semibold tabular-nums">{formatEurosEcran(totalDu(lignes))}</p>
            <p className="text-sm text-muted-foreground">reste à encaisser</p>
          </div>
        </CardContent>
      </Card>
      {lignes.length === 0 ? (
        <Vide message="Aucune facture dans cet état." />
      ) : (
        <ul aria-label="Factures" className="divide-y divide-border rounded-md border border-border">
          {lignes.map((s) => (
            <li key={s.facture_id} className="flex flex-wrap items-center justify-between gap-3 p-3">
              <span>
                <span className="font-medium">{s.client_nom}</span>
                <span className="block text-sm text-muted-foreground">
                  {s.numero} · {formatDateFr(s.date)}{s.echeance ? ` · échéance ${formatDateFr(s.echeance)}` : ""}
                </span>
                <span className="block text-sm text-muted-foreground">
                  {formatEurosEcran(montant(s.ttc))} TTC · {formatEurosEcran(montant(s.paye))} encaissé{s.du > DU_A_RECLAMER_EUR ? ` · ${formatEurosEcran(montant(s.du))} dû` : ""}
                </span>
              </span>
              <span className="flex flex-col items-end gap-1">
                <BadgeEtat etat={etatDepuisSolde(s)} />
                {s.en_retard && <Badge variant="danger">Retard {s.jours_retard} j</Badge>}
                <span className="flex gap-2 text-sm">
                  <Link className="text-primary hover:underline" to={`/factures/reglements/dossier?client=${encodeURIComponent(s.client_nom)}`}>Ouvrir le dossier</Link>
                  <Link className="text-primary hover:underline" to={`/factures/${s.facture_id}`}>Voir la facture</Link>
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
