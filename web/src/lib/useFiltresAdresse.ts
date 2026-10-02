import { useSearchParams } from "react-router";

/**
 * Les filtres d'une liste vivent dans l'ADRESSE (D-CLI-10, D-STA-07) : une
 * tuile du tableau de bord ouvre la liste déjà filtrée (`/devis?statut=envoyé`),
 * « Précédent » la retrouve telle qu'on l'a laissée, et un lien copié montre
 * la même chose à un collègue. Seules les clés connues sont lues ; une valeur
 * vide n'est pas écrite.
 */
type Filtres<T> = { [K in keyof T]: string };

const clesDe = <T extends Filtres<T>>(vides: T) => Object.keys(vides) as (keyof T & string)[];

export function lireFiltres<T extends Filtres<T>>(params: URLSearchParams, vides: T): T {
  const lus = { ...vides };
  for (const cle of clesDe(vides)) {
    const v = params.get(cle);
    if (v !== null) lus[cle] = v as T[typeof cle];
  }
  return lus;
}

export function ecrireFiltres<T extends Filtres<T>>(params: URLSearchParams, filtres: T, vides: T): URLSearchParams {
  const suivants = new URLSearchParams(params);
  for (const cle of clesDe(vides)) {
    const v = filtres[cle];
    if (v && v !== vides[cle]) suivants.set(cle, v);
    else suivants.delete(cle);
  }
  return suivants;
}

export function useFiltresAdresse<T extends Filtres<T>>(vides: T) {
  const [params, setParams] = useSearchParams();
  const filtres = lireFiltres(params, vides);
  // `replace` : chaque frappe dans la recherche ne doit pas empiler une entrée d'historique.
  const changer = (suivants: T) => setParams((p) => ecrireFiltres(p, suivants, vides), { replace: true });
  /** Un seul filtre, relu dans l'adresse AU MOMENT d'écrire : une recherche différée n'écrase pas un filtre choisi entre-temps. */
  const changerUn = <K extends keyof T & string>(cle: K, valeur: T[K]) =>
    setParams((p) => ecrireFiltres(p, { ...lireFiltres(p, vides), [cle]: valeur }, vides), { replace: true });
  return { filtres, changer, changerUn };
}
