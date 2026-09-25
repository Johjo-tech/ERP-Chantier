import { type FiltreActif, type TypeArticle } from "../domain/article";

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

/** Les filtres de l'ancien catalogue : même ligne, mêmes libellés (« Prestations », « Biens »). */
export function FiltresArticles({ valeurs, familles, onChange }: Props) {
  // Une famille choisie puis disparue du catalogue reste proposée : sinon la liste afficherait un filtre invisible.
  const options = valeurs.famille && !familles.includes(valeurs.famille) ? [...familles, valeurs.famille] : familles;
  return (
    <div style={{ display: "flex", gap: "10px", marginBottom: "16px", flexWrap: "wrap" }}>
      <input
        type="text"
        aria-label="Rechercher un article"
        style={{ flex: 1, minWidth: "220px" }}
        placeholder="Rechercher : code ou désignation…"
        value={valeurs.saisie}
        onChange={(e) => onChange("saisie", e.target.value)}
      />
      <select aria-label="État" style={{ width: "auto" }} value={valeurs.actif} onChange={(e) => onChange("actif", e.target.value as FiltreActif)}>
        {ETATS.map((e) => (
          <option key={e.valeur} value={e.valeur}>
            {e.libelle}
          </option>
        ))}
      </select>
      <select aria-label="Type" style={{ width: "auto" }} value={valeurs.type} onChange={(e) => onChange("type", e.target.value as TypeArticle | "")}>
        <option value="">Tous types</option>
        <option value="service">Prestations</option>
        <option value="bien">Biens</option>
      </select>
      <select aria-label="Famille" style={{ width: "auto" }} value={valeurs.famille} onChange={(e) => onChange("famille", e.target.value)}>
        <option value="">Toutes familles</option>
        {options.map((f) => (
          <option key={f} value={f}>
            {f}
          </option>
        ))}
      </select>
    </div>
  );
}
