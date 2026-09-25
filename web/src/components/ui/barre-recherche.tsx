/**
 * La barre de recherche des listes de l'ancien écran (`barreRecherche`,
 * app.js l. 4446) : un champ, et « 3 sur 12 » à côté dès qu'une recherche
 * écarte des fiches. Rien quand elle n'écarte rien — l'ancien ne disait pas
 * « 12 sur 12 ».
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
  const filtre = valeur.trim() !== "" && affiches !== total;
  return (
    <div className="barre-recherche">
      <input type="search" id={id} aria-label={libelle} value={valeur} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      {filtre && (
        <span className="compteur-resultats" aria-live="polite">
          {affiches} sur {total}
        </span>
      )}
    </div>
  );
}
