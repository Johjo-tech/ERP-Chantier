/**
 * Un travail supplémentaire appartient au corps d'état sur lequel il a été
 * constaté.
 *
 * CE QUI N'ALLAIT PAS. Les travaux constatés sur le chantier étaient groupés
 * dans un chapitre à part, en fin de document, et sans métier. Trois
 * conséquences, toutes silencieuses :
 *
 *  - le sous-total par métier ne les comptait nulle part. Le directeur
 *    arbitrait un chiffrage PAR CORPS D'ÉTAT dont les ajouts du chantier
 *    étaient absents — c'est pourtant ce total-là qui engage ;
 *  - la colonne « Métier » de ces lignes était toujours vide. Non par oubli
 *    d'affichage : `tache_travaux_supplementaires` n'a pas de colonne `metier`,
 *    et personne ne remontait celui de la tâche ;
 *  - `bc_generer_facture` les colle tout à la fin de la facture SANS chapitre.
 *    Ils tombaient donc sous le dernier chapitre du bon, attribués à un métier
 *    qui n'était pas le leur.
 *
 * LA CLÉ EXISTAIT DÉJÀ. `tache_travaux_supplementaires.planning_tache_id`
 * désigne la tâche, et `planning_taches.metier` porte le métier. Aucune colonne
 * à ajouter : une colonne `metier` sur le travail serait une seconde vérité à
 * tenir d'accord avec la première.
 *
 * Mais elle n'était pas remplie : l'écran n'enregistrait la tâche que si le bon
 * n'en portait qu'UNE (`wfTaches.length === 1`) — donc jamais sur un bon
 * multi-métiers, le seul cas où le chapitre a un sens. Zéro travail
 * supplémentaire existait en production : rien à reprendre.
 */

import { describe, it, expect } from "vitest";
import {
  CHAPITRE_BON_COMMANDE,
  CHAPITRE_TRAVAUX_SUP,
  CLASSE_AJOUT,
  lignesAEnregistrer,
  lignesDocumentDirecteur,
  metierDuTravail,
  placerTravauxDansChapitres,
  type LigneAffichee,
  type TacheTerrain,
  type TravailAffichable,
} from "@/integrations/prefacture";

const CONNUS = ["Peinture", "Plomberie", "Sol", "Électricité"];

const TACHES: TacheTerrain[] = [
  { id: "t-peinture", metier: "Peinture", libelle: "Peinture — jour 1" },
  { id: "t-plomberie", metier: "PLOMBERIE", libelle: "Plomberie — jour 2" },
  { id: "t-sans-metier", metier: null, libelle: "Intervention" },
];

/** Un bon à deux corps d'état, chacun avec son chapitre et ses lignes. */
function bonDeuxMetiers(): LigneAffichee[] {
  return [
    { type: "chapitre", designation: "Peinture — séjour" },
    { type: "ligne", designation: "Réfection plafond", qte: 12, prixUnitaire: 18.5 },
    { type: "ligne", designation: "Impression des murs", qte: 34, prixUnitaire: 6.2 },
    { type: "chapitre", designation: "Plomberie" },
    { type: "ligne", designation: "Remplacement flexible", qte: 1, prixUnitaire: 35 },
  ];
}

const travail = (t: Partial<TravailAffichable>): TravailAffichable => ({
  libelle: "Travail",
  statut: "chiffre",
  quantite: 1,
  unite: "u",
  prix_vente_ht: 42,
  origine: "technicien",
  ...t,
});

const designations = (l: LigneAffichee[]) => l.map((x) => x.designation);

describe("Le métier d'un travail se lit sur sa tâche", () => {
  it("remonte le métier de la tâche désignée", () => {
    expect(metierDuTravail(travail({ planning_tache_id: "t-plomberie" }), TACHES))
      .toBe("PLOMBERIE");
  });

  it("ne rend rien pour un travail sans tâche", () => {
    /* Le conducteur saisit au niveau du bon : aucune tâche à désigner. */
    expect(metierDuTravail(travail({ planning_tache_id: null }), TACHES)).toBeNull();
  });

  it("ne rend rien quand la tâche n'a pas de métier", () => {
    expect(metierDuTravail(travail({ planning_tache_id: "t-sans-metier" }), TACHES))
      .toBeNull();
  });

  it("ne rend rien quand la tâche a disparu", () => {
    /* Une tâche supprimée ne doit pas faire tomber l'écran de chiffrage. */
    expect(metierDuTravail(travail({ planning_tache_id: "t-effacee" }), TACHES))
      .toBeNull();
  });
});

