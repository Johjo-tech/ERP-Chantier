import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { communesDuCodePostal } from "../api/communes";

/** Une commune ne change pas de code postal d'un jour à l'autre : lue une fois par session. */
const GARDE_MS = 24 * 60 * 60_000;

/**
 * Sous le code postal : les villes qu'il désigne (CLI-06), à choisir d'un
 * clic. Proposées, jamais imposées — un lieu-dit ou une graphie du client
 * reste possible.
 */
export function VillesProposees({ codePostal, ville, onChoisir }: { codePostal: string; ville: string; onChoisir: (v: string) => void }) {
  const cp = codePostal.trim();
  const communes = useQuery({
    queryKey: ["communes", cp],
    queryFn: ({ signal }) => communesDuCodePostal(cp, signal),
    enabled: /^\d{5}$/.test(cp),
    staleTime: GARDE_MS,
  });
  const propositions = (communes.data ?? []).filter((c) => c.toLocaleLowerCase("fr") !== ville.trim().toLocaleLowerCase("fr"));
  if (!propositions.length) return null;
  return (
    <div role="group" aria-label={`Villes du ${cp}`} className="flex flex-wrap items-center gap-1 text-xs sm:col-span-2">
      <span className="text-muted-foreground">Ville du {cp} :</span>
      {propositions.map((c) => (
        <Button key={c} type="button" size="sm" variant="outline" onClick={() => onChoisir(c)}>
          {c}
        </Button>
      ))}
    </div>
  );
}
