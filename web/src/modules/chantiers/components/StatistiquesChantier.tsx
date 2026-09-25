import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { formatEurosEcran, useModeDiscret } from "@/lib/modeDiscret";
import { usePermission } from "@/modules/auth-roles/hooks/useSession";
import { statistiquesChantier } from "../domain/statistiques";
import { progressionTodo } from "../domain/todo";
import { useDpgf } from "../hooks/useChantiers";
import { useDroitsChantier } from "../hooks/useDroitsChantier";
import { useAchats, useComptesRendus, useDevisAvecLignes, useFacturesDuChantier, useTodos } from "../hooks/useFiche";

function Case({ valeur, libelle }: { valeur: ReactNode; libelle: string }) {
  useModeDiscret();
  return (
    <div className="flex flex-col">
      <dd className="text-xl font-semibold tabular-nums">{valeur}</dd>
      <dt className="order-last text-xs text-muted-foreground">{libelle}</dt>
    </div>
  );
}

/**
 * Les chiffres du chantier en tête de fiche (statistiques de l'ancienne fiche,
 * app.js l. 13388-13415) : chaque case n'apparaît qu'à qui peut lire sa source.
 */
export function StatistiquesChantier({ chantierId }: { chantierId: string }) {
  useModeDiscret();
  const droits = useDroitsChantier();
  const voitDevis = usePermission("devis", "voir");
  const voitFactures = usePermission("factures", "voir");
  const dpgf = useDpgf(chantierId);
  const achats = useAchats(chantierId);
  const cr = useComptesRendus(chantierId);
  const devis = useDevisAvecLignes(chantierId);
  const factures = useFacturesDuChantier(chantierId);
  const todos = useTodos(chantierId);
  const s = statistiquesChantier({
    dpgf: droits.gere ? (dpgf.data ?? null) : null,
    achats: droits.gere ? (achats.data ?? null) : null,
    nbDevis: voitDevis ? (devis.data?.length ?? null) : null,
    nbFactures: voitFactures ? (factures.data?.length ?? null) : null,
    nbComptesRendus: cr.data?.length ?? 0,
    todo: progressionTodo(todos.data ?? []),
  });
  const pct = s.avancement?.pourcentage ?? 0;

  return (
    <Card>
      <CardContent className="pt-4">
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-8" aria-label="Chiffres du chantier">
          {s.avancement && (
            <div className="col-span-2 flex items-center gap-3">
              <div className="relative size-14 rounded-full" style={{ background: `conic-gradient(var(--color-primary) ${pct * 3.6}deg, var(--color-muted) 0)` }} role="img" aria-label={`Avancement facturé ${pct} %`}>
                <span className="absolute inset-1.5 flex items-center justify-center rounded-full bg-card text-sm font-semibold">{pct} %</span>
              </div>
              <Case valeur={formatEurosEcran(s.avancement.total)} libelle="Total DPGF (HT) — avancement facturé" />
            </div>
          )}
          {s.nbDevis !== null && <Case valeur={s.nbDevis} libelle="Devis" />}
          <Case valeur={s.nbComptesRendus} libelle={s.nbComptesRendus > 1 ? "Comptes-rendus" : "Compte-rendu"} />
          {s.totalAchats && <Case valeur={formatEurosEcran(s.totalAchats)} libelle="Achats" />}
          {s.nbFactures !== null && <Case valeur={s.nbFactures} libelle={s.nbFactures > 1 ? "Factures" : "Facture"} />}
          {s.margeConstatee && <Case valeur={formatEurosEcran(s.margeConstatee)} libelle="Facturé − achats" />}
          <Case valeur={`${s.todo.faits}/${s.todo.total}`} libelle="To-do faites" />
        </dl>
      </CardContent>
    </Card>
  );
}
