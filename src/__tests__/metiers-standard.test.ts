/**
 * Les métiers d'une société : ordre choisi, couleur conservée, et indélébiles
 * tant qu'on s'en sert.
 *
 * Trois manques, relevés en production le 21/09/2026 :
 *
 *  - trois sociétés sur quatre ne déclaraient AUCUN métier. La liste à cocher
 *    d'un bon de commande y était vide ;
 *  - `metiers` n'avait pas de colonne `couleur`. L'écran la faisait choisir
 *    dans une palette, l'enregistrait, et `colonnesDe()` l'écartait avant
 *    l'envoi — en silence. Le liseré des cartes du planning n'est jamais
 *    apparu ;
 *  - aucun ordre : la liste se triait par libellé.
 *
 * La migration `20260921160000_les_metiers_standard` ajoute les deux colonnes,
 * précharge les sept métiers standard, refuse la suppression d'un métier
 * employé et propage un renommage à tout ce qui le désigne par son nom.
 *
 * Essai à blanc sur la production (transaction annulée) :
 *
 *   akt / alkia / chm            → 7 métiers posés, dans l'ordre demandé
 *   kta (4 métiers déjà)         → laissé intact
 *   metier_normalise('Faïence')  → FAIENCE, comme 'FAIENCE'
 *   supprimer PEINTURE (employé) → REFUSÉ, « employé par 1 bon(s) de commande »
 *   supprimer CARRELAGE (libre)  → ACCEPTÉ
 *   renommer PEINTURE            → bons ET tâches suivent
 *
 * Ce qui se teste ici est le côté écran : l'ordre affiché et la permutation.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { normaliserLibelle } from "@/api/regles-metiers";

const SOURCE = readFileSync(resolve(__dirname, "../pages/app.js"), "utf8");
const MIGRATION = readFileSync(
  resolve(__dirname, "../../supabase/migrations/20260921160000_les_metiers_standard.sql"),
  "utf8"
);

function extraire(entete: string, nom: string): string {
  const debut = SOURCE.indexOf(`\n${entete} ${nom}(`);
  if (debut < 0) throw new Error(`\`${nom}\` introuvable dans src/pages/app.js`);
  const fin = SOURCE.indexOf("\n}", debut);
  if (fin < 0) throw new Error(`fin de \`${nom}\` introuvable dans src/pages/app.js`);
  return SOURCE.slice(debut, fin + 2);
}

interface Metier {
  id: string;
  societeId: string;
  nom: string;
  couleur?: string;
  position?: number;
}

function banc(metiers: Metier[]) {
  const ecrites: Record<string, Metier> = {};
  const state = { metiersPerso: metiers, societeId: "kta" };
  const fn = new Function(
    "state",
    "window",
    "showToast",
    "saveFailedMessage",
    "recharger",
    "renderTab",
    `${extraire("function", "metiersOrdonnes")}\n${extraire("async function", "deplacerMetier")};
     return { metiersOrdonnes, deplacerMetier };`
  )(
    state,
    {
      stSet: async (cle: string, valeur: Metier) => {
        ecrites[cle] = valeur;
        const i = state.metiersPerso.findIndex((m) => m.id === valeur.id);
        if (i >= 0) state.metiersPerso[i] = valeur;
        return true;
      },
    },
    () => {},
    () => "échec",
    async () => {},
    () => {}
  );
  return { ...fn, ecrites, state };
}

const METIERS: Metier[] = [
  { id: "m1", societeId: "kta", nom: "Peinture", position: 1 },
  { id: "m2", societeId: "kta", nom: "Sol", position: 2 },
  { id: "m3", societeId: "kta", nom: "Plomberie", position: 3 },
  { id: "m9", societeId: "autre", nom: "Ne doit pas apparaître", position: 1 },
];

const noms = (l: Metier[]) => l.map((m) => m.nom);

describe("L'ordre des métiers", () => {
  it("suit la position choisie, pas l'alphabet", () => {
    const { metiersOrdonnes } = banc(structuredClone(METIERS));
    expect(noms(metiersOrdonnes())).toEqual(["Peinture", "Sol", "Plomberie"]);
  });

  it("ne montre que ceux de la société courante", () => {
    const { metiersOrdonnes } = banc(structuredClone(METIERS));
    expect(noms(metiersOrdonnes())).not.toContain("Ne doit pas apparaître");
  });

  it("retombe sur l'alphabet quand aucune position n'est posée", () => {
    /* C'est l'état avant migration : toutes les positions valent zéro, et
       l'écran doit se comporter exactement comme avant. */
    const sansPosition = structuredClone(METIERS).map((m) => ({ ...m, position: undefined }));
    const { metiersOrdonnes } = banc(sansPosition);
    expect(noms(metiersOrdonnes())).toEqual(["Peinture", "Plomberie", "Sol"]);
  });

  it("ne modifie pas le tableau d'origine en triant", () => {
    const metiers = structuredClone(METIERS);
    const { metiersOrdonnes } = banc(metiers);
    metiersOrdonnes();
    expect(metiers[0].nom).toBe("Peinture");
  });
});

