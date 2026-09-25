import { moisIso } from "@/lib/dates";
import { z } from "zod";
import { ZERO, somme, type Montant } from "@/lib/money";
import { pourcentage, schemaMontantBase } from "./indicateurs";

/**
 * L'écran Statistiques (`renderStatistiques`, app.js l. 12108) : par conducteur,
 * par métier, par client, et le chiffre d'affaires par équipe et par mois.
 * Les comptes et les montants viennent de la base ; l'écran n'en tire que des taux.
 */

export const schemaStatConducteur = z.object({
  conducteur_id: z.string().nullable(),
  nom: z.string(),
  ht: schemaMontantBase,
  bons: z.number(),
  sav: z.number(),
  en_retard: z.number(),
  devis: z.number(),
  devis_acceptes: z.number(),
  devis_transformes: z.number(),
  bons_avec_travaux: z.number(),
  travaux: z.number(),
  travaux_ht: schemaMontantBase,
});
export type StatConducteur = z.infer<typeof schemaStatConducteur>;

export interface TauxConducteur {
  dansLesTemps: number;
  tauxDansLesTemps: number;
  tauxRetard: number;
  tauxSav: number;
  tauxDevisAcceptes: number;
  tauxDevisTransformes: number;
  tauxTravaux: number;
}

/** Les taux de `computeStatsParConducteur` : entiers, 0 sans dénominateur ; le retard est le complément. */
export function tauxConducteur(s: StatConducteur): TauxConducteur {
  const dansLesTemps = s.bons - s.en_retard;
  const tauxDansLesTemps = pourcentage(dansLesTemps, s.bons);
  return {
    dansLesTemps,
    tauxDansLesTemps,
    tauxRetard: s.bons ? 100 - tauxDansLesTemps : 0,
    tauxSav: pourcentage(s.sav, s.bons),
    tauxDevisAcceptes: pourcentage(s.devis_acceptes, s.devis),
    tauxDevisTransformes: pourcentage(s.devis_transformes, s.devis),
    tauxTravaux: pourcentage(s.bons_avec_travaux, s.bons),
  };
}

export const schemaStatMetier = z.object({
  metier: z.string(),
  bons: z.number(),
  sav: z.number(),
  en_retard: z.number(),
  ht: schemaMontantBase,
});
export type StatMetier = z.infer<typeof schemaStatMetier>;

export const schemaCaEquipe = z.object({
  equipe_id: z.string().nullable(),
  equipe: z.string(),
  mois: z.string(),
  ht: schemaMontantBase,
});
export type CaEquipe = z.infer<typeof schemaCaEquipe>;

export const NON_ATTRIBUE = "Non attribué";

export interface TableauEquipes {
  mois: string[];
  equipes: { nom: string; parMois: Map<string, Montant>; total: Montant }[];
}

/**
 * Le tableau croisé équipe × mois (`computeStatsBinomesParMois`) : mois
 * triés, équipes par ordre alphabétique, « Non attribué » en dernier.
 */
export function tableauEquipes(lignes: readonly CaEquipe[]): TableauEquipes {
  const mois = [...new Set(lignes.map((l) => moisIso(l.mois)))].sort();
  const parEquipe = new Map<string, Map<string, Montant>>();
  for (const l of lignes) {
    const m = parEquipe.get(l.equipe) ?? new Map<string, Montant>();
    const cle = moisIso(l.mois);
    m.set(cle, (m.get(cle) ?? ZERO).plus(l.ht));
    parEquipe.set(l.equipe, m);
  }
  const noms = [...parEquipe.keys()].sort((a, b) => (a === NON_ATTRIBUE ? 1 : b === NON_ATTRIBUE ? -1 : a.localeCompare(b, "fr")));
  return {
    mois,
    equipes: noms.map((nom) => {
      const parMois = parEquipe.get(nom) ?? new Map<string, Montant>();
      return { nom, parMois, total: somme(parMois.values()) };
    }),
  };
}

/** Part de chacun dans un total (répartition du chiffre d'affaires). */
export function repartition<T extends { ht: Montant }>(lignes: readonly T[]): { ligne: T; part: number }[] {
  const positifs = lignes.filter((l) => l.ht.gt(ZERO));
  const total = somme(positifs.map((l) => l.ht));
  return [...positifs].sort((a, b) => b.ht.cmp(a.ht)).map((ligne) => ({ ligne, part: pourcentage(ligne.ht, total) }));
}
