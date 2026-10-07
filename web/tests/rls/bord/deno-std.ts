/**
 * Doublure de `https://deno.land/std/http/server.ts` pour exécuter une
 * fonction de bord dans Node (D-AUTH-09) : `serve(handler)` ne démarre aucun
 * serveur, il confie le gestionnaire au test, qui l'appelle avec une vraie
 * `Request`.
 */
type Gestionnaire = (req: Request) => Response | Promise<Response>;

const registre = globalThis as typeof globalThis & { __gestionnaireBord?: Gestionnaire };

export function serve(gestionnaire: Gestionnaire): void {
  registre.__gestionnaireBord = gestionnaire;
}

export function gestionnaireBord(): Gestionnaire {
  const g = registre.__gestionnaireBord;
  if (!g) throw new Error("La fonction de bord n'a pas appelé serve() à son chargement.");
  return g;
}