describe("Déplacer un métier", () => {
  it("descend un métier d'un cran en échangeant les deux positions", async () => {
    const b = banc(structuredClone(METIERS));

    await b.deplacerMetier("m1", 1);

    expect(b.ecrites["metierPerso:m1"].position).toBe(2);
    expect(b.ecrites["metierPerso:m2"].position).toBe(1);
  });

  it("monte un métier d'un cran", async () => {
    const b = banc(structuredClone(METIERS));

    await b.deplacerMetier("m3", -1);

    expect(b.ecrites["metierPerso:m3"].position).toBe(2);
    expect(b.ecrites["metierPerso:m2"].position).toBe(3);
  });

  it("n'écrit rien quand le premier veut monter", async () => {
    const b = banc(structuredClone(METIERS));

    await b.deplacerMetier("m1", -1);

    expect(Object.keys(b.ecrites)).toHaveLength(0);
  });

  it("n'écrit rien quand le dernier veut descendre", async () => {
    const b = banc(structuredClone(METIERS));

    await b.deplacerMetier("m3", 1);

    expect(Object.keys(b.ecrites)).toHaveLength(0);
  });

  it("sait permuter même quand toutes les positions sont égales", async () => {
    /* L'état avant migration : échanger deux zéros ne changerait rien. On
       leur donne leur rang courant avant de permuter. */
    const plats = structuredClone(METIERS).map((m) => ({ ...m, position: 0 }));
    const b = banc(plats);

    /* Ordre alphabétique : Peinture, Plomberie, Sol. */
    await b.deplacerMetier("m3", -1); // Plomberie monte

    expect(b.ecrites["metierPerso:m3"].position).toBe(1);
    expect(b.ecrites["metierPerso:m1"].position).toBe(2);
  });

  it("ne bouge pas sur un identifiant inconnu", async () => {
    const b = banc(structuredClone(METIERS));

    await b.deplacerMetier("inexistant", 1);

    expect(Object.keys(b.ecrites)).toHaveLength(0);
  });
});

describe("La migration et l'écran disent la même chose", () => {
  it("précharge les sept métiers demandés", () => {
    for (const m of ["Peinture", "Sol", "Plomberie", "Menuiserie", "Électricité", "Astreinte", "Faïence"]) {
      expect(MIGRATION).toContain(`'${m}'`);
    }
  });

  it("ne repose rien sur une société qui déclare déjà ses métiers", () => {
    /* Sinon une société qui a volontairement supprimé « Astreinte » la
       verrait réapparaître au prochain passage. */
    expect(MIGRATION).toContain("if exists (select 1 from public.metiers where societe_id = p_societe)");
  });

  it("normalise les libellés comme l'écran, accents compris", () => {
    /* Le miroir SQL doit confondre ce que l'écran confond : sinon le refus de
       suppression se contredirait avec la liste affichée. */
    expect(normaliserLibelle("Faïence")).toBe("FAIENCE");
    expect(normaliserLibelle("Électricité")).toBe("ELECTRICITE");
    expect(MIGRATION).toContain("create or replace function public.metier_normalise");
  });

  it("laisse les lignes de facture émise en dehors du renommage", () => {
    /* Un document parti chez le client ne se réécrit pas — et le déclencheur
       des factures figées le refuserait de toute façon. */
    expect(MIGRATION).toContain("coalesce(f.numero, '') = ''");
  });
});
