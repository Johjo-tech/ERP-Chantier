import { Input, Textarea } from "@/components/ui/input";
import { CONTROLES_PAR_METIER, type SaisieRapport } from "../domain/rapport";

/** Étape 2 — les points de contrôle du métier choisi ; « Autre » demande une précision. */
export function EtapeControles({ saisie, onChange }: { saisie: SaisieRapport; onChange: (s: SaisieRapport) => void }) {
  const points = saisie.metier ? CONTROLES_PAR_METIER[saisie.metier] : null;
  if (!points) {
    return <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">Choisissez d'abord un type d'intervention (Plomberie, Électricité, Étanchéité) à l'étape « Infos » pour afficher les points de contrôle correspondants.</p>;
  }
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="sr-only">Points de contrôle</legend>
      {points.map((p) => (
        <div key={p.cle}>
          <label className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm">
            {p.libelle}
            <input type="checkbox" checked={!!saisie.controles[p.cle]} onChange={(e) => onChange({ ...saisie, controles: { ...saisie.controles, [p.cle]: e.target.checked } })} />
          </label>
          {p.cle === "autre" && saisie.controles.autre && (
            <Input className="mt-1" aria-label="Précisez le contrôle" placeholder="Précisez le contrôle…" value={saisie.precision_autre} onChange={(e) => onChange({ ...saisie, precision_autre: e.target.value })} />
          )}
        </div>
      ))}
    </fieldset>
  );
}

/**
 * Étape 4 — le rapport rédigé. La génération par IA de l'ancien écran n'est
 * pas reprise : elle appelait l'API depuis le navigateur, sans clé, et
 * échouait par construction (PLN-51, D-PLN-11).
 */
export function EtapeRapport({ saisie, onChange }: { saisie: SaisieRapport; onChange: (s: SaisieRapport) => void }) {
  return (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm">
        Constatations
        <Textarea rows={6} value={saisie.constatations} onChange={(e) => onChange({ ...saisie, constatations: e.target.value })} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Préconisations
        <Textarea rows={6} value={saisie.preconisations} onChange={(e) => onChange({ ...saisie, preconisations: e.target.value })} aria-describedby="aide-preconisations" />
      </label>
      <p id="aide-preconisations" className="text-xs text-muted-foreground">💡 Une ligne = une ligne de devis. Ajoutez « x2 » (et l'unité juste après, ex : « x25 m² ») en fin de ligne pour indiquer quantité et unité.</p>
    </div>
  );
}
