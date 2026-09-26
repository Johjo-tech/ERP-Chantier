import type { FiltresBons } from "./filtres";

/**
 * Ce que proposent les listes déroulantes de la barre des bons, lu dans les
 * ANNUAIRES comme l'ancien écran — conducteurs actifs (`conducteurFilterOptions`),
 * métiers déclarés (`metierPersoFilterOptions`), clients et leurs interlocuteurs
 * (`planningUnschedClientOptions` / `…InterlocuteurOptions`) — et non dans les
 * valeurs que portent les bons : un filtre qui ne trouve rien est une réponse,
 * pas une option à cacher.
 */
interface Annuaires {
  conducteurs: readonly { id: string; nom: string; actif: boolean }[];
  clients: readonly { nom: string; interlocuteurs: readonly { nom: string }[] }[];
  metiers: readonly string[];
}

const parNom = (a: string, b: string) => a.localeCompare(b, "fr");

export function optionsDesFiltres(a: Annuaires, f: Pick<FiltresBons, "conducteurId" | "client">) {
  // Un conducteur retiré garde des affaires à son nom : celui déjà choisi reste proposé.
  const conducteurs = a.conducteurs.filter((c) => c.actif || c.id === f.conducteurId).map((c) => ({ id: c.id, nom: c.nom })).sort((x, y) => parNom(x.nom, y.nom));
  const clients = a.clients.map((c) => c.nom).sort(parNom);
  // Un client choisi restreint les interlocuteurs aux siens ; un nom inconnu n'en a aucun.
  const source = f.client ? a.clients.filter((c) => c.nom === f.client).slice(0, 1) : a.clients;
  const interlocuteurs = source.flatMap((c) => c.interlocuteurs.map((i) => i.nom)).sort(parNom);
  return { conducteurs, clients, interlocuteurs, metiers: [...a.metiers].sort(parNom) };
}
