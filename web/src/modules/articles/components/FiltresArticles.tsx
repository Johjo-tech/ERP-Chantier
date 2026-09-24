import { Input, Select } from "@/components/ui/input";
import { TYPES_ARTICLE, type FiltreActif, type TypeArticle } from "../domain/article";

export interface ValeursFiltres {
  saisie: string;
  actif: FiltreActif;
  type: TypeArticle | "";
  famille: string;
}

interface Props {
  valeurs: ValeursFiltres;
  familles: readonly string[];
  onChange: <K extends keyof ValeursFiltres>(champ: K, valeur: ValeursFiltres[K]) => void;
}

const ETATS: readonly { valeur: FiltreActif; libelle: string }[] = [
  { valeur: "actifs", libelle: "Actifs" },
  { valeur: "retires", libelle: "Retirés" },
  { valeur: "tous", libelle: "Tous" },
];

export function FiltresArticles({ valeurs, familles, onChange }: Props) {
  // Une famille choisie puis disparue du catalogue reste proposée : sinon la liste afficherait un filtre invisible.
  const options = valeurs.famille && !familles.includes(valeurs.famille) ? [...familles, valeurs.famille] : familles;
  return (
    <div className="mb-3 flex flex-wrap gap-2">
      <label htmlFor="recherche-articles" className="sr-only">Rechercher un article</label>
      <Input
        id="recherche-articles"
        type="search"
        className="max-w-sm"
        placeholder="Code ou désignation…"
        value={valeurs.saisie}
        onChange={(e) => onChange("saisie", e.target.value)}
      />
      <label htmlFor="filtre-etat-articles" className="sr-only">État</label>
      <Select id="filtre-etat-articles" className="max-w-36" value={valeurs.actif} onChange={(e) => onChange("actif", e.target.value as FiltreActif)}>
        {ETATS.map((e) => <option key={e.valeur} value={e.valeur}>{e.libelle}</option>)}
      </Select>
      <label htmlFor="filtre-type-articles" className="sr-only">Type</label>
      <Select id="filtre-type-articles" className="max-w-40" value={valeurs.type} onChange={(e) => onChange("type", e.target.value as TypeArticle | "")}>
        <option value="">Tous types</option>
        {TYPES_ARTICLE.map((t) => <option key={t.code} value={t.code}>{t.libelle}</option>)}
      </Select>
      <label htmlFor="filtre-famille-articles" className="sr-only">Famille</label>
      <Select id="filtre-famille-articles" className="max-w-48" value={valeurs.famille} onChange={(e) => onChange("famille", e.target.value)}>
        <option value="">Toutes familles</option>
        {options.map((f) => <option key={f} value={f}>{f}</option>)}
      </Select>
    </div>
  );
}
