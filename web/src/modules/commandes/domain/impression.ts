import { metiersDuBon } from "./metiers";

/**
 * Ce qu'un bon imprimé porte en plus d'un devis (bonCommandeDocMetaLignes,
 * app.js l. 3932, BC-80) : la référence du CLIENT dès qu'elle existe — elle
 * n'apparaissait qu'avec un numéro interne, et 788 bons sur 826 imprimaient un
 * document muet sur la seule référence que le client connaisse —, le
 * conducteur et les métiers.
 */
export function metaImpressionBon(b: { numero_bc: string | null; conducteur: string | null; metiers: unknown; metier: string | null }): { libelle: string; valeur: string }[] {
  const metiers = metiersDuBon(b);
  return [
    b.numero_bc ? { libelle: "Réf. client", valeur: b.numero_bc } : null,
    b.conducteur ? { libelle: "Conducteur", valeur: b.conducteur } : null,
    metiers.length ? { libelle: "Métiers", valeur: metiers.join(", ") } : null,
  ].filter((x): x is { libelle: string; valeur: string } => x !== null);
}
