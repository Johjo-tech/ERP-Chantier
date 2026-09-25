import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { BoutonConfirme } from "@/components/ui/confirmation";
import { formatDateFr } from "@/lib/dates";
import { nomEmprunteur, retourPrevu, trierPrets, type PersonneAnnuaire, type PretBase } from "../domain/prets";

interface Props<P extends PretBase> {
  prets: readonly P[];
  personnes: readonly PersonneAnnuaire[];
  etatAuPret: (p: P) => string | null;
  modifiable: boolean;
  onSupprimer: (id: string) => void;
  /** Ce qu'un véhicule ajoute à la ligne : les marques relevées au départ et au retour. */
  complement?: (p: P) => ReactNode;
}

/** L'historique des prêts, du plus récent au plus ancien ; « en cours » tant qu'il n'y a pas de retour réel. */
export function HistoriquePrets<P extends PretBase>({ prets, personnes, etatAuPret, modifiable, onSupprimer, complement }: Props<P>) {
  if (!prets.length) return <p className="text-sm text-muted-foreground">Aucun prêt enregistré pour l'instant.</p>;
  return (
    <ul className="divide-y divide-border" aria-label="Historique des prêts">
      {trierPrets(prets).map((p) => (
        <li key={p.id} className="flex flex-wrap items-start gap-2 py-2 text-sm">
          <div className="flex-1">
            <div>
              <span className="font-medium">{nomEmprunteur(p, personnes)}</span>
              <span className="text-muted-foreground"> — état au prêt : {etatAuPret(p) || "—"}</span>
            </div>
            <div className="text-xs text-muted-foreground">
              Du {formatDateFr(p.date_debut)}
              {p.duree_jours != null && ` · prévu ${p.duree_jours} j (retour prévu ${formatDateFr(retourPrevu(p))})`}
              {p.date_fin ? ` · rendu le ${formatDateFr(p.date_fin)}` : ""}
            </div>
            {complement?.(p)}
          </div>
          {p.date_fin ? <Badge variant="neutre">Rendu</Badge> : <Badge variant="alerte">En cours</Badge>}
          {modifiable && <BoutonConfirme libelle="Supprimer" question="Supprimer ce prêt de l'historique ?" onConfirmer={() => onSupprimer(p.id)} />}
        </li>
      ))}
    </ul>
  );
}
