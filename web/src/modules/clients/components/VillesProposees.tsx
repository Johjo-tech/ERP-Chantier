import { useQuery } from "@tanstack/react-query";
import { communesDuCodePostal } from "../api/communes";

/** Une commune ne change pas de code postal d'un jour à l'autre : lue une fois par session. */
const GARDE_MS = 24 * 60 * 60_000;

/**
 * Sous le code postal : les villes qu'il désigne (CLI-06), à choisir d'un
 * clic. Proposées, jamais imposées — un lieu-dit ou une graphie du client
 * reste possible. Rien quand la ville saisie en est déjà une : la fiche
 * s'ouvre alors comme dans l'ancien.
 */
export function VillesProposees({ codePostal, ville, onChoisir }: { codePostal: string; ville: string; onChoisir: (v: string) => void }) {
  const cp = codePostal.trim();
  const communes = useQuery({
    queryKey: ["communes", cp],
    queryFn: ({ signal }) => communesDuCodePostal(cp, signal),
    enabled: /^\d{5}$/.test(cp),
    staleTime: GARDE_MS,
  });
  const liste = communes.data ?? [];
  const connue = liste.some((c) => c.toLocaleLowerCase("fr") === ville.trim().toLocaleLowerCase("fr"));
  if (!liste.length || connue) return null;
  return (
    <div role="group" aria-label={`Villes du ${cp}`} className="field full card-sub" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "6px", flexDirection: "row" }}>
      <span>Ville du {cp} :</span>
      {liste.map((c) => (
        <button key={c} type="button" className="btn small" onClick={() => onChoisir(c)}>
          {c}
        </button>
      ))}
    </div>
  );
}
