import { arrondiCentimes, montant, type Montant } from "@/lib/money";
import { DEMI_CENTIME } from "./reglements";
import type { Solde } from "./solde";

/** Les avoirs qui peuvent solder cette facture : émis, du même client, avec un crédit (`peutReglerParAvoir`). */
export function avoirsImputables(facture: Pick<Solde, "client_nom">, soldes: readonly Solde[]): Solde[] {
  return soldes.filter((s) => s.sens < 0 && !!s.numero && s.credit > 0 && s.client_nom.trim() === facture.client_nom.trim());
}

/**
 * La sélection du dossier client décrit-elle un LETTRAGE — une facture en
 * face d'un avoir (`lettrageDeLaSelection`, app.js l. 10976) ? Exactement
 * deux pièces, une de chaque sorte, toutes deux avec un reste, la facture
 * émise. Au-delà, on ne devine pas quel crédit va sur quelle créance : c'est
 * une décision comptable, pas une répartition automatique.
 */
export interface PieceLettrable {
  facture_id: string;
  numero: string | null;
  sens: number;
  reste: number;
}

/** Le plus petit des deux restes (`montantImputable`) : ni plus que l'avoir, ni plus que la facture. */
export function montantImputable(resteFacture: unknown, resteAvoir: unknown): Montant {
  const f = arrondiCentimes(montant(resteFacture));
  const a = arrondiCentimes(montant(resteAvoir));
  const plusPetit = f.lt(a) ? f : a;
  return plusPetit.lt(0) ? montant(0) : plusPetit;
}

export function lettrageDeLaSelection<P extends PieceLettrable>(pieces: readonly P[], selection: readonly string[]): { avoir: P; facture: P; montant: Montant } | null {
  if (selection.length !== 2) return null;
  const choisies = selection.map((id) => pieces.find((p) => p.facture_id === id)).filter((p): p is P => !!p);
  if (choisies.length !== 2) return null;
  const avoir = choisies.find((p) => p.sens < 0);
  const facture = choisies.find((p) => p.sens > 0);
  if (!avoir || !facture || !facture.numero) return null;
  const m = montantImputable(facture.reste, avoir.reste);
  return m.lt(DEMI_CENTIME) ? null : { avoir, facture, montant: m };
}
