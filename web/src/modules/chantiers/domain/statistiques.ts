import { montant, somme, type Montant } from "@/lib/money";
import { avancementChantier, type AvancementChantier, type LigneDpgf } from "./dpgf";

/**
 * Les chiffres en tête de fiche (app.js l. 13361-13415) : avancement facturé,
 * total du DPGF, devis, comptes-rendus, achats, factures. S'y ajoute la marge
 * brute constatée (facturé − achats) et l'avancement de la to-do : l'ancienne
 * fiche donnait les deux termes sans les rapprocher.
 */
export interface StatistiquesChantier {
  avancement: AvancementChantier | null;
  totalAchats: Montant | null;
  margeConstatee: Montant | null;
  nbDevis: number | null;
  nbFactures: number | null;
  nbComptesRendus: number;
  todo: { faits: number; total: number };
}

export interface SourcesStatistiques {
  /** null = le rôle ne lit pas cette table : la case est masquée, pas mise à zéro. */
  dpgf: readonly LigneDpgf[] | null;
  achats: readonly { montant: number | string }[] | null;
  nbDevis: number | null;
  nbFactures: number | null;
  nbComptesRendus: number;
  todo: { faits: number; total: number };
}

export function statistiquesChantier(s: SourcesStatistiques): StatistiquesChantier {
  const avancement = s.dpgf ? avancementChantier(s.dpgf) : null;
  const totalAchats = s.achats ? somme(s.achats.map((a) => montant(a.montant))) : null;
  return {
    avancement,
    totalAchats,
    margeConstatee: avancement && totalAchats ? avancement.facture.minus(totalAchats) : null,
    nbDevis: s.nbDevis,
    nbFactures: s.nbFactures,
    nbComptesRendus: s.nbComptesRendus,
    todo: s.todo,
  };
}
