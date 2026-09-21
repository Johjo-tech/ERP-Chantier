/**
 * Les travaux d'un bon, répartis entre les métiers par leurs chapitres.
 *
 * Les chapitres employés ici sont ceux de la production au 15/09/2026 : cinq
 * « PEINTURE … » distincts, quatre « SOL … », un « PLOMBEIRE » fautif, et deux
 * titres — « ARTICLE BPU », « LA C'EST UN AUTRE CHAPITRE » — qui structurent le
 * document sans désigner personne. Le cas dominant n'est pourtant aucun de
 * ceux-là : 210 lignes sur 230 bons lignés sont posées **avant tout chapitre**.
 *
 * `index.html` n'a aucun test : la règle est éprouvée ici, l'écran ne fait que
 * la rendre.
 */

import { describe, it, expect } from "vitest";
import {
  METIER_AUCUN,
  travauxDeLaCarte,
  travauxParMetier,
  type LigneTravail,
} from "@/api/regles-metiers";

const CONNUS = ["PEINTURE", "SOL", "CARRELAGE", "PLOMBERIE", "ETANCHEITE"];

const chapitre = (designation: string): LigneTravail => ({ type: "chapitre", designation });
const travail = (designation: string, qte?: number, unite?: string): LigneTravail => ({
  type: "ligne",
  designation,
  qte,
  unite,
});

describe("Répartition des travaux par métier", () => {
  it("rassemble sous un seul métier les chapitres qui le désignent tous", () => {
    const groupes = travauxParMetier(
      [
        chapitre("PEINTURE CHAMBRE 1"),
        travail("Reprise enduit plafond", 12, "m²"),
        chapitre("PEINTURE LOGEMENT COMPLET"),
        travail("Peinture 2 couches", 28, "m²"),
      ],
      CONNUS
    );

    expect(groupes).toHaveLength(1);
    expect(groupes[0].metier).toBe("PEINTURE");
    expect(groupes[0].lignes).toHaveLength(2);
  });

  /* Une seule venue de l'équipe, mais le bon nomme les pièces : les fondre
     ferait perdre la seule indication de lieu que le technicien possède. */
  it("garde pourtant les chapitres distincts sous ce métier", () => {
    const [peinture] = travauxParMetier(
      [
        chapitre("PEINTURE CHAMBRE 1"),
        travail("Reprise enduit plafond"),
        chapitre("PEINTURE CHAMBRE 2"),
        travail("Peinture 2 couches"),
      ],
      CONNUS
    );

    expect(peinture.chapitres.map((c) => c.chapitre)).toEqual([
      "PEINTURE CHAMBRE 1",
      "PEINTURE CHAMBRE 2",
    ]);
  });

  it("sépare les métiers, dans l'ordre du bon", () => {
    const groupes = travauxParMetier(
      [
        chapitre("SOL TOUT LE LOGEMENT"),
        travail("Dépose lino"),
        chapitre("PEINTURE"),
        travail("Peinture 2 couches"),
      ],
      CONNUS
    );

    expect(groupes.map((g) => g.metier)).toEqual(["SOL", "PEINTURE"]);
  });

  it("reconnaît un chapitre mal orthographié", () => {
    const [groupe] = travauxParMetier([chapitre("PLOMBEIRE"), travail("Siphon")], CONNUS);
    expect(groupe.metier).toBe("PLOMBERIE");
  });

  /* Ces deux titres existent en production. Ils structurent le document sans
     désigner de métier : leurs travaux ne doivent pas être perdus pour autant. */
  it("retient les travaux d'un chapitre qui ne désigne aucun métier", () => {
    const groupes = travauxParMetier(
      [chapitre("ARTICLE BPU"), travail("Fourniture diverse"), chapitre("LA C'EST UN AUTRE CHAPITRE"), travail("Autre chose")],
      CONNUS
    );

    expect(groupes).toHaveLength(1);
    expect(groupes[0].metier).toBeNull();
    expect(groupes[0].lignes).toHaveLength(2);
    expect(groupes[0].chapitres.map((c) => c.chapitre)).toEqual([
      "ARTICLE BPU",
      "LA C'EST UN AUTRE CHAPITRE",
    ]);
  });

  /* Le cas courant : 210 lignes en production ne sont précédées d'aucun titre. */
  it("range les lignes posées avant tout chapitre sans chapitre", () => {
    const groupes = travauxParMetier([travail("Remplacement siphon"), travail("Joint")], CONNUS);

    expect(groupes).toHaveLength(1);
    expect(groupes[0].metier).toBeNull();
    expect(groupes[0].chapitres[0].chapitre).toBeNull();
    expect(groupes[0].lignes).toHaveLength(2);
  });

  /* Deviner « PLOMBERIE » sur « Remplacement siphon » reviendrait à faire ce que
     `metiersDesChapitres` refuse : une déduction fausse coûte plus qu'un vide. */
  it("ne déduit jamais un métier de la désignation d'une ligne", () => {
    const [groupe] = travauxParMetier([travail("Remplacement siphon PLOMBERIE")], CONNUS);
    expect(groupe.metier).toBeNull();
  });

  it("ne garde ni les lignes vides ni les titres de chapitre eux-mêmes", () => {
    const groupes = travauxParMetier(
      [chapitre("PEINTURE"), travail(""), travail("   "), travail("Peinture 2 couches")],
      CONNUS
    );
    expect(groupes[0].lignes).toHaveLength(1);
  });

  it("laisse le commentaire sous le chapitre qu'il qualifie", () => {
    const [groupe] = travauxParMetier(
      [
        chapitre("PEINTURE"),
        travail("Peinture 2 couches"),
        { type: "commentaire", designation: "Teinte au choix du locataire" },
      ],
      CONNUS
    );
    expect(groupe.lignes).toHaveLength(2);
    expect(groupe.chapitres).toHaveLength(1);
  });

  it("conserve quantité et unité, qu'il y ait un prix ou non", () => {
    const [groupe] = travauxParMetier(
      [chapitre("SOL"), { type: "ligne", designation: "Dépose lino", qte: 14, unite: "m²" }],
      CONNUS
    );
    expect(groupe.lignes[0]).toMatchObject({ qte: 14, unite: "m²" });
  });

  it("ne rend rien pour un bon sans ligne", () => {
    expect(travauxParMetier([], CONNUS)).toEqual([]);
    expect(travauxParMetier(null, CONNUS)).toEqual([]);
  });
});

