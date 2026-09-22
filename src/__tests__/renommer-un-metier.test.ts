/**
 * Renommer un métier va jusqu'au bout, même sur un bon facturé.
 *
 * Deux défauts dormaient dans les migrations de la veille, invisibles tant
 * qu'on ne renommait pas — et la reprise de casse (CARRELAGE → Carrelage) les
 * a réveillés tous les deux.
 *
 * 1. LE RENOMMAGE ÉTAIT REFUSÉ. `bon_commande_facture_fige` gèle par liste
 *    blanche, et `metier`, `metiers` et `montant_par_metier` n'y figurent pas.
 *    Or `metier_renomme_partout` écrit `bons_commande.metier`. Éprouvé sur la
 *    production : renommer PEINTURE en Peinture chez KTA levait
 *    « Ce bon de commande est facturé (FAC-2026-000011) : son contenu ne peut
 *    plus changer (metier) ». Le renommage entier était annulé.
 *
 * 2. LE RENOMMAGE LAISSAIT DES CLÉS DERRIÈRE LUI. `schedule_par_metier` et
 *    `montant_par_metier` sont des jsonb dont la CLÉ est le libellé du métier.
 *    Le déclencheur réécrivait `metier` et `metiers`, jamais ces clés : le bon
 *    aurait annoncé « Peinture » pendant que son planning répondait encore à
 *    « PEINTURE ». Aucun bon ne porte ces cartes aujourd'hui — zéro ligne
 *    vérifiée — donc rien ne cassait dans l'immédiat.
 *
 * Essai à blanc sur la production, migration appliquée dans une transaction
 * annulée, sur le bon que suit FAC-2026-000011 :
 *
 *   renommer PEINTURE → Peinture   ACCEPTÉ
 *   bon facturé, metier            PEINTURE → Peinture
 *   bon libre, metiers             ["Peinture", "SOL"]
 *   clés des cartes                SOL, Peinture  |  Peinture
 *   montants portés par les clés   {"SOL": 80, "Peinture": 120}  — intacts
 *   tâches de planning             Peinture, SOL
 *   changer pour un AUTRE métier   REFUSÉ
 *
 * Ce test-ci garde ce que le SQL doit continuer de dire : la règle est en
 * base, elle n'a pas de miroir TypeScript à éprouver.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const SQL = readFileSync(
  resolve(__dirname, "../../supabase/migrations/20260922090000_renommer_un_metier_va_jusqu_au_bout.sql"),
  "utf8"
);

/** Le corps d'une fonction SQL, de son `create or replace` à son `$fn$;`. */
function fonction(nom: string): string {
  const i = SQL.indexOf(`create or replace function public.${nom}`);
  if (i < 0) throw new Error(`\`${nom}\` introuvable dans la migration`);
  const fin = SQL.indexOf("$fn$;", i);
  return SQL.slice(i, fin);
}

describe("Le gel du bon facturé laisse passer une re-orthographe", () => {
  const gel = fonction("bon_commande_facture_fige");

  it("exempte les trois colonnes qui désignent un métier", () => {
    for (const col of ["metier", "metiers", "montant_par_metier"]) {
      expect(gel, col).toContain(`'${col}'`);
    }
    expect(gel).toContain("metiers_identiques_au_nom_pres");
  });

  it("n'ajoute PAS ces colonnes à la liste blanche", () => {
    /* La différence est tout le sujet : re-orthographier un métier est permis,
       le remplacer par un autre reste refusé. Les mettre en liste blanche
       ouvrirait les deux. */
    const listeBlanche = gel.slice(gel.indexOf("v_libres"), gel.indexOf("v_porte_un_metier"));
    for (const col of ["'metier'", "'metiers'", "'montant_par_metier'"]) {
      expect(listeBlanche, col).not.toContain(col);
    }
  });

  it("compare encore le reste à l'identique", () => {
    expect(gel).toContain("is not distinct from");
  });
});

describe("La comparaison « les mêmes métiers, autrement écrits »", () => {
  const cmp = fonction("metiers_identiques_au_nom_pres");

  it("traite les trois formes que prend un métier dans le schéma", () => {
    /* Le texte de `metier`, le tableau de `metiers`, et les cartes dont la
       clé est un nom de métier. En oublier une rouvre le refus. */
    for (const forme of ["'string'", "'array'", "'object'"]) {
      expect(cmp, forme).toContain(forme);
    }
  });

  it("trie les tableaux avant de comparer", () => {
    /* L'ordre des métiers cochés ne porte aucun sens : sans le tri, recocher
       les mêmes dans un autre ordre passerait pour une modification. */
    expect(cmp).toContain("order by n");
  });

  it("compare les VALEURS des cartes telles quelles", () => {
    /* Re-orthographier une clé est permis ; changer le montant qu'elle porte
       ne l'est pas. Normaliser les valeurs laisserait passer un montant. */
    expect(cmp).toContain("jsonb_object_agg(coalesce(public.metier_normalise(k), ''), v)");
  });
});

describe("Le renommage emporte les clés des cartes par métier", () => {
  const renomme = fonction("metier_renomme_partout");

  it("réécrit les deux cartes, pas seulement le tableau des métiers", () => {
    for (const carte of ["schedule_par_metier", "montant_par_metier"]) {
      expect(renomme, carte).toContain(`set ${carte} = (`);
    }
  });

  it("se garde d'effacer une planification vide", () => {
    /* `jsonb_object_agg` sur un objet vide rend NULL : sans les deux gardes,
       renommer un métier effacerait la planification au lieu de la renommer. */
    const cartes = renomme.slice(renomme.indexOf("schedule_par_metier"));
    expect((cartes.match(/jsonb_typeof\([^)]*\) = 'object'/g) || []).length).toBeGreaterThanOrEqual(2);
    expect((cartes.match(/and exists \(select 1 from jsonb_object_keys/g) || []).length).toBe(2);
  });

  it("laisse les lignes de facture émise en dehors", () => {
    /* Un document parti chez le client ne se réécrit pas. */
    expect(renomme).toContain("coalesce(f.numero, '') = ''");
  });

  it("propage aussi aux tâches de planning", () => {
    expect(renomme).toContain("update public.planning_taches");
  });
});
