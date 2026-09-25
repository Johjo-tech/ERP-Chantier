import { Input, Select } from "@/components/ui/input";
import type { FiltresBons } from "../domain/filtres";
import { LIBELLES_MODE, type ModeBon } from "../domain/regles";

interface Props {
  filtres: FiltresBons;
  onChange: (f: FiltresBons) => void;
  conducteurs: readonly { id: string; nom: string }[];
}

const MODES = Object.keys(LIBELLES_MODE) as ModeBon[];

export function BarreFiltresBons({ filtres, onChange, conducteurs }: Props) {
  const changer = <K extends keyof FiltresBons>(cle: K, v: FiltresBons[K]) => onChange({ ...filtres, [cle]: v });
  return (
    <div className="mb-3 flex flex-wrap gap-2">
      <label htmlFor="recherche-bons" className="sr-only">Rechercher un bon de commande</label>
      <Input
        id="recherche-bons"
        type="search"
        className="max-w-sm"
        placeholder="N°, client, lieu, nature…"
        value={filtres.recherche}
        onChange={(e) => changer("recherche", e.target.value)}
      />
      <label htmlFor="filtre-type-bon" className="sr-only">Type de bon</label>
      <Select id="filtre-type-bon" className="max-w-40" value={filtres.type} onChange={(e) => changer("type", e.target.value as FiltresBons["type"])}>
        <option value="">BC et SAV</option>
        <option value="bc">BC</option>
        <option value="sav">SAV</option>
      </Select>
      <label htmlFor="filtre-mode-bon" className="sr-only">Mode du bon</label>
      <Select id="filtre-mode-bon" className="max-w-48" value={filtres.mode} onChange={(e) => changer("mode", e.target.value as FiltresBons["mode"])}>
        <option value="">Tous les modes</option>
        {MODES.map((m) => <option key={m} value={m}>{m === "normal" ? "Avec n° de BC" : LIBELLES_MODE[m]}</option>)}
      </Select>
      <label htmlFor="filtre-conducteur-bon" className="sr-only">Conducteur</label>
      <Select id="filtre-conducteur-bon" className="max-w-56" value={filtres.conducteurId} onChange={(e) => changer("conducteurId", e.target.value)}>
        <option value="">Tous les conducteurs</option>
        {conducteurs.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
      </Select>
    </div>
  );
}
