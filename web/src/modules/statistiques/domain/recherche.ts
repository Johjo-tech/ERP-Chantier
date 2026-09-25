import { correspond } from "@/lib/recherche";
import { arrondiCentimes, formatEuros, montant, type Montant } from "@/lib/money";

/**
 * La recherche globale du tableau de bord (`globalSearchResultsList`, app.js
 * l. 2300) : devis, factures et rapports, chaque mot saisi devant se trouver
 * quelque part. Les montants cherchables sont ceux que la base a calculés
 * (`v_devis_totaux`, `v_facture_solde`), sous leurs deux écritures : « 1 234,50 € »
 * et « 1234.50 ».
 */

export interface DevisCherchable {
  id: string;
  numero: string;
  client_nom: string;
  interlocuteur: string | null;
  conducteur: string | null;
  adresse_locataire: string | null;
  ville: string | null;
  date: string;
  statut: string;
}

export interface FactureCherchable {
  facture_id: string;
  numero: string | null;
  client_nom: string;
  date: string;
  ttc: number;
}

export interface RapportCherchable {
  id: string;
  numero: string | null;
  client_nom: string;
  adresse: string | null;
  adresse_locataire: string | null;
  ville: string | null;
  occupant: string | null;
  metier: string | null;
  statut: string | null;
  date: string;
}

export type NatureResultat = "devis" | "facture" | "rapport";

export interface Resultat {
  nature: NatureResultat;
  id: string;
  client: string;
  numero: string;
  date: string;
  /** TTC pour une pièce chiffrée ; absent pour un rapport, qui montre son statut. */
  ttc: Montant | null;
  statut: string | null;
  lien: string;
}

export const LIBELLES_NATURE: Record<NatureResultat, string> = { devis: "Devis", facture: "Facture", rapport: "Rapport" };

function montantsCherchables(m: Montant): string[] {
  const affiche = formatEuros(arrondiCentimes(m));
  return [affiche, affiche.replace(/[^\d,-]/g, "").replace(",", ".")];
}

export interface SourcesRecherche {
  devis: readonly DevisCherchable[];
  totauxDevis: ReadonlyMap<string, number>;
  factures: readonly FactureCherchable[];
  rapports: readonly RapportCherchable[];
}

export function resultatsRecherche(requete: string, s: SourcesRecherche): Resultat[] {
  if (!requete.trim()) return [];
  const sortie: Resultat[] = [];
  for (const d of s.devis) {
    const ttc = s.totauxDevis.has(d.id) ? montant(s.totauxDevis.get(d.id)) : null;
    if (correspond(requete, d.numero, d.client_nom, d.interlocuteur, d.conducteur, d.adresse_locataire, d.ville, d.statut, ...(ttc ? montantsCherchables(ttc) : [])))
      sortie.push({ nature: "devis", id: d.id, client: d.client_nom, numero: d.numero, date: d.date, ttc, statut: d.statut, lien: `/devis/${d.id}` });
  }
  for (const f of s.factures) {
    const ttc = montant(f.ttc);
    if (correspond(requete, f.numero, f.client_nom, ...montantsCherchables(ttc)))
      sortie.push({ nature: "facture", id: f.facture_id, client: f.client_nom, numero: f.numero ?? "", date: f.date, ttc, statut: null, lien: `/factures/${f.facture_id}` });
  }
  for (const r of s.rapports) {
    if (correspond(requete, r.numero, r.client_nom, r.adresse, r.adresse_locataire, r.ville, r.occupant, r.metier, r.statut))
      sortie.push({ nature: "rapport", id: r.id, client: r.client_nom, numero: r.numero ?? "", date: r.date, ttc: null, statut: r.statut, lien: `/rapports/${r.id}` });
  }
  return sortie;
}

/** Entrée passe au résultat suivant, et reboucle (`globalSearchEnterCycle`). */
export function indexSuivant(courant: number | null, total: number): number | null {
  if (!total) return null;
  return courant === null ? 0 : (courant + 1) % total;
}