describe("Les travaux que porte une carte", () => {
  const BON = [
    travail("Constat d'huissier"),
    chapitre("PEINTURE CHAMBRE 1"),
    travail("Reprise enduit plafond"),
    chapitre("SOL TOUT LE LOGEMENT"),
    travail("Dépose lino"),
  ];

  it("montre à un métier ses seuls travaux", () => {
    const blocs = travauxDeLaCarte(BON, CONNUS, "SOL", "PEINTURE");
    expect(blocs.flatMap((b) => b.lignes.map((l) => l.designation))).toEqual(["Dépose lino"]);
  });

  /* Un travail que personne ne voit ne se fait pas : les lignes hors chapitre
     paraissent sur la première carte, et là seulement — même règle que les
     tâches orphelines, et pour la même raison. */
  it("joint les travaux hors chapitre à la première carte", () => {
    const blocs = travauxDeLaCarte(BON, CONNUS, "PEINTURE", "PEINTURE");
    const designations = blocs.flatMap((b) => b.lignes.map((l) => l.designation));
    expect(designations).toContain("Reprise enduit plafond");
    expect(designations).toContain("Constat d'huissier");
  });

  it("ne les répète sur aucune autre carte", () => {
    const blocs = travauxDeLaCarte(BON, CONNUS, "SOL", "PEINTURE");
    expect(blocs.flatMap((b) => b.lignes.map((l) => l.designation))).not.toContain(
      "Constat d'huissier"
    );
  });

  it("les montre quand même sur un bon qui n'a qu'un métier", () => {
    const blocs = travauxDeLaCarte(
      [travail("Constat d'huissier"), chapitre("PEINTURE"), travail("Peinture 2 couches")],
      CONNUS,
      "PEINTURE",
      "PEINTURE"
    );
    expect(blocs.flatMap((b) => b.lignes.map((l) => l.designation))).toHaveLength(2);
  });

  it("compare les métiers sans s'arrêter à la casse ni aux accents", () => {
    const blocs = travauxDeLaCarte(
      [chapitre("ETANCHEITE"), travail("Reprise relevé")],
      CONNUS,
      "Étanchéité",
      "Étanchéité"
    );
    expect(blocs).toHaveLength(1);
  });

  it("ne rend rien à un métier que le bon ne porte pas", () => {
    expect(travauxDeLaCarte(BON, CONNUS, "CARRELAGE", "PEINTURE")).toEqual([]);
  });
});

