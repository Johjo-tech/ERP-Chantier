import { z } from "zod";
import { analyser } from "./validation";

/**
 * Lire une liste ENTIÈRE, ou refuser (TRV-10, `chargerCollection` de l'ancien
 * pont). PostgREST plafonne silencieusement ses réponses (`max_rows`) : une
 * liste de clients coupée à la millième ligne s'afficherait comme complète,
 * et le client manquant « n'existerait pas ». On lit donc par pages, avec le
 * compte exact demandé à la base, et une lecture qui n'atteint pas ce compte
 * est une ERREUR — jamais une liste partielle.
 */
export const PAGE_LECTURE = 1000;

export class ListeTronquee extends Error {
  constructor(contexte: string, lues: number, attendues: number) {
    super(
      `La lecture de la ${contexte} est incomplète (${lues} lignes sur ${attendues}) : rien n'est affiché plutôt qu'une liste fausse. Rechargez la page ; si cela persiste, signalez-le à l'administrateur (plafond de lignes du serveur).`
    );
    this.name = "ListeTronquee";
  }
}

type Reponse = { data: unknown; error: unknown; count?: number | null };

/**
 * `lire(debut, fin)` rend UNE page, par `.range(debut, fin)` sur un ordre
 * stable (départagé par une clé unique : à égalité, `range` sauterait ou
 * doublerait des lignes) et avec `{ count: "exact" }` dans le `select`.
 */
export async function lireTout<T>(lire: (debut: number, fin: number) => PromiseLike<Reponse>, schema: z.ZodType<T>, contexte: string, taillePage = PAGE_LECTURE): Promise<T[]> {
  const tout: T[] = [];
  let attendues: number | null = null;
  for (;;) {
    const debut = tout.length;
    const { data, error, count } = await lire(debut, debut + taillePage - 1);
    if (error) throw error;
    if (attendues === null && typeof count === "number") attendues = count;
    const page = analyser(z.array(schema), data, contexte);
    tout.push(...page);
    // Une page plus courte que demandé ne prouve pas la fin : le serveur a pu la plafonner.
    // On repart donc de ce qui a été LU, jusqu'au compte annoncé.
    const fini = attendues !== null ? tout.length >= attendues || page.length === 0 : page.length < taillePage;
    if (fini) break;
  }
  if (attendues !== null && tout.length < attendues) throw new ListeTronquee(contexte, tout.length, attendues);
  return tout;
}
