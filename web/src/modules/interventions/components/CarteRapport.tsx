import { useState } from "react";
import { Link } from "react-router";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BoutonConfirme } from "@/components/ui/confirmation";
import { formatDateFr } from "@/lib/dates";
import { Can } from "@/modules/auth-roles/components/Can";
import { usePermission } from "@/modules/auth-roles/hooks/useSession";
import type { RapportDeLaListe } from "../api/rapports";
import { libelleMetier } from "../domain/rapport";
import { useLierBon, useSupprimerRapport } from "../hooks/useRapports";
import { ActionsTransformation } from "./ActionsTransformation";
import { LienBon } from "./LienBon";

const LOGEMENT: Record<string, string> = { occupé: "Occupé", vacant: "Vacant", commune: "Partie commune" };

/** Un rapport dans la liste, avec ses liens (devis, factures, bon) et ses gestes (PLN-20). */
export function CarteRapport({ r, numeroBon, onResultat }: { r: RapportDeLaListe; numeroBon: string | null; onResultat: (m: string, e?: unknown) => void }) {
  const lier = useLierBon();
  const supprimer = useSupprimerRapport();
  const [lien, setLien] = useState(false);
  const modifiable = usePermission("rapports", "modifier");
  const suite = (m: string) => ({ onSuccess: () => onResultat(m), onError: (e: unknown) => onResultat("", e) });

  return (
    <li className="flex flex-col gap-2 rounded-md border p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <Link to={modifiable ? `/rapports/${r.id}` : `/rapports/${r.id}/apercu`} className="font-semibold text-primary hover:underline">{r.client_nom}</Link>
          <p className="text-sm text-muted-foreground">
            <span className="font-mono">{r.numero ?? "—"}</span> · {formatDateFr(r.date)}{r.heure ? ` à ${r.heure}` : ""}{r.interlocuteur ? ` · 👤 ${r.interlocuteur}` : ""}{r.conducteur ? ` · 🦺 ${r.conducteur}` : ""}{r.metier ? ` · 🔧 ${libelleMetier(r.metier)}` : ""}
          </p>
          {r.nbPhotos > 0 && <p className="text-xs text-muted-foreground">{r.nbPhotos} photo{r.nbPhotos > 1 ? "s" : ""}</p>}
          {r.occupant && <p className="text-xs">🏠 {r.occupant}</p>}
          {r.devis.length > 0 && <p className="text-xs">Devis lié : {r.devis.map((d) => <Link key={d.id} className="underline" to={`/devis/${d.id}`}>{d.numero ?? "brouillon"}</Link>)}</p>}
          {r.factures.length > 0 && <p className="text-xs">Facture liée : {r.factures.map((f) => <Link key={f.id} className="underline" to={`/factures/${f.id}`}>{f.numero ?? "brouillon"}</Link>)}</p>}
          {r.bon_commande_id && <p className="text-xs">Bon de commande lié : <Can module="bons_commande" sinon={<span>{numeroBon ?? "—"}</span>}><Link className="underline" to={`/commandes/${r.bon_commande_id}`}>{numeroBon ?? "voir le bon"}</Link></Can></p>}
        </div>
        <div className="flex gap-1">
          {r.logement_statut && <Badge variant="neutre">{LOGEMENT[r.logement_statut] ?? r.logement_statut}</Badge>}
          <Badge>{r.statut ?? "en cours"}</Badge>
        </div>
      </div>
      {r.constatations && <p className="text-sm text-muted-foreground">{r.constatations}</p>}
      <div className="flex flex-wrap gap-2">
        <Can module="rapports" action="modifier"><Button asChild size="sm" variant="outline"><Link to={`/rapports/${r.id}`}>Modifier</Link></Button></Can>
        <ActionsTransformation rapport={r} bonId={r.bon_commande_id} devisPossible={!r.devis.length} facturePossible={!r.factures.length} />
        <Button asChild size="sm" variant="outline"><Link to={`/rapports/${r.id}/apercu`}>Imprimer / PDF</Link></Button>
        <Can module="rapports" action="modifier">
          <Button size="sm" variant="ghost" onClick={() => setLien(!lien)}>🔗 {r.bon_commande_id ? "Modifier le lien BC" : "Lier un bon de commande"}</Button>
          {r.bon_commande_id && <Button size="sm" variant="ghost" onClick={() => lier.mutate({ rapportId: r.id, bcId: null }, suite("Lien retiré — vous pouvez lier ce rapport à un autre bon."))}>✂️ Délier</Button>}
        </Can>
        <Can module="rapports" action="supprimer">
          <BoutonConfirme libelle="Supprimer" question="Supprimer ce rapport et ses photos ?" enCours={supprimer.isPending} onConfirmer={() => supprimer.mutate(r.id, suite("Rapport supprimé."))} />
        </Can>
      </div>
      {lien && (
        <LienBon
          clientId={r.client_id}
          clientNom={r.client_nom}
          onAnnuler={() => setLien(false)}
          onChoisir={(bcId) => {
            setLien(false);
            lier.mutate({ rapportId: r.id, bcId }, suite("Lié avec succès (un seul rapport par bon)."));
          }}
        />
      )}
    </li>
  );
}
