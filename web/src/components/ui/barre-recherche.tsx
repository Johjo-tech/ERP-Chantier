/**
 * La barre de recherche des listes de l'ancien écran (`barreRecherche`, app.js
 * l. 4446) : un champ `search` pleine largeur dans `.barre-recherche`, et le
 * compteur « 3 sur 12 » à droite dès que la recherche écarte une fiche.
 * Le libellé caché remplace l'absence de `<label>` de l'ancien sans rien
 * changer à l'écran.
 */
export function BarreRecherche({
  id,
  valeur,
  onChange,
  placeholder,
  affiches,
  total,
  libelle,
}: {
  id: string;
  valeur: string;
  onChange: (v: string) => void;
  placeholder: string;
  affiches: number;
  total: number;
  libelle: string;
}) {
  const compte = valeur.trim() && affiches !== total ? `${affiches} sur ${total}` : "";
  return (
    <div className="barre-recherche">
      <label htmlFor={`recherche-${id}`} className="sr-only">
        {libelle}
      </label>
      <input type="search" id={`recherche-${id}`} value={valeur} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      {compte && <span className="compteur-resultats">{compte}</span>}
    </div>
  );
}
