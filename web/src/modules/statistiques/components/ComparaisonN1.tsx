import type { Montant } from "@/lib/money";
import { useModeDiscret } from "@/lib/modeDiscret";
import { comparaisonN1 } from "../domain/tableau";
import { formatMontant } from "./format";

/**
 * Le rappel de l'exercice précédent (`comparaisonN1HTML`, app.js depuis
 * 0f6f60d) : « 2025 : 1 200,00 € · +12 % », l'écart en vert, en rouge ou en
 * gris selon son signe — ou « rien en 2025 » quand il n'y a rien à comparer.
 */
export function ComparaisonN1({ courant, precedent, anneePrecedente }: { courant: Montant; precedent: Montant; anneePrecedente: number }) {
  useModeDiscret();
  const c = comparaisonN1(courant, precedent, anneePrecedente);
  if (c.type === "rien") return <span style={{ color: "var(--text-dim)" }}>rien en {c.anneePrecedente}</span>;
  const couleur = c.ecart > 0 ? "var(--success)" : c.ecart < 0 ? "var(--danger)" : "var(--text-dim)";
  return (
    <>
      {c.anneePrecedente} : {formatMontant(c.precedent)} · <b style={{ color: couleur }}>{`${c.ecart > 0 ? "+" : ""}${c.ecart} %`}</b>
    </>
  );
}