describe("Le placement dans les chapitres", () => {
  it("pose le travail après la DERNIÈRE ligne de son chapitre", () => {
    /* Et non juste après le titre : le poser en tête du chapitre le ferait
       passer pour la première chose commandée. */
    const p = placerTravauxDansChapitres(
      bonDeuxMetiers(),
      [travail({ planning_tache_id: "t-peinture" })],
      TACHES,
      CONNUS
    );

    expect([...p.apres.keys()]).toEqual([2]);
    expect(p.restants).toEqual([]);
  });

  it("reconnaît le chapitre malgré la casse et les accents", () => {
    /* La tâche porte « PLOMBERIE », le chapitre « Plomberie ». `memeMetier`
       les confond déjà partout ailleurs — ici aussi, sinon le travail
       tomberait dans le groupe de fin sans que rien ne le dise. */
    const p = placerTravauxDansChapitres(
      bonDeuxMetiers(),
      [travail({ planning_tache_id: "t-plomberie" })],
      TACHES,
      CONNUS
    );

    expect([...p.apres.keys()]).toEqual([4]);
  });

  it("déduit le métier d'un chapitre qui ne le déclare pas", () => {
    /* C'est le cas des 830 bons de production : le chapitre porte son métier
       dans son TITRE, pas dans sa colonne. `metierDeLaLigne` fait autorité —
       la règle que l'écran et le planning lisent déjà. */
    const lignes: LigneAffichee[] = [
      { type: "chapitre", designation: "Travaux de peinture intérieure" },
      { type: "ligne", designation: "Plafond", qte: 1, prixUnitaire: 10 },
    ];
    const p = placerTravauxDansChapitres(
      lignes,
      [travail({ planning_tache_id: "t-peinture" })],
      TACHES,
      CONNUS
    );

    expect(p.restants).toEqual([]);
    expect([...p.apres.keys()]).toEqual([1]);
  });

  it("laisse à part ce qu'aucun chapitre ne réclame", () => {
    /* Un travail du conducteur, sans tâche ; et un travail dont le métier n'a
       pas de chapitre sur ce bon. Les rattacher au hasard serait pire que de
       les laisser visibles à part. */
    const sansTache = travail({ libelle: "Nettoyage fin de chantier" });
    const p = placerTravauxDansChapitres(
      bonDeuxMetiers(),
      [sansTache, travail({ planning_tache_id: "t-sans-metier", libelle: "Divers" })],
      TACHES,
      CONNUS
    );

    expect(p.apres.size).toBe(0);
    expect(p.restants.map((t) => t.libelle)).toEqual(["Nettoyage fin de chantier", "Divers"]);
  });

  it("groupe plusieurs travaux du même métier au même endroit", () => {
    const p = placerTravauxDansChapitres(
      bonDeuxMetiers(),
      [
        travail({ planning_tache_id: "t-plomberie", libelle: "Siphon" }),
        travail({ planning_tache_id: "t-plomberie", libelle: "Joint" }),
      ],
      TACHES,
      CONNUS
    );

    expect(p.apres.get(4)?.map((t) => t.libelle)).toEqual(["Siphon", "Joint"]);
  });
});

