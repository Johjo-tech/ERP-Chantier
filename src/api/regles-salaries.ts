/**
 * Comment un salarié se nomme et se range dans les écrans RH.
 *
 * La liste était bien rangée sur le nom de famille, mais elle affichait
 * « Prénom Nom » : l'œil lit le premier mot, et voyait donc une liste en
 * désordre. Le nom passe devant, en capitales — la graphie des registres et
 * des bulletins, la seule qui distingue « MARTIN Paul » de « PAUL Martin » une
 * fois l'ordre inversé.
 *
 * Module feuille — il n'importe rien. L'écran et le chargement des collections
 * lisent le même ordre : une liste rechargée après un enregistrement ne peut
 * pas se ranger autrement que celle du démarrage.
 */

/** Un salarié, vu d'ici. */
export interface SalarieNomme {
  nom?: string | null;
  prenom?: string | null;
}

/* `base` range « Élodie », « elodie » et « ELODIE » ensemble, comme sur une
   liste papier. Sans lui, la casse de la saisie décidait de la place. */
const COLLATEUR = new Intl.Collator("fr", { sensitivity: "base" });

function texte(v: unknown): string {
  return String(v ?? "").trim();
}

/** « DUPONT Jean ». Une partie manquante ne laisse pas d'espace orphelin. */
export function nomSalarie(salarie: SalarieNomme | null | undefined): string {
  return [texte(salarie?.nom).toLocaleUpperCase("fr"), texte(salarie?.prenom)]
    .filter(Boolean)
    .join(" ");
}

/**
 * Le nom de famille, puis le prénom pour départager les homonymes.
 *
 * Une fiche sans nom est une saisie inachevée : elle passe en dernier, plutôt
 * que de prendre la tête de la liste.
 */
export function comparerSalaries(a: SalarieNomme, b: SalarieNomme): number {
  const na = texte(a.nom);
  const nb = texte(b.nom);
  return (
    (na ? 0 : 1) - (nb ? 0 : 1) ||
    COLLATEUR.compare(na, nb) ||
    COLLATEUR.compare(texte(a.prenom), texte(b.prenom))
  );
}

/** Trie une copie ; l'original n'est pas touché. */
export function trierSalaries<T extends SalarieNomme>(liste: readonly T[] | null | undefined): T[] {
  return [...(liste ?? [])].sort(comparerSalaries);
}
