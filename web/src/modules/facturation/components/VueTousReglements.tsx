import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { Vide } from "@/components/etats/Etats";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BoutonConfirme } from "@/components/ui/confirmation";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { formatDateFr } from "@/lib/dates";
import { montant } from "@/lib/money";
import { formatEurosEcran, useModeDiscret } from "@/lib/modeDiscret";
import { usePermission } from "@/modules/auth-roles/hooks/useSession";
import { useChantiers } from "@/modules/chantiers/hooks/useChantiers";
import { MODES_REGLEMENT } from "@/modules/clients/domain/delais";
import type { Reglement } from "../api/factures";
import { criteresActifs, criteresDepuisRequete, criteresVersRequete, estRapproche, filtrerReglements, totalReglements, type CriteresReglements } from "../domain/filtresReglements";
import { libelleModeReglement } from "../domain/reglements";
import type { Solde } from "../domain/solde";
import { useSupprimerReglement } from "../hooks/useFactures";
import { SaisieReglement } from "./SaisieReglement";

/**
 * « Tous les règlements » (FAC-32) : « combien encaissé par chèque en août sur
 * ce chantier ? » sans ouvrir chaque dossier. Les critères vivent dans
 * l'adresse (`#factures/reglements?…` de l'ancien) et sont relus au chargement ;
 * le total est celui de la liste affichée.
 */
export function VueTousReglements({ soldes, reglements }: { soldes: readonly Solde[]; reglements: readonly Reglement[] }) {
  useModeDiscret();
  const location = useLocation();
  const navigate = useNavigate();
  const chantiers = useChantiers();
  const retirer = useSupprimerReglement();
  const peutModifier = usePermission("reglements", "modifier");
  const peutSupprimer = usePermission("reglements", "supprimer");
  const [enCours, setEnCours] = useState<string | null>(null);
  const c = criteresDepuisRequete(location.search);
  const poser = (cle: keyof CriteresReglements, v: string) => void navigate({ search: criteresVersRequete({ ...c, [cle]: v }) }, { replace: true });

  const parFacture = new Map(soldes.map((s) => [s.facture_id, s]));
  const tries = [...reglements].sort((a, b) => b.date.localeCompare(a.date));
  const liste = filtrerReglements(tries, (id) => (id ? parFacture.get(id) : null), c);
  const clients = [...new Set(soldes.map((s) => s.client_nom))].sort((a, b) => a.localeCompare(b, "fr"));
  const idsChantiers = new Set(soldes.map((s) => s.chantier_id).filter(Boolean));
  const optionsChantiers = (chantiers.data ?? []).filter((ch) => idsChantiers.has(ch.id));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex items-center gap-1 text-sm">Du <Input type="date" className="w-auto" value={c.du} onChange={(e) => poser("du", e.target.value)} /></label>
        <label className="flex items-center gap-1 text-sm">au <Input type="date" className="w-auto" value={c.au} onChange={(e) => poser("au", e.target.value)} /></label>
        <Select aria-label="Filtrer par client" className="max-w-56" value={c.client} onChange={(e) => poser("client", e.target.value)}>
          <option value="">Tous les clients</option>
          {clients.map((n) => <option key={n} value={n}>{n}</option>)}
        </Select>
        <Select aria-label="Filtrer par mode" className="max-w-48" value={c.mode} onChange={(e) => poser("mode", e.target.value)}>
          <option value="">Tous les modes</option>
          {/* « Avoir » n'est pas un mode de saisie, mais une façon dont une facture s'éteint : on doit la retrouver. */}
          {[...MODES_REGLEMENT, { code: "avoir", libelle: "Avoir" }].map((m) => <option key={m.code} value={m.code}>{m.libelle}</option>)}
        </Select>
        <Select aria-label="Filtrer par chantier" className="max-w-56" value={c.chantier} onChange={(e) => poser("chantier", e.target.value)}>
          <option value="">Tous les chantiers</option>
          {optionsChantiers.map((ch) => <option key={ch.id} value={ch.id}>{ch.nom}</option>)}
        </Select>
        <Select aria-label="Rapprochement" className="max-w-64" title="Le rapprochement se lit sur la référence saisie : n° de chèque, référence de virement…" value={c.rapprochement} onChange={(e) => poser("rapprochement", e.target.value)}>
          <option value="">Rapproché ou non</option>
          <option value="rapproche">Rapproché (référence saisie)</option>
          <option value="non_rapproche">Non rapproché (sans référence)</option>
        </Select>
        {criteresActifs(c) && <Button variant="ghost" size="sm" onClick={() => void navigate({ search: "" }, { replace: true })}>Effacer</Button>}
      </div>
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-4">
          <div>
            <p className="font-semibold">{liste.length} règlement{liste.length > 1 ? "s" : ""}{liste.length < reglements.length && <span className="font-normal text-muted-foreground"> sur {reglements.length}</span>}</p>
            <p className="text-sm text-muted-foreground">Total des règlements affichés</p>
          </div>
          <p className="text-xl font-semibold tabular-nums">{formatEurosEcran(totalReglements(liste))}</p>
        </CardContent>
      </Card>
      {liste.length === 0 ? (
        <Vide message="Aucun règlement ne répond à ces filtres." />
      ) : (
        <ul aria-label="Règlements" className="divide-y divide-border rounded-md border border-border">
          {liste.map((r) => {
            const f = parFacture.get(r.facture_id);
            const chantier = f?.chantier_id ? chantiers.data?.find((ch) => ch.id === f.chantier_id) : null;
            return (
              <li key={r.id} className="p-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span>
                    <span className="font-medium">{f?.client_nom ?? "— client inconnu —"}</span>
                    <span className="block text-sm text-muted-foreground">
                      {f?.numero ?? "Brouillon"} · {formatDateFr(r.date)} · {libelleModeReglement(r.mode)}{r.reference ? ` · réf. ${r.reference}` : ""}
                    </span>
                    {chantier && <span className="block text-sm text-muted-foreground">Chantier : {chantier.nom}</span>}
                  </span>
                  <span className="flex flex-col items-end gap-1">
                    <span className="tabular-nums font-semibold">{formatEurosEcran(montant(r.montant))}</span>
                    {estRapproche(r) ? <Badge variant="succes">Rapproché</Badge> : <Badge variant="alerte">Non rapproché</Badge>}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-2 text-sm">
                  {f && <Link className="text-primary hover:underline" to={`/factures/reglements/dossier?client=${encodeURIComponent(f.client_nom)}`}>Ouvrir le dossier</Link>}
                  {peutModifier && f && f.sens > 0 && r.mode !== "avoir" && <Button size="sm" variant="ghost" onClick={() => setEnCours(enCours === r.id ? null : r.id)}>✎ Modifier</Button>}
                  {peutSupprimer && <BoutonConfirme libelle="Supprimer" question="Supprimer ce règlement ?" enCours={retirer.isPending} onConfirmer={() => retirer.mutate(r.id)} />}
                </div>
                {enCours === r.id && f && (
                  <SaisieReglement
                    factureId={f.facture_id}
                    totalDu={Number(montant(f.ttc).minus(montant(f.acomptes)).toString())}
                    reglements={reglements.filter((x) => x.facture_id === f.facture_id)}
                    modeParDefaut={r.mode}
                    enCours={r}
                    fini={() => setEnCours(null)}
                  />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