describe("Le document du directeur", () => {
  it("glisse chaque travail dans son chapitre, dans l'ordre", () => {
    const doc = lignesDocumentDirecteur(
      bonDeuxMetiers(),
      [
        travail({ planning_tache_id: "t-plomberie", libelle: "Siphon fendu" }),
        travail({ planning_tache_id: "t-peinture", libelle: "Reprise d'enduit" }),
      ],
      10,
      TACHES,
      CONNUS
    );

    expect(designations(doc)).toEqual([
      "Peinture — séjour",
      "Réfection plafond",
      "Impression des murs",
      "Reprise d'enduit",
      "Plomberie",
      "Remplacement flexible",
      "Siphon fendu",
    ]);
  });

  it("n'ouvre le chapitre de fin que s'il reste quelque chose à y mettre", () => {
    /* Tous placés : un chapitre « Travaux supplémentaires » vide afficherait
       un sous-total à 0,00 € que le directeur pourrait lire comme un total. */
    const doc = lignesDocumentDirecteur(
      bonDeuxMetiers(),
      [travail({ planning_tache_id: "t-peinture" })],
      10,
      TACHES,
      CONNUS
    );

    expect(designations(doc)).not.toContain(CHAPITRE_TRAVAUX_SUP);
  });

  it("garde le chapitre de fin pour ce qui n'a pas trouvé sa place", () => {
    const doc = lignesDocumentDirecteur(
      bonDeuxMetiers(),
      [
        travail({ planning_tache_id: "t-peinture", libelle: "Reprise d'enduit" }),
        travail({ libelle: "Nettoyage fin de chantier" }),
      ],
      10,
      TACHES,
      CONNUS
    );

    const i = designations(doc).indexOf(CHAPITRE_TRAVAUX_SUP);
    expect(i).toBeGreaterThan(-1);
    expect(designations(doc).slice(i + 1)).toEqual(["Nettoyage fin de chantier"]);
  });

  it("surligne l'ajout et dit son origine, où qu'il soit posé", () => {
    /* Posée DANS un chapitre du bon, la ligne serait sans cela indiscernable
       de ce que le client a commandé. */
    const doc = lignesDocumentDirecteur(
      bonDeuxMetiers(),
      [travail({ planning_tache_id: "t-peinture", libelle: "Reprise d'enduit" })],
      10,
      TACHES,
      CONNUS
    );
    const ajout = doc.find((l) => l.designation === "Reprise d'enduit");

    expect(ajout?.classe).toBe(CLASSE_AJOUT);
    expect(ajout?.badge).toBe("Ajouté — technicien");
  });

  it("se comporte comme avant sans tâches ni référentiel", () => {
    /* Compatibilité de la signature : appelée à trois arguments — c'est encore
       le cas du pont — elle groupe tout à la fin, comme auparavant. */
    const doc = lignesDocumentDirecteur(bonDeuxMetiers(), [travail({ libelle: "Siphon" })], 10);

    expect(designations(doc).slice(-2)).toEqual([CHAPITRE_TRAVAUX_SUP, "Siphon"]);
  });

  it("coiffe toujours des lignes sans structure avant d'ajouter", () => {
    /* `printableLignesRows` n'émet un sous-total qu'après un chapitre : sans ce
       chapitre en tête, les lignes d'origine n'en auraient pas alors que les
       ajouts en auraient un. */
    const doc = lignesDocumentDirecteur(
      [{ type: "ligne", designation: "Travaux divers", qte: 1, prixUnitaire: 100 }],
      [travail({ libelle: "Siphon" })],
      10,
      TACHES,
      CONNUS
    );

    expect(designations(doc)[0]).toBe(CHAPITRE_BON_COMMANDE);
  });

  it("ne touche à rien quand il n'y a aucun travail", () => {
    const lignes = bonDeuxMetiers();
    expect(lignesDocumentDirecteur(lignes, [], 10, TACHES, CONNUS)).toEqual(lignes);
  });
});

describe("Ce qui s'enregistre sur le bon", () => {
  it("laisse l'affichage à l'affichage", () => {
    /* `classe` et `badge` n'ont ni colonne ni sens sur le bon enregistré.
       `colonnesDe()` les écarterait en silence — c'est exactement le genre de
       champ que ce projet a déjà vu disparaître sans un mot. */
    const doc = lignesDocumentDirecteur(
      bonDeuxMetiers(),
      [travail({ planning_tache_id: "t-peinture", libelle: "Reprise d'enduit" })],
      10,
      TACHES,
      CONNUS
    );
    const aEcrire = lignesAEnregistrer(doc);

    expect(aEcrire.some((l) => "classe" in l || "badge" in l)).toBe(false);
    expect(designations(aEcrire)).toEqual(designations(doc));
  });

  it("garde la quantité et le prix, qui eux partent sur la facture", () => {
    const aEcrire = lignesAEnregistrer(
      lignesDocumentDirecteur(
        bonDeuxMetiers(),
        [travail({ planning_tache_id: "t-peinture", libelle: "Reprise", quantite: 4, prix_vente_ht: 12.5, unite: "m²" })],
        10,
        TACHES,
        CONNUS
      )
    );
    const ligne = aEcrire.find((l) => l.designation === "Reprise");

    expect(ligne).toMatchObject({ type: "ligne", qte: 4, prixUnitaire: 12.5, unite: "m²" });
  });
});

describe("L'écran enregistre la tâche de la carte ouverte", () => {
  it("ne teste plus le nombre de tâches du bon", async () => {
    /* `wfTaches.length === 1` ratait exactement le cas utile : sur un bon
       multi-métiers, il rendait `null`, et le travail perdait le seul lien qui
       dit son métier. La première entrée de `wfTaches` est toujours celle de
       la carte ouverte — `chargerWorkflowTache` ne met les tâches orphelines
       qu'APRÈS elle. */
    const { readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    const source = readFileSync(resolve(__dirname, "../pages/app.js"), "utf8");

    expect(source).not.toContain("wfTaches.length === 1 ? wfTaches[0].tache.id : null");
    expect(source).toContain("planning_tache_id: tacheId || null");
    expect(source).toContain("function tacheDeLaCarteOuverte(bcId)");
    expect(source).toContain("tacheDeLaCarteOuverte(techModalCtx.bcId)");
  });
});
