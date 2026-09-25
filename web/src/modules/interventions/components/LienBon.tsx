import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { correspond } from "@/lib/recherche";
import { useBonsLiables } from "../hooks/useRapports";

const SUGGESTIONS_MAX = 8;

/**
 * Chercher un bon à lier : n°, adresse, n° de logement (`lienWidgetHTML`).
 * Seuls les bons du client du rapport sont proposés, comme l'ancien écran.
 */
export function LienBon({ clientId, clientNom, onChoisir, onAnnuler }: { clientId: string | null; clientNom: string; onChoisir: (bcId: string) => void; onAnnuler: () => void }) {
  const bons = useBonsLiables();
  const [recherche, setRecherche] = useState("");
  const candidats = (bons.data ?? [])
    .filter((b) => (clientId ? b.client_id === clientId : !clientNom || b.client_nom === clientNom))
    .filter((b) => correspond(recherche, b.numero_bc, b.numero_interne, b.client_nom, b.adresse, b.code_postal, b.ville, b.numero_logement))
    .slice(0, SUGGESTIONS_MAX);
  return (
    <div className="flex flex-col gap-1" onClick={(e) => e.stopPropagation()}>
      <label className="sr-only" htmlFor={`lien-${clientNom}`}>Rechercher un bon de commande</label>
      <Input id={`lien-${clientNom}`} autoFocus placeholder="Rechercher un bon de commande : n°, adresse, n° logement…" value={recherche} onChange={(e) => setRecherche(e.target.value)} />
      <ul className="flex flex-col rounded-md border">
        {candidats.map((b) => (
          <li key={b.id}>
            <button type="button" className="w-full px-2 py-1 text-left text-sm hover:bg-muted" onClick={() => onChoisir(b.id)}>
              <b>{b.numero_bc || b.numero_interne || "—"}</b> <span className="text-muted-foreground">{b.client_nom}{b.adresse ? ` — ${b.adresse}` : ""}{b.numero_logement ? ` · N° ${b.numero_logement}` : ""}</span>
            </button>
          </li>
        ))}
        {!candidats.length && <li className="px-2 py-1 text-sm text-muted-foreground">Aucun résultat</li>}
      </ul>
      <Button variant="ghost" size="sm" className="self-start" onClick={onAnnuler}>Annuler</Button>
    </div>
  );
}
