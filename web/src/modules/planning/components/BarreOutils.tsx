import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { ajouterJours, lundiDe } from "../domain/calendrier";
import type { FiltresPlanning } from "../domain/filtres";
import { usePlanningContexte } from "./contexte";

interface Props {
  filtres: FiltresPlanning;
  onFiltres: (f: FiltresPlanning) => void;
  onRecherche: (texte: string) => void;
  premierLundi: string;
  onSemaine: (lundi: string) => void;
  metiers: string[];
  calendrier: boolean;
  onImprimer: () => void;
}

const SEMAINE = 7;

/** Recherche, équipe (ou sous-traitant), métier, semaines, impression (PLN-02, PLN-11). */
export function BarreOutils({ filtres, onFiltres, onRecherche, premierLundi, onSemaine, metiers, calendrier, onImprimer }: Props) {
  const { donnees, affectation, role } = usePlanningContexte();
  const st = affectation === "sous_traitant";
  const liste = st ? donnees.sousTraitants : donnees.equipes;
  const choisirAffecte = (id: string) => {
    // Une équipe d'un seul métier fixe aussi le filtre métier, comme l'ancien écran.
    const choisie = liste.find((x) => x.id === id);
    const metier = choisie && choisie.metiers.length === 1 ? (choisie.metiers[0] ?? "") : id ? "" : filtres.metier;
    onFiltres({ ...filtres, affecte: id, metier });
  };
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2 print:hidden">
      <label className="sr-only" htmlFor="recherche-planning">Rechercher</label>
      <Input id="recherche-planning" type="search" className="w-56" placeholder="Rechercher : client, n° BC, adresse…" value={filtres.recherche} onChange={(e) => onRecherche(e.target.value)} />
      {calendrier && (
        <>
          {role !== "sous_traitant" && (
            <Select aria-label={st ? "Sous-traitant" : "Équipe"} className="w-auto min-w-40" value={filtres.affecte} onChange={(e) => choisirAffecte(e.target.value)}>
              <option value="">{st ? "Tous les sous-traitants" : "Toutes les équipes"}</option>
              {liste.map((x) => <option key={x.id} value={x.id}>{x.nom}</option>)}
            </Select>
          )}
          <Select aria-label="Métier" className="w-auto min-w-36" value={filtres.metier} onChange={(e) => onFiltres({ ...filtres, metier: e.target.value })}>
            <option value="">Tous les métiers</option>
            {metiers.map((m) => <option key={m} value={m}>{m}</option>)}
          </Select>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" aria-label="Semaine précédente" onClick={() => onSemaine(ajouterJours(premierLundi, -SEMAINE))}>←</Button>
            <label className="sr-only" htmlFor="semaine-planning">Aller à la semaine de cette date</label>
            <Input id="semaine-planning" type="date" className="w-40" value={premierLundi} onChange={(e) => e.target.value && onSemaine(lundiDe(e.target.value))} />
            <Button variant="outline" size="sm" aria-label="Semaine suivante" onClick={() => onSemaine(ajouterJours(premierLundi, SEMAINE))}>→</Button>
          </div>
          <Button variant="outline" size="sm" onClick={onImprimer}>🖨️ Imprimer</Button>
        </>
      )}
    </div>
  );
}
