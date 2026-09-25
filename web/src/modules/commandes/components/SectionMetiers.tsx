import { memeMetier } from "../domain/metiers";

interface Props {
  disponibles: readonly string[];
  coches: readonly string[];
  /** Métier → chapitre qui l'a livré : l'utilisateur voit d'où vient une case cochée d'office. */
  origines: Readonly<Record<string, string>>;
  ajoutes: number;
  onChange: (metiers: string[]) => void;
  lectureSeule: boolean;
}

/**
 * Les métiers du bon (BC-12) : cochés à la main ou lus sur ses chapitres. Au
 * moins deux métiers, et le bon se planifiera en autant d'interventions — dit
 * en place, pas seulement en toast, parce que scinder un planning mérite une
 * trace qu'on retrouve au moment d'enregistrer.
 */
export function SectionMetiers({ disponibles, coches, origines, ajoutes, onChange, lectureSeule }: Props) {
  const tous = [...disponibles, ...coches.filter((c) => !disponibles.some((d) => memeMetier(d, c)))];
  const estCoche = (m: string) => coches.some((c) => memeMetier(c, m));
  const basculer = (m: string) => onChange(estCoche(m) ? coches.filter((c) => !memeMetier(c, m)) : [...coches, m]);
  const origine = (m: string) => Object.entries(origines).find(([k]) => memeMetier(k, m))?.[1];
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-sm font-semibold">Métier(s)</legend>
      {!tous.length && <p className="text-sm text-muted-foreground">Aucun métier déclaré pour l'instant (Réglages → Métiers).</p>}
      <div className="flex flex-wrap gap-3">
        {tous.map((m) => (
          <label key={m} className="flex items-center gap-1.5 text-sm" title={origine(m) ? `Lu sur le chapitre « ${origine(m)} »` : undefined}>
            <input type="checkbox" checked={estCoche(m)} disabled={lectureSeule} onChange={() => basculer(m)} />
            {m}
            {origine(m) && <small className="text-muted-foreground">← {origine(m)}</small>}
          </label>
        ))}
      </div>
      <p role="status" aria-live="polite" className="text-xs text-muted-foreground">
        {ajoutes > 0 && `✓ ${ajoutes} métier${ajoutes > 1 ? "s" : ""} lu${ajoutes > 1 ? "s" : ""} sur les chapitres du bon. `}
        {coches.length > 1 && `Ce bon se planifiera en ${coches.length} interventions, une par métier.`}
      </p>
    </fieldset>
  );
}
