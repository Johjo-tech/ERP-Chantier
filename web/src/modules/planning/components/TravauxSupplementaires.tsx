import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAjouterTravail, useTravauxSupplementaires } from "../hooks/usePlanning";
import { usePlanningContexte } from "./contexte";

const LIBELLES: Record<string, string> = { a_chiffrer: "À chiffrer", chiffre: "Chiffré", refuse: "Refusé", integre: "Repris au bon" };
const SIGNALENT = ["admin", "conducteur", "technicien", "sous_traitant"];

/**
 * Les travaux constatés en plus du bon : le terrain les signale, sans prix —
 * le chiffrage se fait dans Facturation › Validation. Lus par la vue terrain,
 * qui masque le prix à qui ne doit pas le voir.
 */
export function TravauxSupplementaires({ bcId, tacheId }: { bcId: string; tacheId: string | null }) {
  const { role, signaler } = usePlanningContexte();
  const travaux = useTravauxSupplementaires(bcId, true);
  const ajouter = useAjouterTravail();
  const [libelle, setLibelle] = useState("");
  const origine = role === "admin" || role === "conducteur" ? "conducteur" : "technicien";
  return (
    <section aria-label="Travaux supplémentaires" className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold">Travaux supplémentaires</h3>
      <ul className="flex flex-col gap-1 text-sm">
        {(travaux.data ?? []).map((t) => (
          <li key={t.id} className="flex justify-between gap-2 rounded border px-2 py-1">
            <span>{t.libelle}</span>
            <span className="text-xs text-muted-foreground">{LIBELLES[t.statut] ?? t.statut}</span>
          </li>
        ))}
        {travaux.isSuccess && !travaux.data.length && <li className="text-xs text-muted-foreground">Aucun travail supplémentaire signalé.</li>}
      </ul>
      {role && SIGNALENT.includes(role) && (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!libelle.trim()) return;
            ajouter.mutate(
              { bcId, tacheId, libelle, origine },
              {
                onSuccess: () => {
                  setLibelle("");
                  signaler("Travail supplémentaire signalé — il sera chiffré à la validation.");
                  void travaux.refetch();
                },
                onError: (err) => signaler("", err),
              }
            );
          }}
        >
          <label className="sr-only" htmlFor={`travail-${bcId}`}>Travail supplémentaire constaté</label>
          <Input id={`travail-${bcId}`} placeholder="Ex. : reprise de plinthes sur 4 ml" value={libelle} onChange={(e) => setLibelle(e.target.value)} />
          <Button type="submit" size="sm" disabled={!libelle.trim() || ajouter.isPending}>Signaler</Button>
        </form>
      )}
    </section>
  );
}
