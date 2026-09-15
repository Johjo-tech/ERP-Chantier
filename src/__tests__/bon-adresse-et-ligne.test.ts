/**
 * Ce qu'un bon de commande doit porter pour être enregistrable.
 *
 * Les deux exigences se rejoignent sur la facture : l'adresse d'intervention y
 * devient le bloc « Lieu d'intervention » (via `adresse_locataire`), et les
 * lignes du bon y deviennent les lignes facturées. Un bon qui n'a ni l'une ni
 * les autres produit une facture qui ne dit ni où, ni quoi — et
 * `bc_generer_facture`, faute de lignes, s'en invente une : « Travaux — BC n°… »
 * au montant global.
 */

import { describe, it, expect } from "vitest";
import { lignesDeTravaux, manquesBonCommande } from "@/api/regles-bc";

const ADRESSE = "33 rue du Grand Veymont";

/** Les codes seuls : les libellés se relisent, ils ne s'assertent pas. */
function codes(bon: Parameters<typeof manquesBonCommande>[0]) {
  return manquesBonCommande(bon).map((m) => m.code);
}

describe("Ce qu'un bon de commande doit porter", () => {
  it("accepte un bon qui porte l'adresse et un travail décrit", () => {
    expect(
      codes({
        adresse: ADRESSE,
        lignes: [{ type: "ligne", designation: "Remplacement du siphon" }],
      })
    ).toEqual([]);
  });

  /* Le cas qui motive la règle : un bon arrive avant tout chiffrage. Exiger un
     prix interdirait de l'enregistrer au moment où on le reçoit. */
  it("accepte une ligne sans prix — le chiffrage vient plus tard", () => {
    expect(
      codes({
        adresse: ADRESSE,
        lignes: [{ type: "ligne", designation: "Reprise peinture séjour", prixUnitaire: 0 }],
      })
    ).toEqual([]);
  });

  it("réclame l'adresse d'intervention quand elle manque", () => {
    expect(codes({ lignes: [{ type: "ligne", designation: "Siphon" }] })).toEqual([
      "adresse_intervention",
    ]);
  });

  /* L'app historique écrit `""` pour « non renseigné », et un champ qu'on a
     effleuré ne porte souvent qu'une espace. */
  it("ne se contente pas d'une adresse blanche", () => {
    expect(codes({ adresse: "   ", lignes: [{ type: "ligne", designation: "Siphon" }] })).toEqual([
      "adresse_intervention",
    ]);
  });

  it("réclame une ligne de travaux quand le bon n'en porte aucune", () => {
    expect(codes({ adresse: ADRESSE, lignes: [] })).toEqual(["ligne_travaux"]);
    expect(codes({ adresse: ADRESSE })).toEqual(["ligne_travaux"]);
  });

  /* Un chapitre structure le document, un commentaire l'annote : ni l'un ni
     l'autre ne dit ce qu'il y a à faire. */
  it("ne prend ni un chapitre ni un commentaire pour un travail", () => {
    expect(
      codes({
        adresse: ADRESSE,
        lignes: [
          { type: "chapitre", designation: "PLOMBERIE" },
          { type: "commentaire", designation: "Accès par le gardien" },
        ],
      })
    ).toEqual(["ligne_travaux"]);
  });

  it("ne prend pas une ligne vide pour un travail", () => {
    expect(
      codes({
        adresse: ADRESSE,
        lignes: [{ type: "ligne", designation: "  ", prixUnitaire: 120 }],
      })
    ).toEqual(["ligne_travaux"]);
  });

  it("énumère les deux manques plutôt que de s'arrêter au premier", () => {
    expect(codes({})).toEqual(["adresse_intervention", "ligne_travaux"]);
  });

  /* Une ligne sans type est une ligne : c'est le défaut du schéma, et l'app
     historique omet le champ. */
  it("traite une ligne sans type comme une ligne de travaux", () => {
    expect(lignesDeTravaux([{ designation: "Divers" }])).toHaveLength(1);
  });

  /* Le message doit désigner l'endroit où la donnée réapparaît, sinon
     l'exigence passe pour une tracasserie de formulaire. */
  it("dit à quoi servent les deux champs", () => {
    const [adresse, ligne] = manquesBonCommande({}).map((m) => m.libelle);
    expect(adresse).toContain("Lieu d'intervention");
    expect(ligne).toContain("Le prix peut attendre");
  });
});