describe("Un chapitre dont le métier a été tranché", () => {
  /* La carte du planning doit suivre la même précédence que les cases du bon.
     Si elle ne la suivait pas, corriger un chapitre changerait les métiers
     annoncés sans déplacer les travaux : l'équipe SOL arriverait avec la liste
     de la peinture. */
  it("emporte ses travaux sur la carte du métier choisi", () => {
    const lignes: LigneTravail[] = [
      { type: "chapitre", designation: "PEINTURE CHAMBRE 1", metier: "SOL" },
      travail("Ragréage", 12, "m²"),
    ];
    const groupes = travauxParMetier(lignes, CONNUS);
    expect(groupes.map((g) => g.metier)).toEqual(["SOL"]);
    expect(groupes[0].lignes.map((l) => l.designation)).toEqual(["Ragréage"]);
  });

  /* Une tâche vaut bon × métier × jour, jamais bon × chapitre : deux chapitres
     ramenés au même métier sont une seule venue d'équipe, mais leurs travaux
     restent séparés — c'est la seule indication de pièce que porte le bon. */
  it("fusionne avec un autre chapitre du même métier, sans mêler leurs blocs", () => {
    const lignes: LigneTravail[] = [
      { type: "chapitre", designation: "SALLE DE BAIN", metier: "PLOMBERIE" },
      travail("Remplacement siphon"),
      { type: "chapitre", designation: "CUISINE", metier: "PLOMBERIE" },
      travail("Robinet mitigeur"),
    ];
    const groupes = travauxParMetier(lignes, CONNUS);
    expect(groupes).toHaveLength(1);
    expect(groupes[0].metier).toBe("PLOMBERIE");
    expect(groupes[0].chapitres.map((c) => c.chapitre)).toEqual(["SALLE DE BAIN", "CUISINE"]);
  });

  /* `null` (hors chapitre) n'est pas un métier, et un chapitre refusé n'est pas
     « hors chapitre » : les mêler ferait paraître les travaux d'un chapitre
     nommé sur la carte du premier métier, où personne ne les cherche. */
  it("refusé, ne rejoint pas les lignes posées avant tout chapitre", () => {
    const lignes: LigneTravail[] = [
      travail("Dépose bâche"),
      { type: "chapitre", designation: "ARTICLE BPU", metier: METIER_AUCUN },
      travail("Forfait déplacement"),
    ];
    const groupes = travauxParMetier(lignes, CONNUS);
    expect(groupes).toHaveLength(1);
    expect(groupes[0].metier).toBeNull();
    expect(groupes[0].chapitres.map((c) => c.chapitre)).toEqual([null, "ARTICLE BPU"]);
  });

  /* Les 830 bons de la production ne portent aucun métier tranché : leur
     lecture doit rester au bit près celle d'avant, sans quoi la colonne neuve
     aurait déplacé des travaux que personne n'a touchés. */
  it("laisse un bon d'avant la colonne strictement inchangé", () => {
    const lignes: LigneTravail[] = [
      travail("Protection sols"),
      chapitre("PEINTURE TOUT LE LOGEMENT"),
      travail("Deux couches", 60, "m²"),
      chapitre("SOL CHAMBRE 1"),
      travail("Pose lino", 12, "m²"),
    ];
    const groupes = travauxParMetier(lignes, CONNUS);
    expect(groupes.map((g) => g.metier)).toEqual([null, "PEINTURE", "SOL"]);
    expect(groupes[1].lignes.map((l) => l.designation)).toEqual(["Deux couches"]);
    expect(groupes[2].lignes.map((l) => l.designation)).toEqual(["Pose lino"]);
  });
});
